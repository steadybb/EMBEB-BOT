// commands/ticket.js
const { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
  MessageFlags
} = require('discord.js');
const { getGuildConfig, setGuildConfig, saveTicket, closeTicket, getOpenTicketsByGuild, assignTicket } = require('../utils/database');
const { isAdmin, isStaffOrAbove } = require('../utils/permissions');
const logger = require('../utils/logger');

// ============================================
// CONFIGURATION
// ============================================
const TICKET_CATEGORIES = {
  'general': { emoji: 'ℹ️', name: 'General Support', color: '#3498DB' },
  'test_drive': { emoji: '🚗', name: 'Test Drive Booking', color: '#2ECC71' },
  'sales': { emoji: '💰', name: 'Sales Inquiry', color: '#F1C40F' },
  'technical': { emoji: '🔧', name: 'Technical Support', color: '#E74C3C' },
  'paperwork': { emoji: '📄', name: 'Paperwork / Documentation', color: '#9B59B6' },
  'complaint': { emoji: '⚠️', name: 'Complaint / Issue', color: '#E67E22' }
};

const TICKET_PRIORITIES = {
  'low': { emoji: '🟢', name: 'Low', color: '#2ECC71' },
  'normal': { emoji: '🔵', name: 'Normal', color: '#3498DB' },
  'high': { emoji: '🟠', name: 'High', color: '#E67E22' },
  'urgent': { emoji: '🔴', name: 'Urgent', color: '#E74C3C' }
};

const testimonials = [
  "“BYD support solved my charging question in 10 minutes. Amazing!” – Marina, CA",
  "“The team helped me choose the right ATTO 3 configuration.” – Carlos, TX",
  "“Fast, friendly, and they know the Blade Battery inside out.” – Luisa, NY",
  "“Best customer service I've ever experienced from an automaker.” – James, FL",
  "“They stayed on the line until all my questions were answered.” – Sarah, WA"
];

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

function getRandomTestimonial() {
  return testimonials[Math.floor(Math.random() * testimonials.length)];
}

function getTicketCategory(categoryId) {
  return TICKET_CATEGORIES[categoryId] || TICKET_CATEGORIES.general;
}

function getTicketPriority(priorityId) {
  return TICKET_PRIORITIES[priorityId] || TICKET_PRIORITIES.normal;
}

// ============================================
// TICKET PANEL EMBED
// ============================================
function createTicketPanelEmbed() {
  const categoriesList = Object.entries(TICKET_CATEGORIES)
    .map(([key, cat]) => `${cat.emoji} **${cat.name}**`)
    .join('\n');
  
  return new EmbedBuilder()
    .setTitle('🎫 BYD Concierge – Priority Support')
    .setDescription(
      `Need help with your BYD? Whether it's a test drive, paperwork, or technical question, our team is here for you.\n\n` +
      `**Available Support Categories:**\n${categoriesList}\n\n` +
      `**How it works:**\n` +
      `1️⃣ Click the button below\n` +
      `2️⃣ Select your issue category\n` +
      `3️⃣ Choose priority level\n` +
      `4️⃣ Describe your issue\n` +
      `5️⃣ A staff member will assist you shortly\n\n` +
      `✨ *“${getRandomTestimonial()}”*\n\n` +
      `⏰ **Response Time:** Within 1 hour (business days)\n` +
      `🔒 Your conversation is encrypted and only visible to you and our staff.`
    )
    .setColor('#00BFFF')
    .setThumbnail('https://cdn.byd.com/bot/byd-logo.png')
    .setFooter({ 
      text: '⚡ BYD Blade Battery | Trusted by 15,000+ EV drivers', 
      iconURL: 'https://cdn.byd.com/bot/byd-logo.png' 
    })
    .setTimestamp();
}

// ============================================
// TICKET CREATION MODAL
// ============================================
function createTicketModal() {
  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
  
  const modal = new ModalBuilder()
    .setCustomId('ticket_create_modal')
    .setTitle('Create Support Ticket');
  
  const categorySelect = new TextInputBuilder()
    .setCustomId('ticket_category')
    .setLabel('Issue Category')
    .setPlaceholder('general, test_drive, sales, technical, paperwork, complaint')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  
  const prioritySelect = new TextInputBuilder()
    .setCustomId('ticket_priority')
    .setLabel('Priority (low, normal, high, urgent)')
    .setPlaceholder('normal')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  
  const subjectInput = new TextInputBuilder()
    .setCustomId('ticket_subject')
    .setLabel('Subject')
    .setPlaceholder('Brief description of your issue')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  
  const descriptionInput = new TextInputBuilder()
    .setCustomId('ticket_description')
    .setLabel('Description')
    .setPlaceholder('Please provide details about your issue...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);
  
  modal.addComponents(
    new ActionRowBuilder().addComponents(categorySelect),
    new ActionRowBuilder().addComponents(prioritySelect),
    new ActionRowBuilder().addComponents(subjectInput),
    new ActionRowBuilder().addComponents(descriptionInput)
  );
  
  return modal;
}

// ============================================
// TICKET CLOSE BUTTONS
// ============================================
function getTicketCloseButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒'),
    new ButtonBuilder()
      .setCustomId('ticket_transcript')
      .setLabel('Transcript')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📄'),
    new ButtonBuilder()
      .setCustomId('ticket_claim')
      .setLabel('Claim Ticket')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👑')
  );
}

// ============================================
// STAFF TICKET PANEL
// ============================================
function getStaffTicketPanel(openTickets) {
  const embed = new EmbedBuilder()
    .setTitle('📋 Active Tickets')
    .setDescription(`There are currently **${openTickets.length}** open tickets.`)
    .setColor('#3498DB')
    .setTimestamp();
  
  for (const ticket of openTickets.slice(0, 10)) {
    embed.addFields({
      name: `#${ticket.id} - ${ticket.category || 'General'}`,
      value: `User: <@${ticket.user_id}>\nChannel: <#${ticket.channel_id}>\nPriority: ${ticket.priority || 'normal'}`,
      inline: true
    });
  }
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_list_all')
      .setLabel('List All Tickets')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📋'),
    new ButtonBuilder()
      .setCustomId('ticket_unassigned')
      .setLabel('Unassigned Tickets')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⚠️')
  );
  
  return { embeds: [embed], components: [row], ephemeral: true };
}

// ============================================
// TICKET CREATION FUNCTION
// ============================================
async function createTicket(interaction, category, priority, subject, description) {
  const config = await getGuildConfig(interaction.guildId);
  
  if (!config.ticket_category_id) {
    return interaction.reply({ 
      content: '❌ Ticket system not configured. Please contact an administrator.', 
      ...EPHEMERAL 
    });
  }
  
  const categoryData = getTicketCategory(category);
  const priorityData = getTicketPriority(priority);
  
  // Create ticket channel
  const ticketName = `ticket-${interaction.user.username}-${Date.now()}`.toLowerCase().substring(0, 32);
  
  const ticketChannel = await interaction.guild.channels.create({
    name: ticketName,
    type: ChannelType.GuildText,
    parent: config.ticket_category_id,
    permissionOverwrites: [
      {
        id: interaction.guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks
        ]
      },
      {
        id: interaction.client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels
        ]
      }
    ]
  });
  
  // Add staff role permissions
  if (config.staff_role_id) {
    await ticketChannel.permissionOverwrites.create(config.staff_role_id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      ManageMessages: true
    });
  }
  
  // Save to database
  const ticketId = await saveTicket(interaction.guildId, interaction.user.id, ticketChannel.id, category);
  
  // Create welcome embed
  const welcomeEmbed = new EmbedBuilder()
    .setTitle(`${priorityData.emoji} Support Ticket #${ticketId}`)
    .setDescription(`**Category:** ${categoryData.emoji} ${categoryData.name}\n**Priority:** ${priorityData.emoji} ${priorityData.name}\n**Created by:** ${interaction.user.tag}\n**Subject:** ${subject}\n\n**Description:**\n${description}\n\nA staff member will assist you shortly. Please provide any additional details here.`)
    .setColor(categoryData.color)
    .setFooter({ text: 'BYD Support • Be patient and respectful' })
    .setTimestamp();
  
  await ticketChannel.send({ 
    content: `<@${interaction.user.id}> ${config.staff_role_id ? `<@&${config.staff_role_id}>` : ''}`,
    embeds: [welcomeEmbed],
    components: [getTicketCloseButtons()]
  });
  
  // Log to logs channel
  if (config.ticket_logs_channel_id) {
    const logsChannel = interaction.guild.channels.cache.get(config.ticket_logs_channel_id);
    if (logsChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('🎫 Ticket Created')
        .setDescription(`**Ticket #${ticketId}**\n**User:** ${interaction.user.tag} (<@${interaction.user.id}>)\n**Category:** ${categoryData.name}\n**Priority:** ${priorityData.name}\n**Subject:** ${subject}\n**Channel:** ${ticketChannel}`)
        .setColor('#00FF00')
        .setTimestamp();
      await logsChannel.send({ embeds: [logEmbed] });
    }
  }
  
  // Send confirmation
  await interaction.reply({ 
    content: `✅ **Ticket Created!**\n\nYour ticket has been created. A staff member will assist you soon.\n\n**Ticket Channel:** ${ticketChannel}\n**Ticket #:** ${ticketId}`, 
    ...EPHEMERAL 
  });
  
  logger.info(`Ticket #${ticketId} created by ${interaction.user.tag} (Category: ${category}, Priority: ${priority})`);
  return ticketId;
}

// ============================================
// CLOSE TICKET FUNCTION
// ============================================
async function closeTicketHandler(interaction, resolution = null) {
  const channel = interaction.channel;
  
  if (!channel.name.startsWith('ticket-')) {
    return interaction.reply({ content: '❌ This is not a ticket channel.', ...EPHEMERAL });
  }
  
  await interaction.reply({ content: '🔒 Closing ticket in 5 seconds...', ephemeral: true });
  
  // Get ticket ID from database
  const config = await getGuildConfig(interaction.guildId);
  
  // Create transcript embed
  const messages = await channel.messages.fetch({ limit: 50 });
  const transcript = messages.reverse().map(m => 
    `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content || '(embed/attachment)'}`
  ).join('\n');
  
  const transcriptEmbed = new EmbedBuilder()
    .setTitle(`Ticket Transcript - ${channel.name}`)
    .setDescription(`**Closed by:** ${interaction.user.tag}\n**Resolution:** ${resolution || 'Not provided'}\n**Messages:** ${messages.size}\n**Channel:** ${channel.name}`)
    .setColor('#FFA500')
    .setTimestamp();
  
  // Log to logs channel
  if (config.ticket_logs_channel_id) {
    const logsChannel = interaction.guild.channels.cache.get(config.ticket_logs_channel_id);
    if (logsChannel) {
      await logsChannel.send({ 
        embeds: [transcriptEmbed],
        files: [{ name: `transcript-${channel.name}.txt`, attachment: Buffer.from(transcript) }]
      });
    }
  }
  
  // Send final message before deletion
  await channel.send({ 
    embeds: [new EmbedBuilder()
      .setTitle('🔒 Ticket Closed')
      .setDescription(`This ticket has been closed by ${interaction.user.tag}.\n\n**Resolution:** ${resolution || 'Issue resolved'}\n\nThe channel will be deleted in 10 seconds.`)
      .setColor('#FF0000')
      .setTimestamp()
    ] 
  });
  
  // Close in database
  await closeTicket(channel.id, resolution);
  
  // Delete channel after delay
  setTimeout(async () => {
    try {
      await channel.delete();
      logger.info(`Ticket channel ${channel.name} deleted`);
    } catch (err) {
      logger.error(`Failed to delete ticket channel: ${err.message}`);
    }
  }, 10000);
}

// ============================================
// SLASH COMMAND
// ============================================
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('🎫 Support ticket system for BYD customers (admin only)')
    .addSubcommand(sub => 
      sub.setName('setup')
        .setDescription('Post the ticket creation panel (with branded messaging)')
    )
    .addSubcommand(sub => 
      sub.setName('category')
        .setDescription('Set the category for tickets')
        .addChannelOption(opt => 
          opt.setName('category')
            .setDescription('Category channel')
            .setRequired(true)
        )
    )
    .addSubcommand(sub => 
      sub.setName('logs')
        .setDescription('Set logs channel')
        .addChannelOption(opt => 
          opt.setName('channel')
            .setDescription('Text channel for logs')
            .setRequired(true)
        )
    )
    .addSubcommand(sub => 
      sub.setName('staffrole')
        .setDescription('Set staff role that can manage tickets')
        .addRoleOption(opt => 
          opt.setName('role')
            .setDescription('The staff role that can manage tickets')
            .setRequired(true)
        )
    )
    .addSubcommand(sub => 
      sub.setName('panel')
        .setDescription('Send staff ticket management panel')
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      logger.warn(`⛔ Non‑admin ${interaction.user.tag} tried /ticket`);
      return interaction.reply({ 
        content: '❌ This command is for BYD marketing admins only.', 
        ...EPHEMERAL 
      });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    let config = await getGuildConfig(guildId);

    // ---- Category setup ----
    if (sub === 'category') {
      const category = interaction.options.getChannel('category');
      if (category.type !== ChannelType.GuildCategory) {
        return interaction.reply({ 
          content: '❌ Must be a category (folder).', 
          ...EPHEMERAL 
        });
      }
      config.ticket_category_id = category.id;
      await setGuildConfig(guildId, config);
      logger.success(`Ticket category set to "${category.name}" in guild ${guildId}`);
      return interaction.reply({ 
        content: `✅ Ticket category set to ${category.name}`, 
        ...EPHEMERAL 
      });
    }

    // ---- Logs channel setup ----
    if (sub === 'logs') {
      const channel = interaction.options.getChannel('channel');
      if (channel.type !== ChannelType.GuildText) {
        return interaction.reply({ 
          content: '❌ Must be a text channel.', 
          ...EPHEMERAL 
        });
      }
      config.ticket_logs_channel_id = channel.id;
      await setGuildConfig(guildId, config);
      logger.success(`Ticket logs channel set to #${channel.name}`);
      return interaction.reply({ 
        content: `✅ Logs channel set to ${channel.name}`, 
        ...EPHEMERAL 
      });
    }

    // ---- Staff role setup ----
    if (sub === 'staffrole') {
      const role = interaction.options.getRole('role');
      config.staff_role_id = role.id;
      await setGuildConfig(guildId, config);
      logger.success(`Staff role set to "${role.name}"`);
      return interaction.reply({ 
        content: `✅ Staff role set to ${role.name}`, 
        ...EPHEMERAL 
      });
    }

    // ---- Staff panel ----
    if (sub === 'panel') {
      const openTickets = await getOpenTicketsByGuild(guildId);
      const panel = getStaffTicketPanel(openTickets);
      return interaction.reply(panel);
    }

    // ---- Setup the public ticket panel ----
    if (sub === 'setup') {
      // Validation
      if (!config.ticket_category_id) {
        return interaction.reply({ 
          content: '❌ Missing ticket category. Use `/ticket category` first.', 
          ...EPHEMERAL 
        });
      }
      if (!config.staff_role_id) {
        return interaction.reply({ 
          content: '❌ Missing staff role. Use `/ticket staffrole` first.', 
          ...EPHEMERAL 
        });
      }

      const embed = createTicketPanelEmbed();
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
  },
  
  // ============================================
  // BUTTON HANDLERS
  // ============================================
  async handleButton(interaction) {
    if (interaction.customId === 'create_ticket') {
      const modal = createTicketModal();
      await interaction.showModal(modal);
      return true;
    }
    
    if (interaction.customId === 'ticket_close') {
      // Check if user is staff or ticket owner
      const isStaffMember = await isStaffOrAbove(interaction.member);
      const isTicketOwner = interaction.channel.name.startsWith('ticket-') && 
        interaction.channel.permissionsFor(interaction.user)?.has('ViewChannel');
      
      if (!isStaffMember && !isTicketOwner) {
        await interaction.reply({ 
          content: '❌ Only staff members or the ticket owner can close this ticket.', 
          ...EPHEMERAL 
        });
        return true;
      }
      
      // Ask for resolution reason
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
      const modal = new ModalBuilder()
        .setCustomId('ticket_close_modal')
        .setTitle('Close Ticket');
      
      const resolutionInput = new TextInputBuilder()
        .setCustomId('resolution')
        .setLabel('Resolution Reason (optional)')
        .setPlaceholder('Issue resolved, customer satisfied, etc.')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);
      
      modal.addComponents(new ActionRowBuilder().addComponents(resolutionInput));
      await interaction.showModal(modal);
      return true;
    }
    
    if (interaction.customId === 'ticket_transcript') {
      // Generate transcript
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const transcript = messages.reverse().map(m => 
        `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content || '(embed/attachment)'}`
      ).join('\n');
      
      await interaction.reply({
        content: '📄 Transcript generated:',
        files: [{ name: `transcript-${interaction.channel.name}.txt`, attachment: Buffer.from(transcript) }],
        ...EPHEMERAL
      });
      return true;
    }
    
    if (interaction.customId === 'ticket_claim') {
      const isStaffMember = await isStaffOrAbove(interaction.member);
      if (!isStaffMember) {
        await interaction.reply({ 
          content: '❌ Only staff members can claim tickets.', 
          ...EPHEMERAL 
        });
        return true;
      }
      
      // Get ticket ID from channel name or database
      const ticketId = interaction.channel.name.split('-').pop();
      await assignTicket(ticketId, interaction.user.id);
      
      await interaction.reply({ 
        content: `✅ **Ticket Claimed!**\n\nYou have been assigned to this ticket. Please assist the user.`, 
        ...EPHEMERAL 
      });
      
      await interaction.channel.send({ 
        content: `👑 **${interaction.user.tag}** has claimed this ticket and will assist you shortly.` 
      });
      
      return true;
    }
    
    return false;
  },
  
  // ============================================
  // MODAL HANDLERS
  // ============================================
  async handleModal(interaction) {
    if (interaction.customId === 'ticket_create_modal') {
      const category = interaction.fields.getTextInputValue('ticket_category').toLowerCase();
      const priority = interaction.fields.getTextInputValue('ticket_priority').toLowerCase();
      const subject = interaction.fields.getTextInputValue('ticket_subject');
      const description = interaction.fields.getTextInputValue('ticket_description');
      
      // Validate category
      if (!TICKET_CATEGORIES[category]) {
        return interaction.reply({ 
          content: `❌ Invalid category. Available: ${Object.keys(TICKET_CATEGORIES).join(', ')}`, 
          ...EPHEMERAL 
        });
      }
      
      // Validate priority
      if (!TICKET_PRIORITIES[priority]) {
        return interaction.reply({ 
          content: `❌ Invalid priority. Available: ${Object.keys(TICKET_PRIORITIES).join(', ')}`, 
          ...EPHEMERAL 
        });
      }
      
      await createTicket(interaction, category, priority, subject, description);
      return true;
    }
    
    if (interaction.customId === 'ticket_close_modal') {
      const resolution = interaction.fields.getTextInputValue('resolution');
      await closeTicketHandler(interaction, resolution);
      return true;
    }
    
    return false;
  }
};