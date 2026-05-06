// index.js 
require('./keepalive');
const express = require('express');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Partials, ActivityType } = require('discord.js');
const fs = require('fs');
const config = require('./config');
const logger = require('./utils/logger');

// Import database and schedulers
const { initDatabase, pool, healthCheck } = require('./utils/database');
const startFollowUpScheduler = require('./schedulers/followUp');
const { startAutoPostScheduler, getAutoPostStats } = require('./schedulers/autoPost');
const { startLobbyChatterScheduler } = require('./schedulers/lobbyChatter');
const { startTestimonialScheduler } = require('./schedulers/testimonialPosts');

// ============================================
// GLOBAL VARIABLES
// ============================================
let client = null;
const startTime = Date.now();

// ============================================
// EXPRESS STATIC SERVER
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;
const STATIC_URL = process.env.STATIC_BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static folder for images
app.use('/static', express.static(path.join(__dirname, 'static')));

// CORS headers for API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// ============================================
// API ENDPOINTS
// ============================================

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    bot: client?.user?.tag || 'Starting...',
    botId: client?.user?.id || 'N/A',
    guilds: client?.guilds?.cache?.size || 0,
    users: client?.users?.cache?.size || 0,
    uptime: Math.floor(process.uptime()),
    uptimeHuman: formatUptime(process.uptime()),
    memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`,
    timestamp: new Date().toISOString(),
  });
});

// Detailed stats endpoint
app.get('/stats', async (req, res) => {
  try {
    const autoPostStats = getAutoPostStats();
    const { getApiStats } = require('./utils/openai');
    const apiStats = getApiStats();
    const dbHealth = await healthCheck();
    
    res.json({
      bot: {
        name: client?.user?.tag || 'N/A',
        id: client?.user?.id || 'N/A',
        uptime: formatUptime(process.uptime()),
        startTime: new Date(startTime).toISOString(),
      },
      discord: {
        guilds: client?.guilds?.cache?.size || 0,
        users: client?.users?.cache?.size || 0,
        channels: client?.channels?.cache?.size || 0,
        shards: client?.ws?.shards?.size || 0,
      },
      system: {
        node: process.version,
        platform: process.platform,
        memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`,
        cpu: `${(process.cpuUsage().user / 1000000).toFixed(1)}s`,
      },
      autopost: autoPostStats,
      api: apiStats,
      database: dbHealth,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Stats endpoint error:', err);
    res.status(500).json({ error: 'Stats not available', message: err.message });
  }
});

// Guilds list endpoint (admin only - requires auth in production)
app.get('/guilds', (req, res) => {
  if (!client) return res.json({ error: 'Bot not ready' });
  
  const guilds = client.guilds.cache.map(g => ({
    id: g.id,
    name: g.name,
    memberCount: g.memberCount,
    ownerId: g.ownerId,
    joinedAt: g.joinedAt,
  }));
  
  res.json({ total: guilds.length, guilds });
});

// Format uptime helper
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

// Start Express server
const server = app.listen(PORT, () => {
  logger.ready(`🌐 Web server running on port ${PORT}`);
  logger.info(`🖼️  Static files served at: ${STATIC_URL}/static/`);
  logger.info(`📊 Stats available at: ${STATIC_URL}/stats`);
});

// ============================================
// DISCORD BOT CLIENT
// ============================================
client = new Client({
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
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.User,
  ],
  allowedMentions: {
    parse: ['roles', 'users'],
    repliedUser: true,
  },
  retryLimit: 3,
});

client.commands = new Collection();
client.cooldowns = new Collection();
client.startTime = startTime;

// ============================================
// LOAD COMMANDS
// ============================================
logger.separator('LOADING COMMANDS');
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
let loadedCommands = 0;
let failedCommands = 0;

for (const file of commandFiles) {
  try {
    const command = require(`./commands/${file}`);
    if (command.data && command.data.name) {
      client.commands.set(command.data.name, command);
      logger.cmd(`✅ Loaded command: /${command.data.name}`);
      loadedCommands++;
    } else {
      logger.warn(`⚠️  Skipping ${file} - missing data.name`);
      failedCommands++;
    }
  } catch (err) {
    logger.error(`Failed to load command ${file}:`, err.message);
    failedCommands++;
  }
}
logger.info(`📋 Commands loaded: ${loadedCommands} successful, ${failedCommands} failed`);

// ============================================
// LOAD EVENTS
// ============================================
logger.separator('LOADING EVENTS');
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
let loadedEvents = 0;
let failedEvents = 0;

for (const file of eventFiles) {
  try {
    const eventLoader = require(`./events/${file}`);
    if (typeof eventLoader === 'function') {
      eventLoader(client);
    }
    logger.event(`✅ Loaded event: ${file}`);
    loadedEvents++;
  } catch (err) {
    logger.error(`Failed to load event ${file}:`, err.message);
    failedEvents++;
  }
}
logger.info(`🎯 Events loaded: ${loadedEvents} successful, ${failedEvents} failed`);

// ============================================
// ERROR HANDLING
// ============================================
client.on('error', (error) => {
  logger.error('Discord client error:', error);
});

client.on('shardError', (error) => {
  logger.error('WebSocket shard error:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => { 
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('warning', (warning) => {
  if (warning.name !== 'DeprecationWarning') {
    logger.warn('Process Warning:', warning.message);
  }
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
let isShuttingDown = false;

async function gracefulShutdown(signal = 'SIGTERM') {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
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
  
  // Close Express server
  try {
    server.close(() => {
      logger.info('Express server closed');
    });
  } catch (err) {
    logger.error('Error closing server:', err);
  }
  
  logger.info('Shutdown complete. Goodbye! 👋');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// BOT READY EVENT
// ============================================
client.once('ready', async () => {
  console.clear();
  logger.printBanner('BYD BladeBot', '2.0.0');
  
  logger.ready(`✅ Logged in as ${client.user.tag} (${client.user.id})`);
  logger.info(`🌐 Connected to ${client.guilds.cache.size} guilds`);
  logger.info(`👥 Serving ${client.users.cache.size} users`);
  
  logger.separator('CONNECTED GUILDS');
  client.guilds.cache.forEach(g => {
    logger.info(`  📍 ${g.name} (${g.id}) - ${g.memberCount} members`);
  });

  // Database initialization with retry
  logger.separator('DATABASE SETUP');
  let dbInitialized = false;
  let dbRetries = 0;
  const maxDbRetries = 3;
  
  while (!dbInitialized && dbRetries < maxDbRetries) {
    try {
      await initDatabase();
      logger.db('✅ Database tables verified/created');
      dbInitialized = true;
    } catch (err) {
      dbRetries++;
      logger.error(`❌ Database init attempt ${dbRetries}/${maxDbRetries} failed:`, err.message);
      if (dbRetries < maxDbRetries) {
        logger.info(`Retrying in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        logger.error('❌ Database initialization failed after multiple attempts. Some features may not work.');
      }
    }
  }

  // Schedulers
  logger.separator('STARTING SCHEDULERS');
  
  // Follow-up scheduler
  try {
    if (startFollowUpScheduler) {
      startFollowUpScheduler(client);
      logger.ready('✅ Follow-up scheduler started');
    }
  } catch (err) {
    logger.error('❌ Follow-up scheduler:', err.message);
  }
  
  // Auto post scheduler
  try {
    startAutoPostScheduler(client);
    logger.ready('✅ Auto poster scheduler started');
  } catch (err) {
    logger.error('❌ Auto poster scheduler:', err.message);
  }
  
  // Lobby chatter scheduler
  try {
    startLobbyChatterScheduler(client);
    logger.ready('✅ Lobby chatter scheduler started');
  } catch (err) {
    logger.error('❌ Lobby chatter scheduler:', err.message);
  }
  
  // Testimonial scheduler
  try {
    startTestimonialScheduler(client);
    logger.ready('✅ Testimonial scheduler started');
  } catch (err) {
    logger.error('❌ Testimonial scheduler:', err.message);
  }

  // Presence rotation
  const presenceMessages = [
    { name: `🚗 ${client.guilds.cache.size} BYD communities`, type: ActivityType.Watching },
    { name: '🔋 Blade Battery Technology', type: ActivityType.Listening },
    { name: '⚡ The EV Revolution', type: ActivityType.Watching },
    { name: '🏎️ BYD Seal 0-100 in 3.8s', type: ActivityType.Competing },
    { name: '🌍 Over 3M NEVs Sold', type: ActivityType.Watching },
    { name: '/help for commands', type: ActivityType.Listening },
    { name: `${client.users.cache.size} EV enthusiasts`, type: ActivityType.Watching },
    { name: '⚡ Build Your Dreams', type: ActivityType.Playing },
  ];
  
  let presenceIndex = 0;
  setInterval(() => {
    presenceIndex = (presenceIndex + 1) % presenceMessages.length;
    client.user.setPresence({
      activities: [presenceMessages[presenceIndex]],
      status: 'online'
    });
  }, 30000);

  // Environment check
  logger.separator('ENVIRONMENT CHECK');
  const criticalEnv = ['DISCORD_TOKEN', 'DATABASE_URL'];
  const optionalEnv = [
    'OPENROUTER_API_KEY', 'AUTO_POST_CHANNELS', 'STATIC_BASE_URL', 
    'BOT_OWNER_IDS', 'TESTIMONIAL_CHANNEL_ID', 'LOG_LEVEL'
  ];
  
  for (const key of criticalEnv) {
    if (process.env[key]) logger.success(`  ✅ ${key} is set`);
    else logger.error(`  🔴 ${key} is MISSING (CRITICAL)`);
  }
  
  for (const key of optionalEnv) {
    if (process.env[key]) logger.success(`  ✅ ${key} is set`);
    else logger.warn(`  🟡 ${key} is not set (optional)`);
  }

  // All systems go
  logger.separator('ALL SYSTEMS OPERATIONAL');
  logger.ready('🚀 BYD BladeBot is fully ready!');
  logger.info(`  🤖 Bot:      ${client.user.tag}`);
  logger.info(`  📊 Guilds:   ${client.guilds.cache.size}`);
  logger.info(`  👥 Users:    ${client.users.cache.size}`);
  logger.info(`  🔌 API:      ${process.env.OPENROUTER_API_KEY ? 'Configured' : 'Fallback Mode'}`);
  logger.info(`  📻 AutoPost: ${process.env.AUTO_POST_CHANNELS ? 'Scheduled' : 'Disabled'}`);
  logger.info(`  🖼️  Static:   ${STATIC_URL}/static/`);
  logger.info(`  📢 Testimonials: ${process.env.TESTIMONIAL_CHANNEL_ID ? 'Active' : 'Disabled'}`);
  logger.info(`  📋 Log Level: ${process.env.LOG_LEVEL || 'info'}`);
  console.log('');
});

// ============================================
// INTERACTION HANDLER
// ============================================
client.on('interactionCreate', async (interaction) => {
  // Handle commands
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    
    // Cooldown check
    const { cooldowns } = client;
    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Collection());
    }
    
    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;
    
    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        return interaction.reply({ 
          content: `⏰ Please wait ${timeLeft.toFixed(1)} seconds before using \`/${command.data.name}\` again.`, 
          ephemeral: true 
        });
      }
    }
    
    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
    
    try {
      await command.execute(interaction);
      logger.cmd(`/${interaction.commandName} executed by ${interaction.user.tag}`);
    } catch (error) {
      logger.error(`Command ${interaction.commandName} failed:`, error);
      const reply = { content: '❌ There was an error executing this command.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(reply);
      } else {
        await interaction.reply(reply);
      }
    }
    return;
  }
  
  // Handle buttons - delegate to command handlers
  if (interaction.isButton()) {
    // Check if it's a car giveaway button
    if (interaction.customId === 'cargiveaway_enter') {
      const { handleCarGiveawayButton } = require('./commands/cargiveaway');
      return handleCarGiveawayButton(interaction);
    }
    
    // Check admin commands
    if (interaction.customId.startsWith('admin_')) {
      const adminCommand = client.commands.get('admin');
      if (adminCommand && adminCommand.handleButton) {
        return adminCommand.handleButton(interaction);
      }
    }
    
    // Check ticket commands
    if (interaction.customId === 'create_ticket' || interaction.customId === 'close_ticket') {
      const ticketCommand = client.commands.get('ticket');
      if (ticketCommand && ticketCommand.handleButton) {
        return ticketCommand.handleButton(interaction);
      }
    }
    
    // Check verification button
    if (interaction.customId === 'verify_button') {
      const verifyCommand = client.commands.get('verify');
      if (verifyCommand && verifyCommand.handleButton) {
        return verifyCommand.handleButton(interaction);
      }
    }
    
    // Default button handler from interactionCreate event
    const interactionHandler = require('./handlers/interactionCreate');
    if (interactionHandler.handleButton) {
      return interactionHandler.handleButton(interaction);
    }
  }
  
  // Handle select menus
  if (interaction.isStringSelectMenu()) {
    // Check admin select menus
    if (interaction.customId === 'admin_select_giveaway_leads') {
      const adminCommand = client.commands.get('admin');
      if (adminCommand && adminCommand.handleSelect) {
        return adminCommand.handleSelect(interaction);
      }
    }
    
    // Default select menu handler
    const interactionHandler = require('./handlers/interactionCreate');
    if (interactionHandler.handleSelectMenu) {
      return interactionHandler.handleSelectMenu(interaction);
    }
  }
  
  // Handle modals
  if (interaction.isModalSubmit()) {
    // Check car giveaway modal
    if (interaction.customId === 'cargiveaway_entry_modal') {
      const { handleCarGiveawayModal } = require('./commands/cargiveaway');
      return handleCarGiveawayModal(interaction);
    }
    
    // Check admin modals
    if (interaction.customId.startsWith('admin_modal_')) {
      const adminCommand = client.commands.get('admin');
      if (adminCommand && adminCommand.handleModal) {
        return adminCommand.handleModal(interaction);
      }
    }
    
    // Default modal handler
    const interactionHandler = require('./handlers/interactionCreate');
    if (interactionHandler.handleModal) {
      return interactionHandler.handleModal(interaction);
    }
  }
});

// ============================================
// LOGIN
// ============================================
if (!config.token) {
  logger.error('DISCORD_TOKEN is missing in config!');
  process.exit(1);
}

client.login(config.token).catch(err => {
  logger.error('Failed to login:', err.message);
  process.exit(1);
});

// ============================================
// EXPORTS
// ============================================
module.exports = { client, app, server };