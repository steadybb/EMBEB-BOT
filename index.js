require('./keepalive');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const config = require('./config');

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
}

// Load events
const eventFiles = fs.readdirSync('./events');
for (const file of eventFiles) {
  require(`./events/${file}`)(client);
}

client.login(config.token);

client.once('ready', () => {
  console.log('Logged in as', client.user.tag);
  client.guilds.cache.forEach(g => console.log(`${g.name} (${g.id})`));
});
