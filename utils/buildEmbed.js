// utils/buildEmbed.js
const { EmbedBuilder } = require('discord.js');

const namedColors = {
  red: 0xE74C3C,
  green: 0x2ECC71,
  blue: 0x3498DB,
  yellow: 0xF1C40F,
  orange: 0xE67E22,
  purple: 0x9B59B6,
  cyan: 0x1ABC9C,
  gray: 0x95A5A6,
  black: 0x000000,
  white: 0xFFFFFF
};

/**
 * Replace {{placeholders}} in a string with values from context.
 * @param {string} str - Input string
 * @param {object} vars - Key-value pairs for replacement
 * @returns {string}
 */
function replacePlaceholders(str, vars) {
  if (!str || typeof str !== 'string') return str;
  let result = str;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

module.exports = function buildEmbed(embedData = {}, context = {}) {
  const embed = new EmbedBuilder();

  // Prepare replacement variables
  const { user, guild, channel, replacements = {} } = context;
  const vars = {
    username: user?.username || 'there',
    guildname: guild?.name || 'this server',
    channelname: channel?.name || 'this channel',
    ...replacements,
  };

  // Helper to replace in any string field
  const replace = (str) => replacePlaceholders(str, vars);

  if (embedData.title) embed.setTitle(replace(embedData.title));
  if (embedData.description) embed.setDescription(replace(embedData.description));
  
  if (embedData.footer) {
    const footerText = replace(embedData.footer.text);
    embed.setFooter({ text: footerText, iconURL: embedData.footer.iconURL });
  }
  
  if (embedData.timestamp) embed.setTimestamp(new Date(embedData.timestamp));
  if (embedData.image?.url) embed.setImage(replace(embedData.image.url));
  if (embedData.thumbnail?.url) embed.setThumbnail(replace(embedData.thumbnail.url));
  
  if (embedData.author) {
    embed.setAuthor({
      name: replace(embedData.author.name),
      iconURL: embedData.author.iconURL ? replace(embedData.author.iconURL) : undefined,
      url: embedData.author.url,
    });
  }
  
  if (embedData.fields) {
    const replacedFields = embedData.fields.map(field => ({
      name: replace(field.name),
      value: replace(field.value),
      inline: field.inline || false,
    }));
    embed.addFields(replacedFields);
  }

  // Enhanced color handling (unchanged from original)
  if (embedData.color !== undefined) {
    let colorValue = null;

    if (typeof embedData.color === 'string') {
      if (embedData.color.startsWith('#')) {
        colorValue = parseInt(embedData.color.slice(1), 16);
      } else if (namedColors[embedData.color.toLowerCase()]) {
        colorValue = namedColors[embedData.color.toLowerCase()];
      }
    } else if (Array.isArray(embedData.color) && embedData.color.length === 3) {
      const [r, g, b] = embedData.color;
      colorValue = (r << 16) + (g << 8) + b;
    } else if (typeof embedData.color === 'number') {
      colorValue = embedData.color;
    }

    if (!isNaN(colorValue)) {
      embed.setColor(colorValue);
    } else {
      embed.setColor(0x7289DA);
    }
  }

  return embed;
};