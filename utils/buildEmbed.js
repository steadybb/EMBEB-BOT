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

module.exports = function buildEmbed(embedData = {}, context = {}) {
  const embed = new EmbedBuilder();

  if (embedData.title) embed.setTitle(embedData.title);
  if (embedData.description) embed.setDescription(embedData.description);
  if (embedData.footer) embed.setFooter(embedData.footer);
  if (embedData.timestamp) embed.setTimestamp(new Date(embedData.timestamp));
  if (embedData.image?.url) embed.setImage(embedData.image.url);
  if (embedData.thumbnail?.url) embed.setThumbnail(embedData.thumbnail.url);
  if (embedData.author) embed.setAuthor(embedData.author);
  if (embedData.fields) embed.addFields(embedData.fields);

  // ✅ Enhanced color handling
  if (embedData.color !== undefined) {
    let colorValue = null;

    if (typeof embedData.color === 'string') {
      if (embedData.color.startsWith('#')) {
        colorValue = parseInt(embedData.color.slice(1), 16);
      } else if (namedColors[embedData.color.toLowerCase()]) {
        colorValue = namedColors[embedData.color.toLowerCase()];
      }
    } else if (Array.isArray(embedData.color) && embedData.color.length === 3) {
      // RGB array to int
      const [r, g, b] = embedData.color;
      colorValue = (r << 16) + (g << 8) + b;
    } else if (typeof embedData.color === 'number') {
      colorValue = embedData.color;
    }

    if (!isNaN(colorValue)) {
      embed.setColor(colorValue);
    } else {
      embed.setColor(0x7289DA); // Default fallback (Discord blurple)
    }
  }

  return embed;
};
