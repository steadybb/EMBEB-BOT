const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('../utils/database');
const { isAdmin } = require('../utils/permissions');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('🔐 BYD server verification (admin only)')
    .addSubcommand(sub => sub.setName('setup').setDescription('Post the verification button panel (branded)'))
    .addSubcommand(sub => sub.setName('role').setDescription('Set the role to give upon verification').addRoleOption(opt => opt.setName('role').setDescription('The role to assign to verified users').setRequired(true)))
    .addSubcommand(sub => sub.setName('enable').setDescription('Enable verification system'))
    .addSubcommand(sub => sub.setName('disable').setDescription('Disable verification system')),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      logger.warn(`⛔ Non‑admin ${interaction.user.tag} tried /verify`);
      return interaction.reply({ content: '❌ This command is for BYD server admins only.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'role') {
      const role = interaction.options.getRole('role');
      const config = await getGuildConfig(guildId);
      config.verify_role_id = role.id;
      await setGuildConfig(guildId, config);
      logger.success(`Verification role set to "${role.name}" in guild ${guildId}`);
      return interaction.reply({ content: `✅ Verification role set to ${role.name}`, ephemeral: true });
    }

    if (sub === 'enable') {
      const config = await getGuildConfig(guildId);
      if (!config.verify_role_id) {
        return interaction.reply({ content: '❌ Please set a role first using `/verify role`.', ephemeral: true });
      }
      config.verify_enabled = true;
      await setGuildConfig(guildId, config);
      logger.info(`Verification system ENABLED in guild ${guildId}`);
      return interaction.reply({ content: '✅ Verification enabled. Use `/verify setup` to post the button panel.', ephemeral: true });
    }

    if (sub === 'disable') {
      const config = await getGuildConfig(guildId);
      config.verify_enabled = false;
      await setGuildConfig(guildId, config);
      logger.info(`Verification system DISABLED in guild ${guildId}`);
      return interaction.reply({ content: '❌ Verification disabled. New members will not be prompted.', ephemeral: true });
    }

    if (sub === 'setup') {
      const config = await getGuildConfig(guildId);
      if (!config.verify_enabled) {
        return interaction.reply({ content: '❌ Verification not enabled. Use `/verify enable` first.', ephemeral: true });
      }
      if (!config.verify_role_id) {
        return interaction.reply({ content: '❌ Verification role not set. Use `/verify role` first.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle('⚡ Welcome to the BYD Community')
        .setDescription(
          `Before you explore test drives, exclusive offers, and owner discussions, we need a quick verification — it helps keep our community safe and spam‑free.\n\n` +
          `**Click the button below** to get instant access. You’ll also unlock:\n` +
          `• 🔒 Private test drive booking\n` +
          `• 💰 Real‑time EV incentives (IPVA exemption, free charger alerts)\n` +
          `• 🎫 Priority support tickets\n\n` +
          `✨ Verified members get **early access to limited‑edition BYD drops**.`
        )
        .setColor('#00BFFF')
        .setFooter({ text: '⚡ Blade Battery Technology • Trusted by 15,000+ drivers', iconURL: 'https://cdn.byd.com/bot/byd-logo.png' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('verify_button')
          .setLabel('✅ Verify Me – It’s Free')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🔑')
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      logger.success(`Verification panel posted in #${interaction.channel.name} (guild ${guildId})`);
    }
  }
};