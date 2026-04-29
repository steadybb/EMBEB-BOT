const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { getGuildConfig, setGuildConfig, saveTicket } = require('../utils/database');
const { isAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system management (admin only)')
    .addSubcommand(sub => sub.setName('setup').setDescription('Post the ticket creation panel'))
    .addSubcommand(sub => sub.setName('category').setDescription('Set the category for tickets').addChannelOption(opt => opt.setName('category').setDescription('Category channel').setRequired(true)))
    .addSubcommand(sub => sub.setName('logs').setDescription('Set logs channel').addChannelOption(opt => opt.setName('channel').setDescription('Text channel for logs').setRequired(true)))
    .addSubcommand(sub => sub.setName('staffrole').setDescription('Set staff role that can manage tickets').addRoleOption(opt => opt.setName('role').setRequired(true))),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const config = await getGuildConfig(guildId);

    if (sub === 'category') {
      const category = interaction.options.getChannel('category');
      if (category.type !== 4) return interaction.reply({ content: '❌ Must be a category.', ephemeral: true });
      config.ticket_category_id = category.id;
      await setGuildConfig(guildId, config);
      return interaction.reply({ content: `✅ Ticket category set to ${category.name}`, ephemeral: true });
    }

    if (sub === 'logs') {
      const channel = interaction.options.getChannel('channel');
      config.ticket_logs_channel_id = channel.id;
      await setGuildConfig(guildId, config);
      return interaction.reply({ content: `✅ Logs channel set to ${channel.name}`, ephemeral: true });
    }

    if (sub === 'staffrole') {
      const role = interaction.options.getRole('role');
      config.staff_role_id = role.id;
      await setGuildConfig(guildId, config);
      return interaction.reply({ content: `✅ Staff role set to ${role.name}`, ephemeral: true });
    }

    if (sub === 'setup') {
      if (!config.ticket_category_id || !config.staff_role_id) {
        return interaction.reply({ content: '❌ Missing configuration. Use `/ticket category`, `/ticket staffrole`, and optionally `/ticket logs`.', ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setTitle('🎫 Support Ticket')
        .setDescription('Need help? Click the button below to create a private ticket. A staff member will assist you shortly.')
        .setColor('#3498DB');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('create_ticket').setLabel('📩 Create Ticket').setStyle(ButtonStyle.Primary)
      );
      await interaction.reply({ embeds: [embed], components: [row] });
    }
  }
};