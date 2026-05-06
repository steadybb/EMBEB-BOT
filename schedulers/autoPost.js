// schedulers/autoPost.js
const cron = require('node-cron');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { generateContent, getFallbackPost } = require('../utils/openai');

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
  enableImageValidation: process.env.ENABLE_IMAGE_VALIDATION !== 'false', // Enable image URL validation
};

const MAX_DISCORD_EMBED_DESCRIPTION = 4096;
const MAX_RETRIES = 3;
const MAX_RECENT_HASHES = 10;
const STATE_FILE = path.join(__dirname, '../data/autopost_state.json');
const CONTENT_CACHE_TTL = 3600000; // 1 hour cache for generated content

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
let contentCache = new Map();
let savePromise = null;

// Statistics tracking
const stats = {
  totalPosts: 0,
  successfulPosts: 0,
  failedPosts: 0,
  apiPosts: 0,
  fallbackPosts: 0,
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
  // Prevent race conditions
  if (savePromise) {
    await savePromise;
  }
  
  savePromise = (async () => {
    try {
      const state = {
        lastTypeIndex,
        lastChannelIndex,
        stats: {
          totalPosts: stats.totalPosts,
          successfulPosts: stats.successfulPosts,
          failedPosts: stats.failedPosts,
          apiPosts: stats.apiPosts,
          fallbackPosts: stats.fallbackPosts,
          lastPostTime: stats.lastPostTime,
          contentTypes: stats.contentTypes,
        },
      };
      
      await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
      await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (err) {
      logger.error('Failed to save auto post state:', err);
    } finally {
      savePromise = null;
    }
  })();
  
  await savePromise;
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

function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  // Check if URL is from Discord CDN or valid HTTPS
  const isValidProtocol = url.startsWith('https://');
  const isValidDiscordCDN = url.includes('cdn.discordapp.com');
  const isValidImgur = url.includes('imgur.com');
  
  // Check for valid image extensions
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const hasValidExtension = validExtensions.some(ext => 
    url.toLowerCase().includes(ext)
  );
  
  return isValidProtocol && (isValidDiscordCDN || isValidImgur || hasValidExtension);
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
  
  // Periodic cleanup
  if (recentContentHashes.size % 20 === 0) {
    cleanupOldHashes();
  }
  
  return false;
}

function cleanupOldHashes() {
  if (recentContentHashes.size > MAX_RECENT_HASHES * 2) {
    const toDelete = Array.from(recentContentHashes).slice(0, MAX_RECENT_HASHES);
    toDelete.forEach(hash => recentContentHashes.delete(hash));
    logger.debug(`Cleaned up ${toDelete.length} old content hashes`);
  }
}

function truncateContent(text) {
  if (text.length <= MAX_DISCORD_EMBED_DESCRIPTION) {
    return text;
  }
  
  logger.warn(`Content too long (${text.length} chars), truncating to ${MAX_DISCORD_EMBED_DESCRIPTION} chars`);
  return text.substring(0, MAX_DISCORD_EMBED_DESCRIPTION - 3) + '...';
}

function updateStats(type, success, source = 'unknown') {
  stats.totalPosts++;
  
  if (success) {
    stats.successfulPosts++;
  } else {
    stats.failedPosts++;
  }
  
  // Track source
  if (source === 'api') {
    stats.apiPosts++;
  } else if (source === 'fallback') {
    stats.fallbackPosts++;
  }
  
  stats.lastPostTime = new Date().toISOString();
  
  if (!stats.contentTypes[type]) {
    stats.contentTypes[type] = { attempts: 0, successes: 0, api: 0, fallback: 0 };
  }
  stats.contentTypes[type].attempts++;
  
  if (success) {
    stats.contentTypes[type].successes++;
    if (source === 'api') stats.contentTypes[type].api++;
    if (source === 'fallback') stats.contentTypes[type].fallback++;
  }
}

// Cache helper
function getCachedContent(cacheKey) {
  const cached = contentCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CONTENT_CACHE_TTL) {
    logger.debug(`Using cached content for: ${cacheKey}`);
    return cached.data;
  }
  return null;
}

function setCachedContent(cacheKey, data) {
  // Keep cache size manageable
  if (contentCache.size > 100) {
    const oldestKey = contentCache.keys().next().value;
    contentCache.delete(oldestKey);
  }
  
  contentCache.set(cacheKey, {
    data: { ...data }, // Clone to prevent mutation
    timestamp: Date.now()
  });
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
  
  // Check cache first
  const cacheKey = `${prompt.substring(0, 100)}_${contentType.id}`;
  let result = getCachedContent(cacheKey);
  
  if (!result) {
    // ============================================
    // GENERATE CONTENT
    // ============================================
    try {
      // Pass contentType.id for better fallback matching
      result = await generateContent(prompt, 'openai/gpt-3.5-turbo', contentType.id);
      
      // Cache successful API results
      if (result && result.source === 'api') {
        setCachedContent(cacheKey, result);
      }
    } catch (err) {
      logger.error('Failed to generate auto post content:', err);
      updateStats(contentType.id, false);
      return false;
    }
  } else {
    logger.info(`Using cached content for ${contentType.name}`);
  }

  // Check if result is valid
  if (!result || !result.content) {
    logger.error('Failed to generate content (all sources exhausted)');
    updateStats(contentType.id, false);
    return false;
  }

  // Log source
  if (result.source === 'fallback') {
    logger.warn(`📦 Using fallback content (Post: ${result.postId || 'unknown'})${result.image ? ' 🖼️ with image' : ''}`);
  } else {
    logger.info(`✅ AI-generated content (${result.model}, ${result.responseTime}ms)`);
  }

  let generatedText = result.content;

  // Validate content
  if (!isValidDiscordContent(generatedText)) {
    logger.error(`Invalid content generated (length: ${generatedText?.length || 0}), skipping.`);
    updateStats(contentType.id, false, result.source);
    return false;
  }

  // Check for duplicates (only for API content, skip for fallback since it's managed differently)
  if (result.source === 'api' && isDuplicateContent(generatedText)) {
    logger.warn('Duplicate API content detected, trying fallback...');
    // Force fallback for this post
    const fallbackPost = getFallbackPost(contentType.id);
    if (fallbackPost) {
      result = {
        content: fallbackPost.content,
        source: 'fallback',
        postId: fallbackPost.id,
        type: fallbackPost.type,
        image: fallbackPost.image || null,
      };
      generatedText = result.content;
      logger.info('Using fallback post to avoid duplication');
    } else {
      logger.error('No fallback post available for duplicate content');
      updateStats(contentType.id, false, result.source);
      return false;
    }
  }

  // Truncate if necessary
  generatedText = truncateContent(generatedText);

  // ============================================
  // BUILD EMBED WITH IMAGE SUPPORT
  // ============================================
  const embed = new EmbedBuilder()
    .setTitle(contentType.name)
    .setDescription(generatedText)
    .setColor(getEmbedColor(result.source, selectedModel))
    .setFooter({ 
      text: getFooterText(result, selectedModel)
    })
    .setTimestamp();

  // Add image with validation
  if (result.image && AUTO_POST_CONFIG.enableImageValidation) {
    if (isValidImageUrl(result.image)) {
      embed.setImage(result.image);
      logger.debug(`🖼️ Added image to embed: ${result.image}`);
    } else {
      logger.warn(`Invalid image URL skipped: ${result.image}`);
    }
  } else if (result.image && !AUTO_POST_CONFIG.enableImageValidation) {
    embed.setImage(result.image);
    logger.debug(`🖼️ Added image (validation disabled): ${result.image}`);
  }

  // Add author field for fallback content
  if (result.source === 'fallback') {
    embed.setAuthor({
      name: '📦 Pre-written Content',
      iconURL: 'https://cdn.discordapp.com/emojis/📦.png',
    });
  } else {
    embed.setAuthor({
      name: `🤖 AI Generated • ${result.model || 'Unknown Model'}`,
    });
  }

  // ============================================
  // DETERMINE TARGET CHANNEL with cache fallback
  // ============================================
  let targetChannelId;
  if (specificChannelId) {
    targetChannelId = specificChannelId;
  } else {
    targetChannelId = AUTO_POST_CONFIG.channels[lastChannelIndex % AUTO_POST_CONFIG.channels.length];
    lastChannelIndex++;
  }

  // Get channel with cache fallback
  let channel = client.channels.cache.get(targetChannelId);
  if (!channel) {
    logger.warn(`Channel ${targetChannelId} not in cache, fetching...`);
    try {
      channel = await client.channels.fetch(targetChannelId);
      if (!channel) {
        throw new Error('Channel not found');
      }
    } catch (err) {
      logger.error(`Failed to fetch channel ${targetChannelId}:`, err.message);
      updateStats(contentType.id, false, result.source);
      return false;
    }
  }

  // ============================================
  // SEND WITH RETRY LOGIC
  // ============================================
  let sent = false;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await channel.send({ embeds: [embed] });
      logger.info(
        `Auto post sent to #${channel.name} (${contentType.name})` +
        `${result.source === 'fallback' ? ' 📦' : ' 🤖'}` +
        `${result.image ? ' 🖼️' : ''}` +
        `${attempt > 1 ? ` after ${attempt} attempts` : ''}`
      );
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
      } else if (err.code === 400 && err.message?.includes('image') && attempt === 1) {
        // Image URL might be invalid, retry without image
        logger.warn(`Image embed failed, retrying without image`);
        embed.setImage(null);
        attempt--; // Don't count this as an attempt
        continue;
      } else {
        throw err;
      }
    }
  }

  if (!sent) {
    logger.error(`Failed to send auto post to #${channel.name} after ${MAX_RETRIES} attempts`);
    updateStats(contentType.id, false, result.source);
    return false;
  }

  // Success
  updateStats(contentType.id, true, result.source);
  await saveState();
  return true;
}

// ============================================
// EMBED HELPER FUNCTIONS
// ============================================

/**
 * Get the appropriate embed color based on source and model
 */
function getEmbedColor(source, selectedModel) {
  if (source === 'fallback') {
    return '#FFA500'; // Orange for fallback
  }
  
  // API generated with specific model colors
  const modelColors = {
    'Seal': '#0066CC',
    'ATTO 3': '#00CC66',
    'Dolphin': '#00CCCC',
    'Han': '#CC0000',
    'Seagull': '#FF6600',
  };
  
  return selectedModel && modelColors[selectedModel] 
    ? modelColors[selectedModel] 
    : '#00BFFF'; // Default blue
}

/**
 * Get the footer text based on source and model
 */
function getFooterText(result, selectedModel) {
  if (result.source === 'fallback') {
    const parts = ['📦 Pre-written Content', '🕒 Automated Update'];
    if (result.postId) parts.push(`ID: ${result.postId}`);
    return parts.join(' • ');
  }
  
  // AI generated
  const parts = ['🤖 AI Generated', '🕒 Automated Update'];
  if (result.model) parts.push(result.model);
  if (selectedModel) parts.unshift(`🚗 BYD ${selectedModel}`);
  return parts.join(' • ');
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
    apiVsFallback: stats.totalPosts > 0
      ? `API: ${stats.apiPosts} (${((stats.apiPosts / stats.totalPosts) * 100).toFixed(0)}%) | Fallback: ${stats.fallbackPosts} (${((stats.fallbackPosts / stats.totalPosts) * 100).toFixed(0)}%)`
      : 'N/A',
    nextPostSchedule: `Cron: ${AUTO_POST_CONFIG.schedule}`,
    channels: AUTO_POST_CONFIG.channels.length,
    currentTypeIndex: lastTypeIndex,
    currentType: lastTypeIndex >= 0 ? contentTypes[lastTypeIndex]?.name : 'N/A',
    currentChannelIndex: lastChannelIndex,
    cacheSize: contentCache.size,
  };
}

// ============================================
// SCHEDULER STARTUP
// ============================================
function startAutoPostScheduler(client) {
  // Validation - now allows running without API key if fallback is enabled
  const hasApiKey = !!process.env.OPENROUTER_API_KEY;
  const hasChannels = AUTO_POST_CONFIG.channels.length > 0;
  
  if (!hasApiKey) {
    logger.warn('⚠️  OPENROUTER_API_KEY not set. Will use fallback content exclusively.');
  }
  
  if (!hasChannels) {
    logger.warn('AUTO_POST_CHANNELS not set. Auto poster disabled.');
    return false;
  }

  // Load saved state
  loadState().then(() => {
    logger.info('Auto post state initialized');
  });

  // Schedule the cron job
  cron.schedule(AUTO_POST_CONFIG.schedule, async () => {
    logger.info('🤖 Auto poster: starting scheduled run...');
    
    try {
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
      
      logger.info('✅ Auto poster: scheduled run completed');
    } catch (err) {
      logger.error('Auto poster: scheduled run failed:', err);
      stats.lastError = err.message;
    }
  });

  // Optionally run on startup
  if (AUTO_POST_CONFIG.runOnStartup) {
    setTimeout(async () => {
      logger.info('Auto poster: running startup post...');
      try {
        await postAutoContent(client);
      } catch (err) {
        logger.error('Auto poster: startup post failed:', err);
      }
    }, 5000); // 5 second delay to ensure bot is ready
  }

  // Periodically cleanup old content hashes (every 6 hours)
  cron.schedule('0 */6 * * *', () => {
    logger.debug('Running periodic cleanup of content hashes');
    cleanupOldHashes();
  });

  logger.info(
    `🚀 Auto poster scheduled with cron "${AUTO_POST_CONFIG.schedule}" | ` +
    `Mode: ${AUTO_POST_CONFIG.postToAllChannels ? 'All channels' : 'Round-robin'} | ` +
    `Source: ${hasApiKey ? 'API + Fallback' : 'Fallback Only'} | ` +
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
  clearCache: () => {
    contentCache.clear();
    logger.info('Content cache cleared');
  },
};