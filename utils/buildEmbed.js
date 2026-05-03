// utils/buildEmbed.js
const { EmbedBuilder } = require('discord.js');
const logger = require('./logger');

// ============================================
// NAMED COLORS (with BYD-themed additions)
// ============================================
const namedColors = {
  // Standard colors
  red: 0xE74C3C,
  green: 0x2ECC71,
  blue: 0x3498DB,
  yellow: 0xF1C40F,
  orange: 0xE67E22,
  purple: 0x9B59B6,
  cyan: 0x1ABC9C,
  gray: 0x95A5A6,
  black: 0x000000,
  white: 0xFFFFFF,
  
  // BYD Brand Colors
  byd_blue: 0x00BFFF,
  byd_green: 0x00FF88,
  byd_gold: 0xFFD700,
  blade_battery: 0x00BFFF,
  
  // Status Colors
  success: 0x2ECC71,
  error: 0xE74C3C,
  warning: 0xF39C12,
  info: 0x3498DB,
  
  // Model Colors
  seal_blue: 0x0066CC,
  atto_green: 0x00CC66,
  dolphin_cyan: 0x00CCCC,
  han_red: 0xCC0000,
  seagull_orange: 0xFF6600,
  tang_purple: 0x9933CC,
  yangwang_black: 0x1A1A1A,
  
  // Discord Default
  discord: 0x5865F2,
  blurple: 0x7289DA,
};

// ============================================
// PRE-BUILT EMBED TEMPLATES
// ============================================
const templates = {
  /**
   * Welcome embed for new members
   */
  welcome: (member) => ({
    title: `👋 Welcome to {{guildname}}, {{username}}!`,
    description: `Thanks for joining our BYD community!\n\nCheck out <#{{welcome_channel}}> to get started.`,
    color: 'byd_blue',
    thumbnail: { url: member?.user?.displayAvatarURL() },
    footer: { text: '⚡ BYD Blade Battery • Build Your Dreams' },
    timestamp: true,
  }),

  /**
   * Test drive confirmation
   */
  testDriveConfirm: (data) => ({
    title: '🚗 Test Drive Confirmed!',
    description: `Your test drive has been booked:\n\n📅 **Date:** {{date}}\n⏰ **Time:** {{time}}\n📍 **Location:** {{location}}\n🚙 **Model:** {{model}}`,
    color: 'success',
    fields: [
      { name: '📋 What to Bring', value: '• Valid driver\'s license\n• Proof of insurance\n• Comfortable shoes', inline: false },
      { name: '⏱️ Duration', value: '45-60 minutes', inline: true },
      { name: '💰 Cost', value: 'Free!', inline: true },
    ],
    footer: { text: 'A BYD advisor will contact you to confirm' },
    timestamp: true,
  }),

  /**
   * Quote display
   */
  quote: (quoteData) => ({
    title: `💰 Your BYD {{model}} Quote`,
    description: `Here's your personalized quote for the {{variant}} in {{color}}:`,
    color: 'byd_gold',
    fields: [
      { name: '🚙 Vehicle Price', value: '${{vehiclePrice}}', inline: true },
      { name: '📋 Fees', value: '${{fees}}', inline: true },
      { name: '🏛️ Tax', value: '${{tax}}', inline: true },
      { name: '💰 Incentives', value: '-${{incentives}}', inline: true },
      { name: '💵 Total', value: '**${{total}}**', inline: true },
      { name: '📅 Monthly (Est.)', value: '${{monthly}}/mo', inline: true },
    ],
    footer: { text: '{{incentivesList}}' },
    timestamp: true,
  }),

  /**
   * Error message
   */
  error: (message) => ({
    title: '❌ Oops!',
    description: message || 'Something went wrong. Please try again.',
    color: 'error',
    timestamp: true,
  }),

  /**
   * Success message
   */
  success: (message) => ({
    title: '✅ Success!',
    description: message || 'Operation completed successfully.',
    color: 'success',
    timestamp: true,
  }),

  /**
   * Auto post content
   */
  autoPost: (data) => ({
    title: data.title || '🚗 BYD Update',
    description: data.content,
    color: data.source === 'fallback' ? 'orange' : 'byd_blue',
    image: data.image ? { url: data.image } : undefined,
    footer: { 
      text: data.source === 'fallback' 
        ? '📦 Pre-written Content • Automated Update' 
        : '🤖 AI Generated • Automated Update' 
    },
    timestamp: true,
  }),

  /**
   * Lead capture welcome
   */
  leadWelcome: (username) => ({
    title: `⚡ Welcome to the BYD Elite Circle, {{username}}!`,
    description: `You've been recognized as a **Lead** – that means you get **priority access** to exclusive offers and test drives.`,
    color: 'byd_gold',
    thumbnail: { url: '{{avatar}}' },
    footer: { text: '⚡ Blade Battery Technology • Trusted by 15,000+ drivers' },
    timestamp: true,
  }),

  /**
   * Giveaway announcement
   */
  giveaway: (prize, endTime, winners) => ({
    title: `🎁 GIVEAWAY: ${prize}`,
    description: `React with 🎉 to enter!\n\n**Ends:** <t:${Math.floor(endTime / 1000)}:R>\n**Winners:** ${winners}`,
    color: 'byd_gold',
    footer: { text: 'Good luck! 🍀' },
    timestamp: true,
  }),

  /**
   * Car giveaway announcement
   */
  carGiveaway: (data) => ({
    title: `🚗 CAR GIVEAWAY: BYD ${data.model}`,
    description: `Win a brand new BYD ${data.model}!\n\n**Value:** $${data.msrp?.toLocaleString()}\n**Color:** ${data.color}\n**Shipping:** Included\n**Ends:** <t:${Math.floor(data.endTime / 1000)}:R>`,
    color: 'byd_gold',
    image: data.image ? { url: data.image } : undefined,
    fields: [
      { name: '🏆 Winners', value: `${data.winners}`, inline: true },
      { name: '💵 Entry Fee', value: data.entryFee ? `$${data.entryFee}` : 'Free', inline: true },
      { name: '📋 Requirements', value: 'Must be 18+\nValid driver\'s license', inline: false },
    ],
    footer: { text: 'Enter now for your chance to win!' },
    timestamp: true,
  }),
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Replace {{placeholders}} in a string with values from context.
 */
function replacePlaceholders(str, vars) {
  if (!str || typeof str !== 'string') return str;
  let result = str;
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined && value !== null) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    }
  }
  return result;
}

/**
 * Parse color value from various formats.
 */
function parseColor(color) {
  if (color === undefined || color === null) return null;
  
  // Number (hex)
  if (typeof color === 'number') return color;
  
  // String
  if (typeof color === 'string') {
    // Hex string
    if (color.startsWith('#')) {
      const parsed = parseInt(color.slice(1), 16);
      return isNaN(parsed) ? null : parsed;
    }
    // Named color
    if (namedColors[color.toLowerCase()]) {
      return namedColors[color.toLowerCase()];
    }
  }
  
  // RGB array
  if (Array.isArray(color) && color.length === 3) {
    const [r, g, b] = color;
    return (r << 16) + (g << 8) + b;
  }
  
  return null;
}

/**
 * Build pagination row for multi-page embeds.
 */
function buildPaginationRow(currentPage, totalPages, customIdPrefix = 'page') {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_prev`)
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 0),
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_info`)
      .setLabel(`${currentPage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_next`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages - 1),
  );
}

// ============================================
// MAIN BUILD FUNCTION
// ============================================

/**
 * Build a Discord embed with template support and placeholder replacement.
 */
function buildEmbed(embedData = {}, context = {}) {
  const embed = new EmbedBuilder();

  // Prepare replacement variables
  const { user, member, guild, channel, replacements = {} } = context;
  const vars = {
    username: user?.username || member?.user?.username || 'there',
    userTag: user?.tag || member?.user?.tag || 'user',
    userId: user?.id || member?.user?.id || '',
    userMention: user?.id ? `<@${user.id}>` : (member?.user?.id ? `<@${member.user.id}>` : '@user'),
    guildname: guild?.name || 'this server',
    guildId: guild?.id || '',
    channelname: channel?.name || 'this channel',
    channelMention: channel?.id ? `<#${channel.id}>` : '#channel',
    avatar: user?.displayAvatarURL?.() || member?.user?.displayAvatarURL?.() || '',
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    ...replacements,
  };

  logger.debug(`Building embed with ${Object.keys(vars).length} variables`);

  const replace = (str) => replacePlaceholders(str, vars);

  // Title
  if (embedData.title) {
    embed.setTitle(replace(embedData.title));
  }

  // Description
  if (embedData.description) {
    embed.setDescription(replace(embedData.description));
  }

  // URL
  if (embedData.url) {
    embed.setURL(replace(embedData.url));
  }

  // Color
  const colorValue = parseColor(embedData.color);
  if (colorValue !== null) {
    embed.setColor(colorValue);
  } else if (embedData.color !== undefined) {
    embed.setColor(0x7289DA); // Default blurple
  }

  // Author
  if (embedData.author) {
    embed.setAuthor({
      name: replace(embedData.author.name),
      iconURL: embedData.author.iconURL ? replace(embedData.author.iconURL) : undefined,
      url: embedData.author.url ? replace(embedData.author.url) : undefined,
    });
  }

  // Thumbnail
  if (embedData.thumbnail?.url) {
    embed.setThumbnail(replace(embedData.thumbnail.url));
  }

  // Image
  if (embedData.image?.url) {
    embed.setImage(replace(embedData.image.url));
  }

  // Fields
  if (embedData.fields && Array.isArray(embedData.fields)) {
    const replacedFields = embedData.fields.map(field => ({
      name: replace(field.name),
      value: replace(field.value),
      inline: field.inline || false,
    }));
    embed.addFields(replacedFields);
  }

  // Footer
  if (embedData.footer) {
    const footerText = replace(embedData.footer.text || embedData.footer);
    embed.setFooter({
      text: footerText,
      iconURL: embedData.footer.iconURL ? replace(embedData.footer.iconURL) : undefined,
    });
  }

  // Timestamp
  if (embedData.timestamp) {
    embed.setTimestamp(embedData.timestamp === true ? new Date() : new Date(embedData.timestamp));
  }

  logger.debug(`Embed built successfully: "${embedData.title?.substring(0, 50) || 'No title'}"`);
  return embed;
}

// ============================================
// QUICK BUILDERS
// ============================================

/**
 * Build a simple success embed.
 */
function successEmbed(message, context = {}) {
  return buildEmbed(templates.success(message), context);
}

/**
 * Build a simple error embed.
 */
function errorEmbed(message, context = {}) {
  return buildEmbed(templates.error(message), context);
}

/**
 * Build an auto post embed.
 */
function autoPostEmbed(data, context = {}) {
  return buildEmbed(templates.autoPost(data), context);
}

/**
 * Build a quote embed.
 */
function quoteEmbed(quoteData, context = {}) {
  return buildEmbed(templates.quote(quoteData), context);
}

module.exports = buildEmbed;
module.exports.templates = templates;
module.exports.colors = namedColors;
module.exports.success = successEmbed;
module.exports.error = errorEmbed;
module.exports.autoPost = autoPostEmbed;
module.exports.quote = quoteEmbed;
module.exports.buildPaginationRow = buildPaginationRow;
module.exports.replacePlaceholders = replacePlaceholders;
module.exports.parseColor = parseColor;