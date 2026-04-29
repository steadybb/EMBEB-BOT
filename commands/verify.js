const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('../utils/database');
const { isAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Set up verification (admin only)')
    .addSubcommand(sub => sub.setName('setup').setDescription('Post the verification button panel'))
    .addSubcommand(sub => sub.setName('role').setDescription('Set the role to give upon verification').addRoleOption(opt => opt.setName('role').setDescription('Verified role').setRequired(true)))
    .addSubcommand(sub => sub.setName('enable').setDescription('Enable verification system'))
    .addSubcommand(sub => sub.setName('disable').setDescription('Disable verification system')),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'role') {
      const role = interaction.options.getRole('role');
      const config = await getGuildConfig(guildId);
      config.verify_role_id = role.id;
      await setGuildConfig(guildId, config);
      return interaction.reply({ content: `✅ Verification role set to ${role.name}`, ephemeral: true });
    }

    if (sub === 'enable') {
      const config = await getGuildConfig(guildId);
      if (!config.verify_role_id) return interaction.reply({ content: '❌ Please set a role first using `/verify role`.', ephemeral: true });
      config.verify_enabled = true;
      await setGuildConfig(guildId, config);
      return interaction.reply({ content: '✅ Verification enabled.', ephemeral: true });
    }

    if (sub === 'disable') {
      const config = await getGuildConfig(guildId);
      config.verify_enabled = false;
      await setGuildConfig(guildId, config);
      return interaction.reply({ content: '❌ Verification disabled.', ephemeral: true });
    }

    if (sub === 'setup') {
      const config = await getGuildConfig(guildId);
      if (!config.verify_enabled) return interaction.reply({ content: '❌ Verification not enabled. Use `/verify enable` first.', ephemeral: true });
      const embed = new EmbedBuilder()
        .setTitle('✅ Verification Required')
        .setDescription('Click the button below to verify yourself and access the server.')
        .setColor('#2ECC71');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verify_button').setLabel('✔️ Verify Me').setStyle(ButtonStyle.Success)
      );
      await interaction.reply({ embeds: [embed], components: [row] });
    }
  }
};