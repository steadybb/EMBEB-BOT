// index.js (or bot.js)
require('./keepalive');
const express = require('express');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const config = require('./config');
const logger = require('./utils/logger');

// Import database and schedulers
const { initDatabase, pool } = require('./utils/database');
const startFollowUpScheduler = require('./schedulers/followUp');
const { startAutoPostScheduler } = require('./schedulers/autoPost');
const { startLobbyChatterScheduler } = require('./schedulers/lobbyChatter');

// ============================================
// EXPRESS STATIC SERVER
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;
const STATIC_URL = process.env.STATIC_BASE_URL || `http://localhost:${PORT}`;

// Serve static folder for images
app.use('/static', express.static(path.join(__dirname, 'static')));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    bot: client.user?.tag || 'Starting...',
    guilds: client.guilds?.cache?.size || 0,
    users: client.users?.cache?.size || 0,
    uptime: process.uptime(),
    memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`,
    timestamp: new Date().toISOString(),
  });
});

// Stats endpoint
app.get('/stats', (req, res) => {
  try {
    const { getAutoPostStats } = require('./schedulers/autoPost');
    const { getApiStats } = require('./utils/openai');
    res.json({
      bot: client.user?.tag || 'N/A',
      guilds: client.guilds?.cache?.size || 0,
      autopost: getAutoPostStats(),
      api: getApiStats(),
      uptime: process.uptime(),
    });
  } catch (err) {
    res.json({ error: 'Stats not available yet' });
  }
});

// Start Express server
app.listen(PORT, () => {
  logger.ready(`🌐 Web server running on port ${PORT}`);
  logger.info(`🖼️  Static files served at: ${STATIC_URL}/static/`);
});

// ============================================
// DISCORD BOT CLIENT
// ============================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [
    Partials.Channel,    // Needed for DMs
    Partials.Message,    // Needed for partial messages
    Partials.Reaction,   // Needed for reaction events
  ],
  allowedMentions: {
    parse: ['roles', 'users'],
    repliedUser: true,
  },
});

client.commands = new Collection();

// ============================================
// LOAD COMMANDS
// ============================================
logger.separator('LOADING COMMANDS');
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  try {
    const command = require(`./commands/${file}`);
    if (command.data && command.data.name) {
      client.commands.set(command.data.name, command);
      logger.cmd(`✅ Loaded command: /${command.data.name}`);
    } else {
      logger.warn(`⚠️  Skipping ${file} - missing data.name`);
    }
  } catch (err) {
    logger.error(`Failed to load command ${file}:`, err.message);
  }
}

// ============================================
// LOAD EVENTS
// ============================================
logger.separator('LOADING EVENTS');
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
  try {
    require(`./events/${file}`)(client);
    logger.event(`✅ Loaded event: ${file}`);
  } catch (err) {
    logger.error(`Failed to load event ${file}:`, err.message);
  }
}

// ============================================
// ERROR HANDLING
// ============================================

// Discord client errors
client.on('error', (error) => {
  logger.error('Discord client error:', error);
});

client.on('shardError', (error) => {
  logger.error('WebSocket shard error:', error);
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
});

// Uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Graceful shutdown on critical errors
  gracefulShutdown();
});

// Warning handler
process.on('warning', (warning) => {
  logger.warn('Process Warning:', warning.message);
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
async function gracefulShutdown(signal = 'SIGTERM') {
  logger.warn(`\n${signal} received. Shutting down gracefully...`);
  
  // Close database connection
  try {
    await pool.end();
    logger.db('Database connection closed');
  } catch (err) {
    logger.error('Error closing database:', err);
  }
  
  // Destroy Discord client
  try {
    client.destroy();
    logger.info('Discord client destroyed');
  } catch (err) {
    logger.error('Error destroying client:', err);
  }
  
  logger.info('Shutdown complete. Goodbye! 👋');
  process.exit(0);
}

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// BOT READY EVENT
// ============================================
client.once('ready', async () => {
  // Clear console and show banner
  console.clear();
  logger.printBanner('BYD BladeBot', '2.0.0');
  
  logger.ready(`✅ Logged in as ${client.user.tag} (${client.user.id})`);
  logger.info(`🌐 Connected to ${client.guilds.cache.size} guilds`);
  logger.info(`👥 Serving ${client.users.cache.size} users`);
  
  // List guilds
  logger.separator('CONNECTED GUILDS');
  client.guilds.cache.forEach(g => {
    logger.info(`  📍 ${g.name} (${g.id}) - ${g.memberCount} members`);
  });

  // ============================================
  // INITIALIZE DATABASE
  // ============================================
  logger.separator('DATABASE SETUP');
  try {
    await initDatabase();
    logger.db('✅ Database tables verified/created');
  } catch (err) {
    logger.error('❌ Failed to initialize database:', err.message);
    
    // Optional: Retry after delay
    setTimeout(async () => {
      try {
        await initDatabase();
        logger.db('✅ Database initialized on retry');
      } catch (retryErr) {
        logger.error('❌ Database retry failed:', retryErr.message);
      }
    }, 10000); // Retry after 10 seconds
  }

  // ============================================
  // START SCHEDULERS
  // ============================================
  logger.separator('STARTING SCHEDULERS');

  // Follow-up scheduler (every hour)
  try {
    if (startFollowUpScheduler) {
      startFollowUpScheduler(client);
      logger.ready('✅ Follow-up scheduler started (runs every hour)');
    }
  } catch (err) {
    logger.error('❌ Failed to start follow-up scheduler:', err.message);
  }

  // Auto poster (every 2 hours)
  try {
    startAutoPostScheduler(client);
  } catch (err) {
    logger.error('❌ Failed to start auto poster:', err.message);
  }

  // Lobby chatter (every 2 minutes)
  try {
    startLobbyChatterScheduler(client);
  } catch (err) {
    logger.error('❌ Failed to start lobby chatter:', err.message);
  }

  // ============================================
  // SET BOT PRESENCE
  // ============================================
  client.user.setPresence({
    activities: [{ 
      name: `${client.guilds.cache.size} BYD communities ⚡`, 
      type: 3 // WATCHING
    }],
    status: 'online',
  });

  // Rotate presence messages
  const presenceMessages = [
    { name: '🚗 BYD EVs', type: 3 },
    { name: '🔋 Blade Battery Tech', type: 3 },
    { name: '⚡ The EV Revolution', type: 3 },
    { name: '🏎️ BYD Seal 0-100', type: 3 },
    { name: '🌍 Over 3M NEVs Sold', type: 3 },
    { name: '/help for commands', type: 2 },
  ];
  
  let presenceIndex = 0;
  setInterval(() => {
    presenceIndex = (presenceIndex + 1) % presenceMessages.length;
    const presence = presenceMessages[presenceIndex];
    client.user.setActivity(presence.name, { type: presence.type });
  }, 30000);

  // ============================================
  // ENVIRONMENT CHECK
  // ============================================
  logger.separator('ENVIRONMENT CHECK');
  const envChecks = [
    { key: 'DISCORD_TOKEN', critical: true },
    { key: 'DATABASE_URL', critical: true },
    { key: 'OPENROUTER_API_KEY', critical: false },
    { key: 'AUTO_POST_CHANNELS', critical: false },
    { key: 'STATIC_BASE_URL', critical: false },
    { key: 'BOT_OWNER_IDS', critical: false },
  ];
  
  for (const { key, critical } of envChecks) {
    if (process.env[key]) {
      logger.success(`  ✅ ${key} is set`);
    } else if (critical) {
      logger.error(`  🔴 ${key} is MISSING (CRITICAL)`);
    } else {
      logger.warn(`  🟡 ${key} is not set (optional)`);
    }
  }

  // ============================================
  // ALL SYSTEMS GO
  // ============================================
  logger.separator('ALL SYSTEMS OPERATIONAL');
  logger.ready('🚀 BYD BladeBot is fully ready!');
  logger.info(`  🤖 Bot:      ${client.user.tag}`);
  logger.info(`  📊 Guilds:   ${client.guilds.cache.size}`);
  logger.info(`  👥 Users:    ${client.users.cache.size}`);
  logger.info(`  🔌 API:      ${process.env.OPENROUTER_API_KEY ? 'Configured' : 'Fallback Mode'}`);
  logger.info(`  📻 AutoPost: ${process.env.AUTO_POST_CHANNELS ? 'Scheduled' : 'Disabled'}`);
  logger.info(`  🖼️  Static:   ${STATIC_URL}/static/`);
  console.log('');
});

// ============================================
// LOGIN
// ============================================
client.login(config.token).catch(err => {
  logger.error('Failed to login:', err.message);
  logger.error('Check your DISCORD_TOKEN in .env file');
  process.exit(1);
});

// ============================================
// EXPORTS (for external use)
// ============================================
module.exports = { client, app };