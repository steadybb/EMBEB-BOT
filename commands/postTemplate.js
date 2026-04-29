// commands/posttemplate.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const buildEmbed = require('../utils/buildEmbed');
const bydTemplates = require('../modules/bydEmbeds');
const { isAdmin } = require('../utils/permissions');

// Define which templates need buttons and their button rows
function getButtonsForTemplate(templateKey) {
  switch (templateKey) {
    case 'welcome_greeting':
    case 'model_prompt':
      return [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('welcome_model_dolphin').setLabel('🐬 Dolphin').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('welcome_model_seal').setLabel('🦭 Seal').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('welcome_model_atto3').setLabel('⚔️ ATTO 3').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('welcome_model_han').setLabel('🏯 Han').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('welcome_model_commercial').setLabel('🚌 Commercial').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('welcome_model_notsure').setLabel('❓ Not Sure').setStyle(ButtonStyle.Secondary)
        )
      ];
    case 'quote_display':
      return [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('quote_book_testdrive').setLabel('🗓️ Book a Test Drive').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('quote_chat_advisors').setLabel('💬 Chat With an Advisor').setStyle(ButtonStyle.Secondary)
        )
      ];
    case 'follow_up_dormant':
      return [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('followup_brochure').setLabel('📄 Download Brochure').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('followup_quote').setLabel('💰 Get Your Quote').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('followup_testdrive').setLabel('🗓️ Book a Test Drive').setStyle(ButtonStyle.Success)
        )
      ];
    default:
      return [];
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('posttemplate')
    .setDescription('Post a BYD marketing embed template (admin only)')
    .addStringOption(option =>
      option.setName('template')
        .setDescription('Choose a template')
        .setRequired(true)
        .addChoices(...Object.keys(bydTemplates).map(key => ({ name: key, value: key })))
    )
    .addUserOption(option =>
      option.setName('mention')
        .setDescription('Mention a user (optional)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('dm')
        .setDescription('Send as DM instead of in channel')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: '❌ You must be an admin to use this command.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const key = interaction.options.getString('template');
    const mention = interaction.options.getUser('mention');
    const sendDM = interaction.options.getBoolean('dm') ?? false;
    const template = bydTemplates[key];

    if (!template) {
      return interaction.editReply({ content: '❌ Template not found.' });
    }

    // Replace placeholders like {{username}} with actual values
    const replacements = {
      username: mention ? mention.username : interaction.user.username,
      model: 'Seal',
    };

    const built = buildEmbed(template.embed, {
      user: mention || interaction.user,
      guild: interaction.guild,
      channel: interaction.channel,
      replacements,
    });

    const components = getButtonsForTemplate(key);

    const payload = {
      embeds: [built],
      components: components,
      content: mention ? `${mention}` : null,
    };

    try {
      if (sendDM && mention) {
        await mention.send(payload);
        await interaction.editReply({
          content: `✅ ${key} embed sent to ${mention.tag} via DM`
        });
      } else {
        const message = await interaction.channel.send(payload);
        await interaction.editReply({
          content: `✅ ${key} embed sent to ${interaction.channel}`
        });

        const expiryMinutes = template.expiryMinutes || 10;
        setTimeout(() => {
          message.delete().catch(() => {});
        }, expiryMinutes * 60 * 1000);
      }
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: '❌ Failed to send embed.' });
    }
  }
};