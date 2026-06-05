// commands/ticket.js
const { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

// 🔧 FIX: Import getUserOpenTickets for duplicate check
const { 
  getGuildConfig, 
  setGuildConfig, 
  saveTicket, 
  closeTicket, 
  getOpenTicketsByGuild, 
  assignTicket,
  getUserOpenTickets 
} = require('../utils/database');

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
      `✨ *"${getRandomTestimonial()}"*\n\n` +
      `⏰ **Response Time:** Within 1 hour (business days)\n` +
      `🔒 Your conversation is encrypted and only visible to you and our staff.`
    )
    .setColor('#00BFFF')
    .setThumbnail('https://res.cloudinary.com/dkfsr0g6x/image/upload/v1777372767/IMG_4290_u1qsxo.jpg')
    .setFooter({ 
      text: '⚡ BYD Blade Battery | Trusted by 15,000+ EV drivers', 
      iconURL: 'https://res.cloudinary.com/dkfsr0g6x/image/upload/v1777372767/IMG_4290_u1qsxo.jpg' 
    })
    .setTimestamp();
}

// ============================================
// TICKET CREATION MODAL
// ============================================
function createTicketModal() {
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
// ADMIN NOTIFICATION FUNCTION
// ============================================
async function notifyAdmins(guild, ticketId, user, categoryData, priorityData, subject, description, ticketChannel) {
  const config = await getGuildConfig(guild.id);
  let adminsNotified = 0;
  
  const notificationEmbed = new EmbedBuilder()
    .setTitle(`🔔 New Support Ticket #${ticketId}`)
    .setDescription(
      `**A new ticket requires attention**\n\n` +
      `**From:** ${user.tag} (<@${user.id}>)\n` +
      `**Category:** ${categoryData.emoji} ${categoryData.name}\n` +
      `**Priority:** ${priorityData.emoji} ${priorityData.name}\n` +
      `**Subject:** ${subject}\n` +
      `**Ticket Channel:** ${ticketChannel}\n\n` +
      `**Description:**\n>>> ${description}`
    )
    .setColor(priorityData.color)
    .setTimestamp();
  
  if (config.ticket_logs_channel_id) {
    try {
      const logsChannel = guild.channels.cache.get(config.ticket_logs_channel_id);
      if (logsChannel) {
        await logsChannel.send({ 
          content: `🔔 **New Ticket Alert!** ${config.staff_role_id ? `<@&${config.staff_role_id}>` : ''}`,
          embeds: [notificationEmbed] 
        });
        adminsNotified++;
      }
    } catch (err) {
      logger.error(`Failed to send to logs channel: ${err.message}`);
    }
  }
  
  // DM staff members (with rate‑limit consideration, still kept for completeness)
  try {
    const members = await guild.members.fetch();
    const staffMembers = members.filter(member => {
      if (member.user.bot) return false;
      return isAdmin(member) || member.roles.cache.has(config.staff_role_id);
    });
    
    for (const [memberId, member] of staffMembers) {
      if (memberId === user.id) continue;
      try {
        await member.send({ 
          content: `🔔 **New BYD Support Ticket!**`,
          embeds: [notificationEmbed]
        });
        adminsNotified++;
        await new Promise(resolve => setTimeout(resolve, 300)); // rate limit protection
      } catch (dmErr) {
        logger.debug(`Could not DM ${member.user.tag}: ${dmErr.message}`);
      }
    }
  } catch (err) {
    logger.error(`Failed to fetch members for notifications: ${err.message}`);
  }
  
  logger.info(`Notified ${adminsNotified} staff members about ticket #${ticketId}`);
  return adminsNotified;
}

// ============================================
// TICKET CREATION FUNCTION
// ============================================
async function createTicket(interaction, category, priority, subject, description) {
  const config = await getGuildConfig(interaction.guildId);
  
  if (!config.ticket_category_id) {
    return interaction.editReply({   // 🔧 FIX: use editReply because we already deferred
      content: '❌ Ticket system not configured. Please contact an administrator.', 
      ephemeral: true 
    });
  }

  // 🔧 FIX: Check for existing open tickets to prevent duplicates
  const existing = await getUserOpenTickets(interaction.user.id);
  if (existing.length > 0) {
    return interaction.editReply({
      content: '❌ You already have an open ticket. Please close it before creating a new one.',
      ephemeral: true
    });
  }
  
  const categoryData = getTicketCategory(category);
  const priorityData = getTicketPriority(priority);
  
  // 🔧 FIX: Sanitize username for channel name (spaces/special chars)
  const sanitizedUsername = interaction.user.username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'user';
  
  const ticketName = `ticket-${sanitizedUsername}-${Date.now().toString(36)}`.substring(0, 32);
  
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
  
  if (config.staff_role_id) {
    await ticketChannel.permissionOverwrites.create(config.staff_role_id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      ManageMessages: true
    });
  }
  
  // 🔧 FIX: Pass all ticket fields (priority, subject, description) to database
  const ticketId = await saveTicket(
    interaction.guildId, 
    interaction.user.id, 
    ticketChannel.id, 
    category, 
    priority, 
    subject, 
    description
  );
  
  const welcomeEmbed = new EmbedBuilder()
    .setTitle(`${priorityData.emoji} Support Ticket #${ticketId}`)
    .setDescription(
      `**Category:** ${categoryData.emoji} ${categoryData.name}\n` +
      `**Priority:** ${priorityData.emoji} ${priorityData.name}\n` +
      `**Created by:** ${interaction.user.tag} (<@${interaction.user.id}>)\n` +
      `**Subject:** ${subject}\n\n` +
      `**Description:**\n>>> ${description}\n\n` +
      `A staff member will assist you shortly. Please provide any additional details here.\n\n` +
      `🔒 This channel is only visible to you and our support team.`
    )
    .setColor(categoryData.color)
    .setFooter({ text: 'BYD Support • We respond within 1 hour during business days' })
    .setTimestamp();
  
  await ticketChannel.send({ 
    content: `🎫 **Ticket Created!** Welcome <@${interaction.user.id}>!\n${config.staff_role_id ? `<@&${config.staff_role_id}> - New ticket needs attention!` : ''}`,
    embeds: [welcomeEmbed],
    components: [getTicketCloseButtons()]
  });
  
  await notifyAdmins(
    interaction.guild, 
    ticketId, 
    interaction.user, 
    categoryData, 
    priorityData, 
    subject, 
    description, 
    ticketChannel
  );
  
  // 🔧 FIX: Use editReply because we deferred the reply earlier
  await interaction.editReply({ 
    embeds: [
      new EmbedBuilder()
        .setTitle('✅ Ticket Created Successfully!')
        .setDescription(
          `Your support ticket has been created and our team has been notified.\n\n` +
          `**Ticket #:** ${ticketId}\n` +
          `**Category:** ${categoryData.emoji} ${categoryData.name}\n` +
          `**Priority:** ${priorityData.emoji} ${priorityData.name}\n` +
          `**Subject:** ${subject}\n` +
          `**Channel:** ${ticketChannel}\n\n` +
          `⏰ Expected response time: Within 1 hour (business days)`
        )
        .setColor('#00FF00')
        .setFooter({ text: 'Thank you for contacting BYD Support!' })
        .setTimestamp()
    ]
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
  
  const config = await getGuildConfig(interaction.guildId);
  
  const messages = await channel.messages.fetch({ limit: 50 });
  const transcript = messages.reverse().map(m => 
    `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content || '(embed/attachment)'}`
  ).join('\n');
  
  const transcriptEmbed = new EmbedBuilder()
    .setTitle(`Ticket Transcript - ${channel.name}`)
    .setDescription(
      `**Closed by:** ${interaction.user.tag}\n` +
      `**Resolution:** ${resolution || 'Not provided'}\n` +
      `**Messages:** ${messages.size}\n` +
      `**Channel:** ${channel.name}`
    )
    .setColor('#FFA500')
    .setTimestamp();
  
  if (config.ticket_logs_channel_id) {
    try {
      const logsChannel = interaction.guild.channels.cache.get(config.ticket_logs_channel_id);
      if (logsChannel) {
        await logsChannel.send({ 
          embeds: [transcriptEmbed],
          files: [{ 
            name: `transcript-${channel.name}.txt`, 
            attachment: Buffer.from(transcript, 'utf-8') 
          }]
        });
      }
    } catch (err) {
      logger.error(`Failed to log transcript: ${err.message}`);
    }
  }
  
  await channel.send({ 
    embeds: [new EmbedBuilder()
      .setTitle('🔒 Ticket Closed')
      .setDescription(
        `This ticket has been closed by ${interaction.user.tag}.\n\n` +
        `**Resolution:** ${resolution || 'Issue resolved'}\n\n` +
        `The channel will be deleted in 10 seconds.`
      )
      .setColor('#FF0000')
      .setTimestamp()
    ] 
  });
  
  await closeTicket(channel.id, resolution);
  
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

    if (sub === 'panel') {
      const openTickets = await getOpenTicketsByGuild(guildId);
      const panel = getStaffTicketPanel(openTickets);
      return interaction.reply(panel);
    }

    if (sub === 'setup') {
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
      // 🔧 FIX: Defer to avoid timeout while fetching messages
      await interaction.deferReply({ ephemeral: true });
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const transcript = messages.reverse().map(m => 
        `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content || '(embed/attachment)'}`
      ).join('\n');
      
      await interaction.editReply({
        content: '📄 Transcript generated:',
        files: [{ 
          name: `transcript-${interaction.channel.name}.txt`, 
          attachment: Buffer.from(transcript, 'utf-8') 
        }]
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
      
      // 🔧 FIX: Defer to avoid timeout for DB operations
      await interaction.deferReply({ ephemeral: true });
      
      const openTickets = await getOpenTicketsByGuild(interaction.guildId);
      const ticket = openTickets.find(t => t.channel_id === interaction.channelId);
      
      if (ticket) {
        await assignTicket(ticket.id, interaction.user.id);
      }
      
      await interaction.editReply({ 
        content: `✅ **Ticket Claimed!**\n\nYou have been assigned to this ticket. Please assist the user.`
      });
      
      await interaction.channel.send({ 
        embeds: [new EmbedBuilder()
          .setDescription(`👑 **${interaction.user.tag}** has claimed this ticket and will assist you shortly.`)
          .setColor('#00FF00')
        ]
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
      // 🔧 FIX: Defer early to avoid 3-second timeout
      await interaction.deferReply({ ephemeral: true });

      const category = interaction.fields.getTextInputValue('ticket_category').toLowerCase().trim();
      const priority = interaction.fields.getTextInputValue('ticket_priority').toLowerCase().trim();
      const subject = interaction.fields.getTextInputValue('ticket_subject').trim();
      const description = interaction.fields.getTextInputValue('ticket_description').trim();
      
      if (!TICKET_CATEGORIES[category]) {
        return interaction.editReply({ 
          content: `❌ Invalid category. Available: ${Object.keys(TICKET_CATEGORIES).join(', ')}`
        });
      }
      
      if (!TICKET_PRIORITIES[priority]) {
        return interaction.editReply({ 
          content: `❌ Invalid priority. Available: ${Object.keys(TICKET_PRIORITIES).join(', ')}`
        });
      }
      
      await createTicket(interaction, category, priority, subject, description);
      return true;
    }
    
    if (interaction.customId === 'ticket_close_modal') {
      const resolution = interaction.fields.getTextInputValue('resolution').trim();
      await closeTicketHandler(interaction, resolution);
      return true;
    }
    
    return false;
  }
};