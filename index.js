require('./keepalive');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const config = require('./config');
const logger = require('./utils/logger'); // ✅ Import the logger

// Import database initializer and follow‑up scheduler
const { initDatabase } = require('./utils/database');
const startFollowUpScheduler = require('./schedulers/followUp');

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
  logger.cmd(`Loaded command: ${command.data.name}`); // ✅ Log each command
}

// Load events
const eventFiles = fs.readdirSync('./events');
for (const file of eventFiles) {
  require(`./events/${file}`)(client);
  logger.event(`Loaded event: ${file}`); // ✅ Log each event
}

client.login(config.token);

client.once('ready', async () => {
  // ✅ Fancy startup banner
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
});