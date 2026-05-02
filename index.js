require('./keepalive');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const config = require('./config');
const logger = require('./utils/logger');

// Import database initializer and schedulers
const { initDatabase } = require('./utils/database');
const startFollowUpScheduler = require('./schedulers/followUp');
const { startAutoPostScheduler } = require('./schedulers/autoPost');
const { startLobbyChatterScheduler } = require('./schedulers/lobbyChatter');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel] // Needed for DMs
});

client.commands = new Collection();

// Load commands
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
  logger.cmd(`Loaded command: ${command.data.name}`);
}

// Load events
const eventFiles = fs.readdirSync('./events');
for (const file of eventFiles) {
  require(`./events/${file}`)(client);
  logger.event(`Loaded event: ${file}`);
}

client.login(config.token);

client.once('ready', async () => {
  logger.printBanner('BYD BladeBot', '2.0.0');
  logger.ready(`Logged in as ${client.user.tag} (${client.user.id})`);
  
  client.guilds.cache.forEach(g => logger.info(`Guild: ${g.name} (${g.id})`));

  // Initialize PostgreSQL tables
  try {
    await initDatabase();
    logger.db('Database ready (tables verified/created)');
  } catch (err) {
    logger.error('Failed to initialize database:', err);
  }

  // Start the 48‑hour dormant follow‑up scheduler (runs every hour)
  try {
    startFollowUpScheduler(client);
    logger.ready('Follow‑up scheduler started (runs every hour)');
  } catch (err) {
    logger.error('Failed to start follow‑up scheduler:', err);
  }

  // Start the auto poster (every 2 hours)
  try {
    startAutoPostScheduler(client);
    logger.ready('Auto poster started (every 2 hours)');
  } catch (err) {
    logger.error('Failed to start auto poster:', err);
  }

  // Start the lobby chatter (every 2 minutes – simulates human conversations)
  try {
    startLobbyChatterScheduler(client);
    logger.ready('Lobby chatter started (every 2 minutes)');
  } catch (err) {
    logger.error('Failed to start lobby chatter:', err);
  }
});