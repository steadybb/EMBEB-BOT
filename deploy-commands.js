// deploy-commands.js
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const config = require('./config');
const logger = require('./utils/logger');

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
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error reloading commands:');
    console.error(error);
    process.exit(1);
  }
})();

// Force exit after 10 seconds (safety net)
setTimeout(() => {
  console.log('⏰ Deploy timed out, exiting...');
  process.exit(0);
}, 10000);