const { SlashCommandBuilder } = require('discord.js');
const buildEmbed = require('../utils/buildEmbed');
const templates = require('../embeds/templates');
const { isAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('posttemplate')
    .setDescription('Post a predefined embed template')
    .addStringOption(option =>
      option.setName('template')
        .setDescription('Choose a template')
        .setRequired(true)
        .addChoices(...Object.keys(templates).map(key => ({ name: key, value: key })))
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
    const template = templates[key];

    if (!template) {
      return interaction.editReply({ content: '❌ Template not found.' });
    }

    const built = buildEmbed(template.embed, {
      user: mention || interaction.user,
      guild: interaction.guild,
      channel: interaction.channel,
    });

    const payload = {
      embeds: [built],
      content: mention ? `${mention}` : null,
    };

    try {
      if (sendDM && mention) {
        await mention.send(payload);
        await interaction.editReply({
          content: `✅ Sent embed to ${mention.tag} via DM`
        });
      } else {
        const message = await interaction.channel.send(payload);
        await interaction.editReply({
          content: `✅ Embed sent to ${interaction.channel}`
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
