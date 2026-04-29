// deploy-commands.js
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const config = require('./config');

// Optional: use the same logger as the bot (if available, else fallback to console)
let logger;
try {
  logger = require('./utils/logger');
} catch (e) {
  // Fallback if logger isn't available during deployment
  logger = {
    info: (msg) => console.log(`📘 ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
    warn: (msg) => console.warn(`⚠️ ${msg}`),
  };
}

// Load all command files
const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
    logger.info(`Loaded command: ${command.data.name}`);
  } else {
    logger.warn(`Command at ./commands/${file} is missing "data" or "execute".`);
  }
}

// Create REST client
const rest = new REST({ version: '10' }).setToken(config.token);

// Deploy commands
(async () => {
  try {
    logger.info(`🔁 Refreshing ${commands.length} application (/) commands...`);
    
    const startTime = Date.now();
    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands }
    );
    const duration = Date.now() - startTime;
    
    logger.success(`✅ Successfully reloaded ${commands.length} commands in ${duration}ms.`);
  } catch (error) {
    logger.error('❌ Error reloading commands:');
    console.error(error);
  }
})();