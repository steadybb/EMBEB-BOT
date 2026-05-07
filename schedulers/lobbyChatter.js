// schedulers/lobbyChatter.js
const axios = require('axios');
const logger = require('../utils/logger');
const { getGuildConfig } = require('../utils/database');
const { getRandomItem, sleep } = require('../utils/helpers');

// Import the rich conversation engine from utils
const {
  defaultPersonas,
  generateChatTurn,
} = require('../utils/lobbyChatter');

// ============================================
// HUMAN‑LIKE TIMING CONFIGURATION
// ============================================
const CONFIG = {
  // Delays (in milliseconds)
  quickReplyMinMs:   30_000,          // 30 sec (back‑and‑forth)
  quickReplyMaxMs:   90_000,          // 1.5 min
  normalPostMinMs:   90_000,          // 1.5 min
  normalPostMaxMs:   600_000,         // 10 min
  afterDiscussionPauseMinMs: 600_000, // 10 min
  afterDiscussionPauseMaxMs: 1800_000,// 30 min

  // Active hours (24‑hour format)
  activeHoursStart: 9,
  activeHoursEnd:   22,

  // Webhook retries
  maxRetries: 3,
  typingDelayRange: { min: 2000, max: 6000 },

  // Conversation limits
  maxMessagesPerTopic: 12,   // after this many messages, force a "wrapping" phase
};

// ============================================
// PER‑GUILD CONVERSATION MEMORY
// ============================================
const guildMemory = new Map();

function getGuildMemory(guildId) {
  if (!guildMemory.has(guildId)) {
    guildMemory.set(guildId, {
      messages: [],           // full history (for context, if needed)
      lastSpeaker: null,
      conversationPhase: 'opening',   // 'opening', 'discussion', 'deep_dive', 'wrapping'
      messageCount: 0,        // messages in current sub‑conversation
      lastActivityTime: Date.now(),
    });
  }
  return guildMemory.get(guildId);
}

// ============================================
// WEBHOOK MANAGEMENT
// ============================================
const webhookClients = new Map();

async function getWebhookClient(url) {
  if (webhookClients.has(url)) return webhookClients.get(url);
  const match = url.match(/\/webhooks\/(\d+)\/(.+)$/);
  if (!match) throw new Error('Invalid webhook URL');
  const client = { id: match[1], token: match[2], url };
  webhookClients.set(url, client);
  return client;
}

async function sendAsPersona(wc, persona, message, retry = 0) {
  // Simulate typing delay
  const typingDelay = Math.random() * (CONFIG.typingDelayRange.max - CONFIG.typingDelayRange.min) + CONFIG.typingDelayRange.min;
  await sleep(typingDelay);

  try {
    await axios.post(wc.url, {
      username: persona.name,
      avatar_url: persona.avatar,
      content: message,
    });
    logger.debug(`💬 ${persona.name}: "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"`);
    return true;
  } catch (err) {
    if (retry < CONFIG.maxRetries) {
      await sleep(1000 * (retry + 1));
      return sendAsPersona(wc, persona, message, retry + 1);
    }
    logger.error(`Webhook failed:`, err.message);
    return false;
  }
}

// ============================================
// HELPER – Determine delay between messages
// ============================================
function getDelay(phase, messageCount) {
  const hour = new Date().getHours();
  const isWeekend = [0, 6].includes(new Date().getDay());

  // Rapid back‑and‑forth for the first few messages
  if (messageCount > 0 && messageCount <= 3) {
    let delay = Math.random() * (CONFIG.quickReplyMaxMs - CONFIG.quickReplyMinMs) + CONFIG.quickReplyMinMs;
    if (isWeekend) delay *= 1.3;
    if (hour >= 12 && hour < 14) delay *= 1.2;   // lunch break – slower
    if (hour >= 21) delay *= 1.5;                // late night – slower
    return Math.min(delay, 300_000);              // cap at 5 minutes
  }

  // Wrapping up – long pause
  if (phase === 'wrapping' || messageCount === 0) {
    let delay = Math.random() * (CONFIG.afterDiscussionPauseMaxMs - CONFIG.afterDiscussionPauseMinMs) + CONFIG.afterDiscussionPauseMinMs;
    if (isWeekend) delay *= 1.2;
    return Math.min(delay, 3600_000);
  }

  // Normal discussion
  let delay = Math.random() * (CONFIG.normalPostMaxMs - CONFIG.normalPostMinMs) + CONFIG.normalPostMinMs;
  if (isWeekend) delay *= 1.3;
  if (hour >= 12 && hour < 14) delay *= 1.2;
  if (hour >= 21) delay *= 1.5;
  return Math.min(delay, 600_000);
}

// ============================================
// MAIN INFINITE LOOP
// ============================================
let loopRunning = false;

async function runLobbyChatter(client) {
  if (loopRunning) return;
  loopRunning = true;
  logger.ready('📢 Human‑style lobby chatter loop started');

  while (true) {
    const hour = new Date().getHours();

    // ---- Active hours check ----
    if (hour < CONFIG.activeHoursStart || hour >= CONFIG.activeHoursEnd) {
      const now = new Date();
      const nextStart = new Date(now);
      nextStart.setHours(CONFIG.activeHoursStart, 0, 0, 0);
      if (now.getHours() >= CONFIG.activeHoursEnd) nextStart.setDate(nextStart.getDate() + 1);
      const waitMs = nextStart - now;
      logger.info(`Lobby off‑hours, sleeping until ${nextStart.toLocaleTimeString()}`);
      await sleep(waitMs);
      continue;
    }

    // ---- Find eligible guilds ----
    const eligibleGuilds = [];
    for (const guild of client.guilds.cache.values()) {
      try {
        const config = await getGuildConfig(guild.id);
        if (config?.lobby_chatter_enabled && config?.lobby_webhook_url) {
          eligibleGuilds.push({ guild, config });
        }
      } catch (err) {
        // ignore individual failures
      }
    }

    if (eligibleGuilds.length === 0) {
      await sleep(60_000);
      continue;
    }

    // ---- Pick one random guild ----
    const { guild, config } = getRandomItem(eligibleGuilds);
    const mem = getGuildMemory(guild.id);

    // ---- Phase transition (based on message count) ----
    if (mem.messageCount >= CONFIG.maxMessagesPerTopic) {
      mem.conversationPhase = 'wrapping';
    } else if (mem.messageCount === 0) {
      mem.conversationPhase = 'opening';
    } else if (mem.messageCount <= 3) {
      mem.conversationPhase = 'discussion';
    } else if (mem.messageCount <= 8) {
      mem.conversationPhase = 'deep_dive';
    } else {
      mem.conversationPhase = 'wrapping';
    }

    // ---- Persona selection (avoid same speaker twice) ----
    let personas = config.lobby_chatter_personas || defaultPersonas;
    if (typeof personas === 'string') {
      try { personas = JSON.parse(personas); } catch { personas = defaultPersonas; }
    }
    let available = personas.filter(p => p.name !== mem.lastSpeaker);
    if (!available.length) available = personas;
    const persona = getRandomItem(available);

    // ---- Generate a natural chat turn ----
    // We pass guildId to benefit from per‑guild message history (avoid repetition)
    const message = generateChatTurn(persona, {
      includePersonalNote: true,
      includeFavModel: true,
      guildId: guild.id,
    });

    // ---- Send via webhook ----
    try {
      const wc = await getWebhookClient(config.lobby_webhook_url);
      const success = await sendAsPersona(wc, persona, message);
      if (success) {
        // Update memory
        mem.messages.push({
          persona: persona.name,
          message,
          timestamp: Date.now(),
        });
        mem.lastSpeaker = persona.name;
        mem.messageCount++;
        mem.lastActivityTime = Date.now();

        // Keep history from growing forever (max 200 messages)
        if (mem.messages.length > 200) mem.messages = mem.messages.slice(-150);
      }
    } catch (err) {
      logger.error(`Lobby post failed for ${guild.id}:`, err.message);
    }

    // ---- Human‑like delay before next message ----
    const delay = getDelay(mem.conversationPhase, mem.messageCount);
    logger.debug(`Next lobby post in ~${Math.round(delay / 1000)}s (phase: ${mem.conversationPhase}, msg: ${mem.messageCount})`);
    await sleep(delay);
  }
}

// ============================================
// START & UTILITY FUNCTIONS
// ============================================
function startLobbyChatterScheduler(client) {
  // Fire the infinite loop (non‑blocking)
  runLobbyChatter(client).catch(err => {
    logger.error('Lobby chatter loop crashed:', err);
    // Restart after 60 seconds
    setTimeout(() => startLobbyChatterScheduler(client), 60_000);
  });
}

function getLobbyStats(guildId) {
  const mem = guildMemory.get(guildId);
  if (!mem) return { totalMessages: 0, currentTopic: 'None', phase: 'opening', heat: 0, lastSpeaker: 'None', activeParticipants: [] };
  return {
    totalMessages: mem.messages.length,
    currentTopic: 'N/A',          // not tracked in this simple version
    phase: mem.conversationPhase,
    heat: 0,                      // not used here
    lastSpeaker: mem.lastSpeaker,
    activeParticipants: [...new Set(mem.messages.map(m => m.persona))],
  };
}

function resetLobbyMemory(guildId) {
  guildMemory.delete(guildId);
}

// Welcome queue placeholder (not used in this scheduler)
function queueWelcomeMessage(guildId, memberId, client) {
  // optional – can be implemented later if needed
}

module.exports = {
  startLobbyChatterScheduler,
  getLobbyStats,
  resetLobbyMemory,
  queueWelcomeMessage,
};