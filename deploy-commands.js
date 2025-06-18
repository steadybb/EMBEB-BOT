const { REST, Routes } = require('discord.js');
const fs = require('fs');
const config = require('./config'); // Contains your bot token and client ID

// Load all command files
const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.warn(`[WARNING] The command at ./commands/${file} is missing a required "data" or "execute" property.`);
  }
}

// Create REST client
const rest = new REST({ version: '10' }).setToken(config.token);

// Deploy commands
(async () => {
  try {
    console.log(`🔁 Refreshing ${commands.length} application (/) commands...`);

    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands }
    );

    console.log('✅ Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('❌ Error reloading commands:', error);
  }
})();
