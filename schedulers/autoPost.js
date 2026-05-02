// schedulers/autoPost.js
const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { generateContent } = require('../utils/openai');

// List of channel IDs where auto posts should go (add your own)
const AUTO_POST_CHANNELS = process.env.AUTO_POST_CHANNELS
  ? process.env.AUTO_POST_CHANNELS.split(',')
  : []; // e.g., "123456789,987654321"

// Different content types - cycle through them
const contentTypes = [
  {
    name: '🚗 BYD Model Spotlight',
    promptTemplate: (model) => `Write a short, exciting spotlight on the BYD ${model}. Include key specs (range, price, unique features), why it's a great EV, and one fun fact. Use emojis and keep it under 300 words.`,
    randomModel: true,
  },
  {
    name: '🔋 EV Fact',
    promptTemplate: () => `Share an interesting fact about BYD's Blade Battery technology or EV industry in general. Keep it positive and educational. (max 200 words)`,
    randomModel: false,
  },
  {
    name: '📰 BYD News',
    promptTemplate: () => `Provide a brief summary of the latest BYD news (last 30 days). Include 2-3 bullet points. If no major news, talk about a recent milestone or award. Keep it engaging.`,
    randomModel: false,
  },
  {
    name: '🚀 EV Lifestyle Tip',
    promptTemplate: () => `Write a short tip about owning an EV (charging, maintenance, saving money, etc.). Relate it to BYD models. Use friendly tone and emojis.`,
    randomModel: false,
  },
];

// List of available models from your bydData.js (or define a subset)
const modelsList = [
  'Seagull', 'Dolphin', 'Seal', 'Seal Performance', 'ATTO 3',
  'Tang', 'Song Plus', 'Yuan Plus', 'Han', 'Han Performance',
  'Yangwang U8', 'Yangwang U9', 'Commercial', 'eBus'
];

function getRandomModel() {
  return modelsList[Math.floor(Math.random() * modelsList.length)];
}

// Keep track of last used type index (simple round-robin)
let lastTypeIndex = -1;
let lastChannelIndex = 0;

async function postAutoContent(client) {
  if (!AUTO_POST_CHANNELS.length) {
    logger.warn('No AUTO_POST_CHANNELS defined. Auto posting disabled.');
    return;
  }

  // Rotate content type
  const nextTypeIndex = (lastTypeIndex + 1) % contentTypes.length;
  lastTypeIndex = nextTypeIndex;
  const contentType = contentTypes[nextTypeIndex];
  const useRandomModel = contentType.randomModel;
  const selectedModel = useRandomModel ? getRandomModel() : null;

  let prompt;
  if (useRandomModel) {
    prompt = contentType.promptTemplate(selectedModel);
  } else {
    prompt = contentType.promptTemplate();
  }

  logger.info(`Auto posting: ${contentType.name}${selectedModel ? ` (${selectedModel})` : ''}`);
  const generatedText = await generateContent(prompt);
  if (!generatedText) {
    logger.error('Failed to generate auto post content, skipping this cycle.');
    return;
  }

  // Build embed
  const embed = new EmbedBuilder()
    .setTitle(contentType.name)
    .setDescription(generatedText)
    .setColor('#00BFFF')
    .setFooter({ text: '🕒 Automated BYD Update • Powered by AI' })
    .setTimestamp();

  // Rotate channels (optional: post to one channel per cycle, or all)
  // Here we post to a single channel per cycle, rotating among the list.
  const targetChannelId = AUTO_POST_CHANNELS[lastChannelIndex % AUTO_POST_CHANNELS.length];
  lastChannelIndex++;

  const channel = client.channels.cache.get(targetChannelId);
  if (!channel) {
    logger.error(`Auto post channel not found: ${targetChannelId}`);
    return;
  }

  try {
    await channel.send({ embeds: [embed] });
    logger.success(`Auto post sent to #${channel.name} (${contentType.name})`);
  } catch (err) {
    logger.error(`Failed to send auto post to ${channel.name}:`, err);
  }
}

/**
 * Start the auto poster scheduler.
 * @param {Client} client - Discord client instance
 */
function startAutoPostScheduler(client) {
  if (!process.env.OPENROUTER_API_KEY) {
    logger.warn('OPENROUTER_API_KEY not set. Auto poster disabled.');
    return;
  }
  if (!AUTO_POST_CHANNELS.length) {
    logger.warn('AUTO_POST_CHANNELS not set. Auto poster disabled.');
    return;
  }

  // Run every 2 hours (at minute 0 of every even hour)
  // Cron pattern: "0 */2 * * *"
  cron.schedule('0 */2 * * *', async () => {
    logger.info('Auto poster: starting scheduled run...');
    await postAutoContent(client);
  });

  // Optionally run once immediately on startup (uncomment if desired)
  // setTimeout(() => postAutoContent(client), 5000);

  logger.ready(`Auto poster scheduled every 2 hours | Channels: ${AUTO_POST_CHANNELS.join(', ')}`);
}

module.exports = { startAutoPostScheduler };