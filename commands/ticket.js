// commands/ticket.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { getGuildConfig, setGuildConfig, saveTicket } = require('../utils/database');
const { isAdmin } = require('../utils/permissions');
const logger = require('../utils/logger');

// Optional: rotating testimonial snippets for the ticket panel
const testimonials = [
  "“BYD support solved my charging question in 10 minutes. Amazing!” – Marina, SP",
  "“The team helped me choose the right ATTO 3 configuration.” – Carlos, RJ",
  "“Fast, friendly, and they know the Blade Battery inside out.” – Luisa, BH"
];

function getRandomTestimonial() {
  return testimonials[Math.floor(Math.random() * testimonials.length)];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('🎫 Support ticket system for BYD customers (admin only)')
    .addSubcommand(sub => sub.setName('setup').setDescription('Post the ticket creation panel (with branded messaging)'))
    .addSubcommand(sub => sub.setName('category').setDescription('Set the category for tickets').addChannelOption(opt => opt.setName('category').setDescription('Category channel').setRequired(true)))
    .addSubcommand(sub => sub.setName('logs').setDescription('Set logs channel').addChannelOption(opt => opt.setName('channel').setDescription('Text channel for logs').setRequired(true)))
    .addSubcommand(sub => sub.setName('staffrole').setDescription('Set staff role that can manage tickets').addRoleOption(opt => opt.setName('role').setDescription('The staff role that can manage tickets').setRequired(true))),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      logger.warn(`⛔ Non‑admin ${interaction.user.tag} tried /ticket`);
      return interaction.reply({ content: '❌ This command is for BYD marketing admins only.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const config = await getGuildConfig(guildId);

    // ---- Category setup ----
    if (sub === 'category') {
      const category = interaction.options.getChannel('category');
      if (category.type !== 4) {
        return interaction.reply({ content: '❌ Must be a category (folder).', ephemeral: true });
      }
      config.ticket_category_id = category.id;
      await setGuildConfig(guildId, config);
      logger.success(`Ticket category set to "${category.name}" in guild ${guildId}`);
      return interaction.reply({ content: `✅ Ticket category set to ${category.name}`, ephemeral: true });
    }

    // ---- Logs channel setup ----
    if (sub === 'logs') {
      const channel = interaction.options.getChannel('channel');
      config.ticket_logs_channel_id = channel.id;
      await setGuildConfig(guildId, config);
      logger.success(`Ticket logs channel set to #${channel.name}`);
      return interaction.reply({ content: `✅ Logs channel set to ${channel.name}`, ephemeral: true });
    }

    // ---- Staff role setup ----
    if (sub === 'staffrole') {
      const role = interaction.options.getRole('role');
      config.staff_role_id = role.id;
      await setGuildConfig(guildId, config);
      logger.success(`Staff role set to "${role.name}"`);
      return interaction.reply({ content: `✅ Staff role set to ${role.name}`, ephemeral: true });
    }

    // ---- Setup the public ticket panel ----
    if (sub === 'setup') {
      // Validation
      if (!config.ticket_category_id) {
        return interaction.reply({ content: '❌ Missing ticket category. Use `/ticket category` first.', ephemeral: true });
      }
      if (!config.staff_role_id) {
        return interaction.reply({ content: '❌ Missing staff role. Use `/ticket staffrole` first.', ephemeral: true });
      }

      // Build a more engaging, BYD-branded embed
      const embed = new EmbedBuilder()
        .setTitle('🎫 BYD Concierge – Priority Support')
        .setDescription(
          `Need help with your BYD? Whether it's a test drive, paperwork, or technical question, our team is here for you.\n\n` +
          `**Click the button below** to open a private support ticket. A BYD specialist will reply within **1 hour** during business days.\n\n` +
          `✨ *“**${getRandomTestimonial()}**”*\n\n` +
          `🔒 Your conversation is encrypted and only visible to you and our staff.`
        )
        .setColor('#00BFFF')
        .setFooter({ text: '⚡ BYD Blade Battery | Trusted by 15,000+ EV drivers', iconURL: 'https://cdn.byd.com/bot/byd-logo.png' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('📩 Create Support Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫')
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      logger.info(`Ticket panel posted in channel #${interaction.channel.name} (guild ${guildId})`);
    }
  }
};