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

    // Format configured items
    const verifyRole = config.verify_role_id ? `<@&${config.verify_role_id}>` : '❌ Not set';
    const ticketCategory = config.ticket_category_id ? `<#${config.ticket_category_id}>` : '❌ Not set';
    const staffRole = config.staff_role_id ? `<@&${config.staff_role_id}>` : '❌ Not set';
    const logsChannel = config.ticket_logs_channel_id ? `<#${config.ticket_logs_channel_id}>` : '❌ Not set';
    const autoPostEnabled = config.auto_post_enabled ? '🟢 Enabled' : '🔴 Disabled';
    const autoPostChannels = config.auto_post_channels?.length ? config.auto_post_channels.map(id => `<#${id}>`).join(', ') : 'None';
    const lobbyStatus = config.lobby_chatter_enabled ? '🟢 Enabled' : '🔴 Disabled';
    const lobbyWebhook = config.lobby_webhook_url ? '✅ Set' : '❌ Not set';

    const embed = new EmbedBuilder()
      .setTitle('🎛️ BYD Bot Admin Dashboard')
      .setDescription('Configure all automated systems for your server.')
      .setColor('#00BFFF')
      .addFields(
        { name: '✅ Verification', value: `**Status:** ${config.verify_enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Role:** ${verifyRole}`, inline: true },
        { name: '🎫 Ticket System', value: `**Category:** ${ticketCategory}\n**Staff Role:** ${staffRole}\n**Logs Channel:** ${logsChannel}`, inline: true },
        { name: '🤖 Auto Poster', value: `**Status:** ${autoPostEnabled}\n**Channels:** ${autoPostChannels}\n**Interval:** Every ${config.auto_post_interval_hours || 2} hours`, inline: true },
        { name: '💬 Lobby Chatter', value: `**Status:** ${lobbyStatus}\n**Webhook:** ${lobbyWebhook}`, inline: true }
      )
      .setFooter({ text: 'Use the buttons below to configure each system.' })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_verify_menu').setLabel('✅ Verification').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_ticket_menu').setLabel('🎫 Ticket System').setStyle(ButtonStyle.Primary)
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_autopost_menu').setLabel('🤖 Auto Poster').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_lobby_menu').setLabel('💬 Lobby Chatter').setStyle(ButtonStyle.Primary)
    );
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row1, row2, row3], ephemeral: true });
  }
};