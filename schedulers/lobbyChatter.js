// schedulers/lobbyChatter.js
const cron = require('node-cron');
const axios = require('axios');
const logger = require('../utils/logger');
const { getGuildConfig } = require('../utils/database');
const { defaultPersonas, generateChatTurn } = require('../utils/lobbyChatter');
const { getRandomItem } = require('../utils/helpers');

// Store active webhook clients to reuse
const webhookClients = new Map();

async function getWebhookClient(webhookUrl) {
  if (webhookClients.has(webhookUrl)) return webhookClients.get(webhookUrl);
  // Parse webhook URL to get id and token
  const match = webhookUrl.match(/\/webhooks\/(\d+)\/(.+)$/);
  if (!match) throw new Error('Invalid webhook URL');
  const [, id, token] = match;
  const client = { id, token, url: webhookUrl };
  webhookClients.set(webhookUrl, client);
  return client;
}

async function sendAsPersona(webhookClient, persona, message) {
  try {
    await axios.post(webhookClient.url, {
      username: persona.name,
      avatar_url: persona.avatar,
      content: message,
    });
    logger.debug(`Lobby chatter: ${persona.name} said: ${message.substring(0, 50)}`);
  } catch (err) {
    logger.error('Failed to send webhook message:', err.message);
  }
}

async function runLobbyChatter(client) {
  const guilds = client.guilds.cache;
  for (const guild of guilds.values()) {
    const config = await getGuildConfig(guild.id);
    if (!config.lobby_chatter_enabled || !config.lobby_webhook_url) continue;
    
    let personas = config.lobby_chatter_personas || defaultPersonas;
    if (typeof personas === 'string') personas = JSON.parse(personas);
    if (!personas.length) personas = defaultPersonas;
    
    // Pick a random persona
    const persona = getRandomItem(personas);
    const message = generateChatTurn(persona);
    
    try {
      const webhook = await getWebhookClient(config.lobby_webhook_url);
      await sendAsPersona(webhook, persona, message);
    } catch (err) {
      logger.error(`Lobby chatter failed for guild ${guild.id}:`, err);
    }
    
    // Wait random interval between 30 sec and 2 min before next guild
    await new Promise(resolve => setTimeout(resolve, Math.random() * 90000 + 30000));
  }
}

function startLobbyChatterScheduler(client) {
  // Run every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    logger.info('Lobby chatter: starting round...');
    await runLobbyChatter(client);
  });
  logger.ready('Lobby chatter scheduler started (every 2 min)');
}

module.exports = { startLobbyChatterScheduler };