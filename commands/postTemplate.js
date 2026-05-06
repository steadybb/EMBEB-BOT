// commands/posttemplate.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const buildEmbed = require('../utils/buildEmbed');
const bydTemplates = require('../modules/bydEmbeds');
const { isAdmin, isStaffOrAbove } = require('../utils/permissions');
const logger = require('../utils/logger');

// ============================================
// SOCIAL PROOF & URGENCY CONTENT
// ============================================
const testimonials = [
  "“Saved $7,500 with federal credits – the Seal is a steal!” – Marina, CA",
  "“ATTO 3's Blade Battery gave my family real peace of mind.” – Carlos, TX",
  "“Free home charger? BYD really cares.” – Luisa, NY",
  "“0‑60 in 3.8s – the Han Performance is pure adrenaline.” – Felipe, FL",
  "“Best EV decision I ever made. And I saved thousands.” – Ahmed, CO",
  "“The Yangwang U8 is absolutely unreal – worth every penny.” – James, CA",
  "“BYD's customer service blew me away. Real humans who care.” – Sarah, NY",
  "“Range anxiety? Never heard of it with 450 miles of range.” – Mike, TX"
];

const urgentPhrases = [
  "🔥 Launch edition models – limited inventory!",
  "⏳ EV tax credits may phase out – lock yours now.",
  "🎁 Free charger installation ends June 30.",
  "📉 0.99% financing – last 10 cars at this rate.",
  "⚡ Only 5 test drive slots left this week!",
  "🏆 BYD just won 'EV of the Year' – demand is surging!",
  "💨 Spring delivery slots filling fast – order this week!",
  "⭐ 5-star safety rating – but only 3 cars remain at this price"
];

const seasonalThemes = {
  winter: { emoji: '❄️', message: 'Winter range protection tech included' },
  spring: { emoji: '🌸', message: 'Spring into savings – 0% financing special' },
  summer: { emoji: '☀️', message: 'Summer road trip ready – max A/C efficiency' },
  fall: { emoji: '🍂', message: 'Fall EV event – test drive any model' }
};

// ============================================
// HELPER FUNCTIONS
// ============================================
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getExpiryDate(hours) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toLocaleString();
}

function getSeasonalTheme() {
  const month = new Date().getMonth();
  if (month >= 11 || month <= 1) return seasonalThemes.winter;
  if (month >= 2 && month <= 4) return seasonalThemes.spring;
  if (month >= 5 && month <= 7) return seasonalThemes.summer;
  return seasonalThemes.fall;
}

function getButtonsForTemplate(templateKey, modelOverride = null) {
  const buttons = [];
  
  if (templateKey === 'welcome_greeting' || templateKey === 'model_prompt') {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('welcome_model_dolphin').setLabel('🐬 Dolphin').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('welcome_model_seal').setLabel('🦭 Seal').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('welcome_model_atto3').setLabel('⚔️ ATTO 3').setStyle(ButtonStyle.Primary)
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('welcome_model_han').setLabel('🏯 Han').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('welcome_model_yangwang').setLabel('👑 Yangwang').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('welcome_model_notsure').setLabel('❓ Not Sure').setStyle(ButtonStyle.Secondary)
    );
    return [row1, row2];
  }
  
  if (templateKey === 'quote_display') {
    const quoteRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('quote_book_testdrive').setLabel('🗓️ Book a Test Drive').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('quote_chat_advisors').setLabel('💬 Chat With an Advisor').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('quote_financing').setLabel('💰 Check Financing').setStyle(ButtonStyle.Success)
    );
    return [quoteRow];
  }
  
  if (templateKey === 'follow_up_dormant') {
    const followRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('followup_brochure').setLabel('📄 Download Brochure').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('followup_quote').setLabel('💰 Get Your Quote').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('followup_testdrive').setLabel('🗓️ Book a Test Drive').setStyle(ButtonStyle.Success)
    );
    return [followRow];
  }
  
  if (templateKey === 'car_giveaway' && modelOverride) {
    const giveawayRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`giveaway_enter_${modelOverride}`).setLabel('🎉 Enter to Win!').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('giveaway_rules').setLabel('📜 View Rules').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('giveaway_share').setLabel('📢 Share Giveaway').setStyle(ButtonStyle.Primary)
    );
    return [giveawayRow];
  }
  
  if (templateKey === 'test_drive_reminder') {
    const reminderRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('reminder_confirm').setLabel('✅ Confirm Attendance').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('reminder_reschedule').setLabel('📅 Reschedule').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('reminder_cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Danger)
    );
    return [reminderRow];
  }
  
  return [];
}

// ============================================
// EMBED ENHANCEMENTS
// ============================================
function enhanceEmbed(embed, key, replacements, modelOverride) {
  // Add testimonial footer for certain templates
  if (key === 'quote_display' || key === 'follow_up_dormant') {
    const footerText = `⭐ Trusted by 15,000+ EV drivers • ${randomItem(testimonials).substring(0, 80)}`;
    embed.setFooter({ text: footerText });
  }
  
  // Add seasonal theme for welcome messages
  if (key === 'welcome_greeting') {
    const seasonal = getSeasonalTheme();
    if (seasonal && embed.data.description) {
      embed.setDescription(`${embed.data.description}\n\n${seasonal.emoji} ${seasonal.message}`);
    }
  }
  
  // Add urgency badge for limited time offers
  if (replacements.expiry_hours && parseInt(replacements.expiry_hours) <= 24) {
    if (embed.data.title && !embed.data.title.includes('🔥')) {
      embed.setTitle(`🔥 ${embed.data.title}`);
    }
  }
  
  return embed;
}

// ============================================
// SAFE INTERACTION REPLY HELPERS
// ============================================

/**
 * Safely reply to an interaction, handling already-acknowledged errors.
 */
async function safeReply(interaction, content) {
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.editReply(content);
    }
    return await interaction.reply(content);
  } catch (err) {
    if (err.code === 40060) {
      // Already acknowledged - try edit instead
      return await interaction.editReply(content);
    }
    if (err.code === 10062) {
      // Unknown interaction - too late to respond
      logger.warn('Interaction expired, cannot reply');
      return null;
    }
    throw err;
  }
}

/**
 * Safely defer an interaction reply as ephemeral.
 */
async function safeDefer(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      return await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
  } catch (err) {
    if (err.code === 10062) {
      logger.warn('Interaction expired, cannot defer');
      return null;
    }
    throw err;
  }
}

// ============================================
// SLASH COMMAND DEFINITION
// ============================================
module.exports = {
  data: new SlashCommandBuilder()
    .setName('posttemplate')
    .setDescription('🚀 Send a high‑conversion BYD marketing embed (admin only)')
    .addStringOption(option =>
      option.setName('template')
        .setDescription('Choose the campaign template')
        .setRequired(true)
        .addChoices(...Object.keys(bydTemplates).map(key => ({ name: key.replace(/_/g, ' ').toUpperCase(), value: key })))
    )
    .addUserOption(option =>
      option.setName('mention')
        .setDescription('Target user (optional – they will be mentioned)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('dm')
        .setDescription('Send directly to user\'s DM instead of channel')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('model')
        .setDescription('BYD model to feature (replaces {{model}})')
        .setRequired(false)
        .addChoices(
          { name: 'Seagull', value: 'Seagull' },
          { name: 'Dolphin', value: 'Dolphin' },
          { name: 'Seal', value: 'Seal' },
          { name: 'Seal Performance', value: 'SealPerformance' },
          { name: 'ATTO 3', value: 'ATTO 3' },
          { name: 'Tang', value: 'Tang' },
          { name: 'Song Plus', value: 'SongPlus' },
          { name: 'Yuan Plus', value: 'YuanPlus' },
          { name: 'Han', value: 'Han' },
          { name: 'Han Performance', value: 'HanPerformance' },
          { name: 'Yangwang U8', value: 'YangwangU8' },
          { name: 'Yangwang U9', value: 'YangwangU9' },
          { name: 'Commercial', value: 'Commercial' },
          { name: 'eBus', value: 'eBus' }
        )
    )
    .addIntegerOption(option =>
      option.setName('expiry_hours')
        .setDescription('Create limited‑time urgency (e.g., 24 hours)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(168)
    )
    .addStringOption(option =>
      option.setName('offer')
        .setDescription('Extra offer (free charger, discount, etc.)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('note')
        .setDescription('A personal message to the user (appears above embed)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('channel')
        .setDescription('Optional channel ID to post to (instead of current)')
        .setRequired(false)
    ),

  async execute(interaction) {
    // ============================================
    // STEP 1: Permission check (respond before deferring if denied)
    // ============================================
    if (!isAdmin(interaction.member) && !(await isStaffOrAbove(interaction.member))) {
      logger.warn(`⛔ Non‑admin ${interaction.user.tag} tried /posttemplate`);
      // ✅ Use MessageFlags instead of ephemeral
      return interaction.reply({
        content: '❌ This command requires Admin or Staff permissions.',
        flags: MessageFlags.Ephemeral
      });
    }

    // ============================================
    // STEP 2: Defer reply (15-minute window to respond)
    // ============================================
    const deferred = await safeDefer(interaction);
    if (!deferred) {
      // Interaction already expired
      return;
    }

    // ============================================
    // STEP 3: Parse options
    // ============================================
    const key = interaction.options.getString('template');
    const mention = interaction.options.getUser('mention');
    const sendDM = interaction.options.getBoolean('dm') ?? false;
    const modelOverride = interaction.options.getString('model') || 'Seal';
    const expiryHours = interaction.options.getInteger('expiry_hours');
    const customOffer = interaction.options.getString('offer');
    const personalNote = interaction.options.getString('note');
    const targetChannelId = interaction.options.getString('channel');

    const template = bydTemplates[key];
    if (!template) {
      return safeReply(interaction, {
        content: '❌ Template not found. Available: ' + Object.keys(bydTemplates).join(', ')
      });
    }

    logger.cmd(`/posttemplate ${key} used by ${interaction.user.tag} (DM: ${sendDM}, mention: ${mention?.tag || 'none'}, model: ${modelOverride})`);

    const targetUser = mention || interaction.user;
    const expiryDate = expiryHours ? getExpiryDate(expiryHours) : null;
    
    // ============================================
    // STEP 4: Get target channel
    // ============================================
    let targetChannel = interaction.channel;
    if (targetChannelId && !sendDM) {
      try {
        targetChannel = await interaction.client.channels.fetch(targetChannelId);
        if (!targetChannel) {
          return safeReply(interaction, { content: '❌ Invalid channel ID provided.' });
        }
      } catch (err) {
        logger.error('Failed to fetch target channel:', err.message);
        return safeReply(interaction, { content: '❌ Could not find the specified channel.' });
      }
    }

    // ============================================
    // STEP 5: Build the embed
    // ============================================
    const seasonal = getSeasonalTheme();
    const replacements = {
      username: targetUser.username,
      user_mention: targetUser.toString(),
      model: modelOverride,
      model_lower: modelOverride.toLowerCase(),
      expiry_date: expiryDate || 'soon',
      expiry_hours: expiryHours?.toString() || '48',
      offer_text: customOffer || '🎁 Free Level 2 home charger installation (limited units)',
      testimonial: randomItem(testimonials),
      urgency_phrase: expiryHours ? randomItem(urgentPhrases) : '',
      seasonal_emoji: seasonal.emoji,
      seasonal_message: seasonal.message,
      server_name: interaction.guild?.name || 'our server',
      channel_mention: interaction.channel?.toString() || '#general'
    };

    if (!template.embed) {
      logger.error(`Template ${key} missing embed property`);
      return safeReply(interaction, { content: '❌ Template configuration error.' });
    }

    let builtEmbed = buildEmbed(template.embed, {
      user: targetUser,
      guild: interaction.guild,
      channel: interaction.channel,
      replacements
    });

    builtEmbed = enhanceEmbed(builtEmbed, key, replacements, modelOverride);
    const components = getButtonsForTemplate(key, modelOverride);

    // ============================================
    // STEP 6: Build content
    // ============================================
    let content = '';
    if (personalNote) content += `📝 *${personalNote}*\n\n`;
    if (mention && !sendDM) content += `${mention} `;
    
    if (expiryHours) {
      const urgencyEmoji = expiryHours <= 24 ? '🔥' : (expiryHours <= 72 ? '⏰' : '📅');
      content += `${urgencyEmoji} **LIMITED TIME — expires in ${expiryHours} hours** ${urgencyEmoji}\n\n`;
    }

    const payload = {
      content: content.trim() || null,
      embeds: [builtEmbed],
      components: components
    };

    // ============================================
    // STEP 7: Send and respond
    // ============================================
    try {
      if (sendDM && mention) {
        // DM the user
        await mention.send(payload);
        await safeReply(interaction, {
          content: `✅ **${key.replace(/_/g, ' ').toUpperCase()}** campaign sent to **${mention.tag}** via DM ${expiryHours ? `(⏳ ${expiryHours}h urgency active)` : ''}`
        });
        logger.success(`📨 DM campaign "${key}" → ${mention.tag} (model: ${modelOverride})`);
        
      } else {
        // Post to channel
        const message = await targetChannel.send(payload);
        await safeReply(interaction, {
          content: `✅ **${key.replace(/_/g, ' ').toUpperCase()}** campaign posted in ${targetChannel.toString()} ${expiryHours ? `(⏳ ${expiryHours}h expiry)` : ''}`
        });
        logger.success(`📢 Channel campaign "${key}" → #${targetChannel.name || targetChannel.id}`);

        // Auto-delete after expiry or default 10 minutes
        const autoDeleteMinutes = expiryHours ? expiryHours * 60 : (template.expiryMinutes || 10);
        setTimeout(async () => {
          try {
            await message.delete();
            logger.debug(`🗑️ Auto‑deleted campaign "${key}" after ${autoDeleteMinutes} minutes`);
          } catch (err) {
            logger.debug(`Could not delete campaign message: ${err.message}`);
          }
        }, autoDeleteMinutes * 60 * 1000);
      }
      
      // Log to database if available
      try {
        const { logAutoPost } = require('../utils/database');
        await logAutoPost(
          interaction.guildId,
          sendDM ? null : (targetChannelId || interaction.channelId),
          key,
          'manual',
          null,
          modelOverride,
          !!template.embed.image,
          true
        );
      } catch (dbErr) {
        logger.debug('Could not log campaign to database:', dbErr.message);
      }
      
    } catch (err) {
      logger.error(`❌ Campaign "${key}" failed:`, err);
      
      let errorMessage = '❌ Failed to send campaign. ';
      if (err.code === 50007) {
        errorMessage += 'Cannot send DM to this user (they may have DMs disabled).';
      } else if (err.code === 50013) {
        errorMessage += 'Missing permissions in the target channel.';
      } else {
        errorMessage += err.message;
      }
      
      await safeReply(interaction, { content: errorMessage });
    }
  }
};