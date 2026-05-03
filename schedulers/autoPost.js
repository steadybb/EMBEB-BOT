// schedulers/autoPost.js
const cron = require('node-cron');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { generateContent } = require('../utils/openai');

// ============================================
// CONFIGURATION
// ============================================
const AUTO_POST_CONFIG = {
  channels: process.env.AUTO_POST_CHANNELS
    ? process.env.AUTO_POST_CHANNELS.split(',').map(id => id.trim()).filter(Boolean)
    : [],
  schedule: process.env.AUTO_POST_SCHEDULE || '0 */2 * * *', // Every 2 hours by default
  postToAllChannels: process.env.AUTO_POST_ALL_CHANNELS === 'true', // Post to all channels simultaneously
  runOnStartup: process.env.AUTO_POST_ON_STARTUP === 'true',
  minDelayBetweenPosts: parseInt(process.env.AUTO_POST_MIN_DELAY, 10) || 5000, // 5 seconds between posts
};

const MAX_DISCORD_EMBED_DESCRIPTION = 4096;
const MAX_RETRIES = 3;
const MAX_RECENT_HASHES = 10;
const STATE_FILE = path.join(__dirname, '../data/autopost_state.json');

// ============================================
// CONTENT TYPES
// ============================================
const contentTypes = [
  {
    name: '🚗 BYD Model Spotlight',
    promptTemplate: (model) => `Write a short, exciting spotlight on the BYD ${model}. Include key specs (range, price, unique features), why it's a great EV, and one fun fact. Use emojis and keep it under 300 words.`,
    randomModel: true,
    id: 'model_spotlight',
  },
  {
    name: '🔋 EV Fact',
    promptTemplate: () => `Share an interesting fact about BYD's Blade Battery technology or EV industry in general. Keep it positive and educational. (max 200 words)`,
    randomModel: false,
    id: 'ev_fact',
  },
  {
    name: '📰 BYD News',
    promptTemplate: () => `Provide a brief summary of the latest BYD news (last 30 days). Include 2-3 bullet points. If no major news, talk about a recent milestone or award. Keep it engaging.`,
    randomModel: false,
    id: 'byd_news',
  },
  {
    name: '🚀 EV Lifestyle Tip',
    promptTemplate: () => `Write a short tip about owning an EV (charging, maintenance, saving money, etc.). Relate it to BYD models. Use friendly tone and emojis.`,
    randomModel: false,
    id: 'ev_tip',
  },
];

// ============================================
// MODELS LIST
// ============================================
const modelsList = [
  'Seagull', 'Dolphin', 'Seal', 'Seal Performance', 'ATTO 3',
  'Tang', 'Song Plus', 'Yuan Plus', 'Han', 'Han Performance',
  'Yangwang U8', 'Yangwang U9', 'Commercial', 'eBus',
];

// ============================================
// STATE MANAGEMENT
// ============================================
let lastTypeIndex = -1;
let lastChannelIndex = 0;
const recentContentHashes = new Set();

// Statistics tracking
const stats = {
  totalPosts: 0,
  successfulPosts: 0,
  failedPosts: 0,
  lastPostTime: null,
  lastError: null,
  contentTypes: {},
  startTime: new Date(),
};

async function loadState() {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf8');
    const state = JSON.parse(data);
    lastTypeIndex = state.lastTypeIndex ?? -1;
    lastChannelIndex = state.lastChannelIndex ?? 0;
    
    if (state.stats) {
      Object.assign(stats, state.stats);
    }
    
    logger.info('Auto post state loaded successfully');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.error('Failed to load auto post state:', err);
    }
    logger.info('No existing state found, starting fresh');
  }
}

async function saveState() {
  try {
    const state = {
      lastTypeIndex,
      lastChannelIndex,
      stats: {
        totalPosts: stats.totalPosts,
        successfulPosts: stats.successfulPosts,
        failedPosts: stats.failedPosts,
        lastPostTime: stats.lastPostTime,
        contentTypes: stats.contentTypes,
      },
    };
    
    await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    logger.error('Failed to save auto post state:', err);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function getRandomModel() {
  return modelsList[Math.floor(Math.random() * modelsList.length)];
}

function isValidDiscordContent(text) {
  if (!text || typeof text !== 'string') return false;
  if (text.length === 0) return false;
  if (text.length > MAX_DISCORD_EMBED_DESCRIPTION) return false;
  return true;
}

function isDuplicateContent(text) {
  const hash = crypto.createHash('md5').update(text).digest('hex');
  
  if (recentContentHashes.has(hash)) {
    logger.warn('Duplicate content detected, skipping...');
    return true;
  }
  
  recentContentHashes.add(hash);
  
  // Keep the set size manageable
  if (recentContentHashes.size > MAX_RECENT_HASHES) {
    const firstHash = recentContentHashes.values().next().value;
    recentContentHashes.delete(firstHash);
  }
  
  return false;
}

function truncateContent(text) {
  if (text.length <= MAX_DISCORD_EMBED_DESCRIPTION) {
    return text;
  }
  
  logger.warn(`Content too long (${text.length} chars), truncating to ${MAX_DISCORD_EMBED_DESCRIPTION} chars`);
  return text.substring(0, MAX_DISCORD_EMBED_DESCRIPTION - 3) + '...';
}

function updateStats(type, success) {
  stats.totalPosts++;
  
  if (success) {
    stats.successfulPosts++;
  } else {
    stats.failedPosts++;
  }
  
  stats.lastPostTime = new Date().toISOString();
  
  if (!stats.contentTypes[type]) {
    stats.contentTypes[type] = { attempts: 0, successes: 0 };
  }
  stats.contentTypes[type].attempts++;
  
  if (success) {
    stats.contentTypes[type].successes++;
  }
}

// ============================================
// MAIN AUTO POST FUNCTION
// ============================================
async function postAutoContent(client, specificChannelId = null) {
  if (!AUTO_POST_CONFIG.channels.length) {
    logger.warn('No AUTO_POST_CHANNELS defined. Auto posting disabled.');
    return false;
  }

  // Rotate content type
  const nextTypeIndex = (lastTypeIndex + 1) % contentTypes.length;
  lastTypeIndex = nextTypeIndex;
  const contentType = contentTypes[nextTypeIndex];
  const useRandomModel = contentType.randomModel;
  const selectedModel = useRandomModel ? getRandomModel() : null;

  // Generate prompt
  let prompt;
  if (useRandomModel) {
    prompt = contentType.promptTemplate(selectedModel);
  } else {
    prompt = contentType.promptTemplate();
  }

  logger.info(`Auto posting: ${contentType.name}${selectedModel ? ` (${selectedModel})` : ''}`);
  
  // Generate content
  let generatedText;
  try {
    generatedText = await generateContent(prompt);
  } catch (err) {
    logger.error('Failed to generate auto post content:', err);
    updateStats(contentType.id, false);
    return false;
  }

  if (!generatedText) {
    logger.error('Generated content is empty, skipping this cycle.');
    updateStats(contentType.id, false);
    return false;
  }

  // Validate content
  if (!isValidDiscordContent(generatedText)) {
    logger.error(`Invalid content generated (length: ${generatedText?.length || 0}), skipping.`);
    updateStats(contentType.id, false);
    return false;
  }

  // Check for duplicates
  if (isDuplicateContent(generatedText)) {
    logger.warn('Duplicate content detected, regenerating...');
    // Try one more time with a different model if applicable
    const retryModel = useRandomModel ? getRandomModel() : null;
    let retryPrompt;
    if (useRandomModel && retryModel !== selectedModel) {
      retryPrompt = contentType.promptTemplate(retryModel);
    } else {
      retryPrompt = prompt + ' (make it different from previous responses)';
    }
    
    generatedText = await generateContent(retryPrompt);
    if (!generatedText || isDuplicateContent(generatedText) || !isValidDiscordContent(generatedText)) {
      logger.error('Failed to generate unique content after retry.');
      updateStats(contentType.id, false);
      return false;
    }
  }

  // Truncate if necessary
  generatedText = truncateContent(generatedText);

  // Build embed
  const embed = new EmbedBuilder()
    .setTitle(contentType.name)
    .setDescription(generatedText)
    .setColor(selectedModel ? '#00BFFF' : '#00FF88')
    .setFooter({ 
      text: selectedModel 
        ? `🚗 BYD ${selectedModel} • 🕒 Automated Update • Powered by AI` 
        : '🕒 Automated BYD Update • Powered by AI' 
    })
    .setTimestamp();

  // Determine target channel
  let targetChannelId;
  if (specificChannelId) {
    targetChannelId = specificChannelId;
  } else {
    targetChannelId = AUTO_POST_CONFIG.channels[lastChannelIndex % AUTO_POST_CONFIG.channels.length];
    lastChannelIndex++;
  }

  const channel = client.channels.cache.get(targetChannelId);
  if (!channel) {
    logger.error(`Auto post channel not found: ${targetChannelId}`);
    updateStats(contentType.id, false);
    return false;
  }

  // Send with retry logic
  let sent = false;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await channel.send({ embeds: [embed] });
      logger.success(`Auto post sent to #${channel.name} (${contentType.name})${attempt > 1 ? ` after ${attempt} attempts` : ''}`);
      sent = true;
      break;
    } catch (err) {
      if (err.code === 429 && attempt < MAX_RETRIES) {
        const retryAfter = (err.retryAfter || 5) * 1000;
        logger.warn(`Rate limited posting to #${channel.name}. Retrying in ${retryAfter}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, retryAfter));
      } else if (err.code === 50013 && attempt < MAX_RETRIES) {
        logger.warn(`Missing permissions in #${channel.name}, trying again...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw err;
      }
    }
  }

  if (!sent) {
    logger.error(`Failed to send auto post to #${channel.name} after ${MAX_RETRIES} attempts`);
    updateStats(contentType.id, false);
    return false;
  }

  // Success
  updateStats(contentType.id, true);
  await saveState();
  return true;
}

// ============================================
// STATISTICS GETTER
// ============================================
function getAutoPostStats() {
  const now = new Date();
  const uptime = Math.floor((now - stats.startTime) / 1000); // in seconds
  
  return {
    ...stats,
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
    successRate: stats.totalPosts > 0 
      ? `${((stats.successfulPosts / stats.totalPosts) * 100).toFixed(1)}%` 
      : 'N/A',
    nextPostSchedule: `Cron: ${AUTO_POST_CONFIG.schedule}`,
    channels: AUTO_POST_CONFIG.channels.length,
    currentTypeIndex: lastTypeIndex,
    currentChannelIndex: lastChannelIndex,
  };
}

// ============================================
// SCHEDULER STARTUP
// ============================================
function startAutoPostScheduler(client) {
  // Validation
  if (!process.env.OPENROUTER_API_KEY) {
    logger.warn('OPENROUTER_API_KEY not set. Auto poster disabled.');
    return false;
  }
  
  if (!AUTO_POST_CONFIG.channels.length) {
    logger.warn('AUTO_POST_CHANNELS not set. Auto poster disabled.');
    return false;
  }

  // Load saved state
  loadState().then(() => {
    logger.info('Auto post state initialized');
  });

  // Schedule the cron job
  cron.schedule(AUTO_POST_CONFIG.schedule, async () => {
    logger.info('Auto poster: starting scheduled run...');
    
    if (AUTO_POST_CONFIG.postToAllChannels) {
      // Post to all configured channels
      for (let i = 0; i < AUTO_POST_CONFIG.channels.length; i++) {
        const channelId = AUTO_POST_CONFIG.channels[i];
        await postAutoContent(client, channelId);
        
        // Add delay between posts if not the last channel
        if (i < AUTO_POST_CONFIG.channels.length - 1) {
          await new Promise(resolve => setTimeout(resolve, AUTO_POST_CONFIG.minDelayBetweenPosts));
        }
      }
    } else {
      // Post to single channel (round-robin)
      await postAutoContent(client);
    }
    
    logger.info('Auto poster: scheduled run completed');
  });

  // Optionally run on startup
  if (AUTO_POST_CONFIG.runOnStartup) {
    setTimeout(async () => {
      logger.info('Auto poster: running startup post...');
      await postAutoContent(client);
    }, 5000); // 5 second delay to ensure bot is ready
  }

  logger.ready(
    `Auto poster scheduled with cron "${AUTO_POST_CONFIG.schedule}" | ` +
    `Mode: ${AUTO_POST_CONFIG.postToAllChannels ? 'All channels' : 'Round-robin'} | ` +
    `Channels: ${AUTO_POST_CONFIG.channels.join(', ')}`
  );

  return true;
}

// ============================================
// EXPORTS
// ============================================
module.exports = { 
  startAutoPostScheduler,
  getAutoPostStats,
  postAutoContent, // Export for manual triggering if needed
};