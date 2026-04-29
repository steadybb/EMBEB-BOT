// commands/posttemplate.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const buildEmbed = require('../utils/buildEmbed');
const bydTemplates = require('../modules/bydEmbeds');
const { isAdmin } = require('../utils/permissions');
const logger = require('../utils/logger');

// Social proof snippets – rotate randomly to feel fresh
const testimonials = [
  "“I saved R$ 9,560/year on IPVA alone – the Seal pays for itself!” – Marina, SP",
  "“The ATTO 3’s Blade Battery gave my family peace of mind.” – Carlos, RJ",
  "“Best decision I ever made. The Dolphin is a beast in the city.” – Luisa, BH",
  "“Home charger installed for free – BYD really cares.” – Ahmed, Dubai",
  "“0‑100 km/h in 3.8s? The Han is a silent killer.” – VIP customer"
];

const urgentPhrases = [
  "🔥 Limited stock alert!",
  "⏳ Offer expires in {{expiry_hours}} hours – act fast!",
  "🎁 Free charger installation ends soon.",
  "📉 IPVA exemption may change next quarter – lock yours now."
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getExpiryDate(hours) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toLocaleString();
}

function getButtonsForTemplate(templateKey) {
  if (templateKey === 'welcome_greeting' || templateKey === 'model_prompt') {
    // Split 6 buttons into two rows: first row (3 buttons), second row (3 buttons)
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('welcome_model_dolphin').setLabel('🐬 Dolphin').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('welcome_model_seal').setLabel('🦭 Seal').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('welcome_model_atto3').setLabel('⚔️ ATTO 3').setStyle(ButtonStyle.Primary)
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('welcome_model_han').setLabel('🏯 Han').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('welcome_model_commercial').setLabel('🚌 Commercial').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('welcome_model_notsure').setLabel('❓ Not Sure').setStyle(ButtonStyle.Secondary)
    );
    return [row1, row2];  // return array of rows
  }
  if (templateKey === 'quote_display') {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('quote_book_testdrive').setLabel('🗓️ Book a Test Drive').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('quote_chat_advisors').setLabel('💬 Chat With an Advisor').setStyle(ButtonStyle.Secondary)
      )
    ];
  }
  if (templateKey === 'follow_up_dormant') {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('followup_brochure').setLabel('📄 Download Brochure').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('followup_quote').setLabel('💰 Get Your Quote').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('followup_testdrive').setLabel('🗓️ Book a Test Drive').setStyle(ButtonStyle.Success)
      )
    ];
  }
  return [];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('posttemplate')
    .setDescription('🚀 Send a high‑conversion BYD marketing embed (admin only)')
    .addStringOption(option =>
      option.setName('template')
        .setDescription('Choose the campaign template')
        .setRequired(true)
        .addChoices(...Object.keys(bydTemplates).map(key => ({ name: key, value: key })))
    )
    .addUserOption(option =>
      option.setName('mention')
        .setDescription('Target user (optional – they will be mentioned)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('dm')
        .setDescription('Send directly to user’s DM instead of channel')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('model')
        .setDescription('BYD model to feature (replaces {{model}})')
        .setRequired(false)
        .addChoices(
          { name: 'Dolphin', value: 'Dolphin' },
          { name: 'Seal', value: 'Seal' },
          { name: 'ATTO 3', value: 'ATTO 3' },
          { name: 'Han', value: 'Han' },
          { name: 'Commercial', value: 'Commercial' }
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
        .setDescription('Extra offer (free charger, R$ discount, etc.)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('note')
        .setDescription('A personal message to the user (appears above embed)')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      logger.warn(`⛔ Non‑admin ${interaction.user.tag} tried /posttemplate`);
      return interaction.reply({
        content: '❌ This command is for BYD marketing admins only.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const key = interaction.options.getString('template');
    const mention = interaction.options.getUser('mention');
    const sendDM = interaction.options.getBoolean('dm') ?? false;
    const modelOverride = interaction.options.getString('model') || 'Seal';
    const expiryHours = interaction.options.getInteger('expiry_hours');
    const customOffer = interaction.options.getString('offer');
    const personalNote = interaction.options.getString('note');

    const template = bydTemplates[key];
    if (!template) {
      return interaction.editReply({ content: '❌ Template not found.' });
    }

    logger.cmd(`/posttemplate ${key} used by ${interaction.user.tag} (DM: ${sendDM}, mention: ${mention?.tag || 'none'})`);

    const targetUser = mention || interaction.user;
    const expiryDate = expiryHours ? getExpiryDate(expiryHours) : null;

    const replacements = {
      username: targetUser.username,
      model: modelOverride,
      expiry_date: expiryDate || 'soon',
      expiry_hours: expiryHours?.toString() || '48',
      offer_text: customOffer || '🎁 Free home charger installation (limited units)',
      testimonial: randomItem(testimonials),
      urgency_phrase: expiryHours ? randomItem(urgentPhrases).replace('{{expiry_hours}}', expiryHours.toString()) : ''
    };

    let builtEmbed = buildEmbed(template.embed, {
      user: targetUser,
      guild: interaction.guild,
      channel: interaction.channel,
      replacements
    });

    if (key === 'quote_display' || key === 'follow_up_dormant') {
      const footerText = `⭐ Trusted by 15,000+ EV drivers • ${randomItem(testimonials).substring(0, 80)}`;
      builtEmbed.setFooter({ text: footerText, iconURL: template.embed.footer?.iconURL });
    }

    const components = getButtonsForTemplate(key);  // now returns array of rows

    let content = '';
    if (personalNote) content += `📝 *${personalNote}*\n\n`;
    if (mention) content += `${mention} `;

    if (expiryHours) {
      content += `⏰ **LIMITED TIME — expires in ${expiryHours} hours** ⏰\n\n`;
    }

    const payload = {
      content: content.trim() || null,
      embeds: [builtEmbed],
      components: components
    };

    try {
      if (sendDM && mention) {
        await mention.send(payload);
        await interaction.editReply({
          content: `✅ **${key}** campaign sent to **${mention.tag}** via DM ${expiryHours ? `(⏳ ${expiryHours}h urgency active)` : ''}`
        });
        logger.success(`📨 DM campaign "${key}" → ${mention.tag} (model: ${modelOverride})`);
      } else {
        const message = await interaction.channel.send(payload);
        await interaction.editReply({
          content: `✅ **${key}** campaign posted in ${interaction.channel} ${expiryHours ? `(⏳ ${expiryHours}h expiry)` : ''}`
        });
        logger.success(`📢 Channel campaign "${key}" → #${interaction.channel.name}`);

        const autoDeleteMinutes = expiryHours ? expiryHours * 60 : (template.expiryMinutes || 10);
        setTimeout(() => {
          message.delete().catch(() => {});
          logger.debug(`🗑️ Auto‑deleted campaign "${key}" after ${autoDeleteMinutes} minutes`);
        }, autoDeleteMinutes * 60 * 1000);
      }
    } catch (err) {
      logger.error(`❌ Campaign "${key}" failed:`, err);
      await interaction.editReply({ content: '❌ Failed to send campaign. Check permissions and try again.' });
    }
  }
};