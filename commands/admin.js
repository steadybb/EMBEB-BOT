// commands/admin.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('../utils/database');
const { isAdmin } = require('../utils/permissions');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('🎛️ BYD Bot Admin Dashboard'),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: '❌ Only admins can use this dashboard.', ephemeral: true });
    }

    const guildId = interaction.guildId;
    const config = await getGuildConfig(guildId);

    // Helper: format configured items
    const verifyRole = config.verify_role_id ? `<@&${config.verify_role_id}>` : '❌ Not set';
    const ticketCategory = config.ticket_category_id ? `<#${config.ticket_category_id}>` : '❌ Not set';
    const staffRole = config.staff_role_id ? `<@&${config.staff_role_id}>` : '❌ Not set';
    const logsChannel = config.ticket_logs_channel_id ? `<#${config.ticket_logs_channel_id}>` : '❌ Not set';

    const embed = new EmbedBuilder()
      .setTitle('🎛️ BYD Bot Admin Dashboard')
      .setDescription('Configure verification and ticket systems for your server.')
      .setColor('#00BFFF')
      .addFields(
        { name: '✅ Verification', value: `**Status:** ${config.verify_enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Role:** ${verifyRole}`, inline: true },
        { name: '🎫 Ticket System', value: `**Category:** ${ticketCategory}\n**Staff Role:** ${staffRole}\n**Logs Channel:** ${logsChannel}`, inline: true }
      )
      .setFooter({ text: 'Use the buttons below to configure each system.' })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_verify_menu').setLabel('✅ Verification Settings').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_ticket_menu').setLabel('🎫 Ticket System Settings').setStyle(ButtonStyle.Primary)
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
  }
};