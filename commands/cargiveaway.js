// commands/cargiveaway.js
const { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  MessageFlags,
  ChannelType,
  PermissionsBitField,
} = require('discord.js');
const { isAdmin, isStaffOrAbove } = require('../utils/permissions');
const { pool, getGuildConfig } = require('../utils/database');
const logger = require('../utils/logger');

// ============================================
// CAR PRICING & MODEL DATA
// ============================================
const carModels = {
  'Seagull': { msrp: 19990, range: '250 miles', type: 'City EV', color: '#33CCFF' },
  'Dolphin': { msrp: 29990, range: '310 miles', type: 'Hatchback', color: '#00CCCC' },
  'Seal': { msrp: 39990, range: '420 miles', type: 'Sports Sedan', color: '#0066CC' },
  'ATTO 3': { msrp: 34990, range: '380 miles', type: 'Compact SUV', color: '#00CC66' },
  'Han': { msrp: 59990, range: '450 miles', type: 'Luxury Sedan', color: '#CC0000' },
  'Tang': { msrp: 49990, range: '390 miles', type: '7-Seater SUV', color: '#9933CC' },
  'Song Plus': { msrp: 42990, range: '400 miles', type: 'Family SUV', color: '#6666CC' },
  'Yuan Plus': { msrp: 37990, range: '360 miles', type: 'Crossover', color: '#339933' },
  'Seal Performance': { msrp: 48990, range: '380 miles', type: 'Performance Sedan', color: '#FF3333' },
  'Han Performance': { msrp: 69990, range: '400 miles', type: 'Luxury Sport', color: '#CC0000' },
  'Yangwang U8': { msrp: 129990, range: '450 miles', type: 'Ultra-Luxury SUV', color: '#1A1A1A' },
  'Yangwang U9': { msrp: 149990, range: '380 miles', type: 'Hypercar', color: '#FFD700' },
};

const DEFAULT_SHIPPING = 1999;
const DEFAULT_DOC_FEE = 499;
const PAYMENT_DEADLINE_HOURS = 72;
const EPHEMERAL = { flags: MessageFlags.Ephemeral };

// ============================================
// HELPER FUNCTIONS
// ============================================
async function getAdminUsers(guild) {
  const admins = [];
  
  // Server owner
  try {
    const owner = await guild.fetchOwner();
    admins.push(owner);
  } catch {}
  
  // Users with Administrator permission
  const adminMembers = guild.members.cache.filter(m => 
    m.permissions.has(PermissionsBitField.Flags.Administrator) && m.id !== guild.ownerId
  );
  for (const [, member] of adminMembers) {
    if (!admins.some(a => a.id === member.id)) admins.push(member);
  }
  
  // Staff role members
  try {
    const config = await getGuildConfig(guild.id);
    if (config?.staff_role_id) {
      const staffRole = guild.roles.cache.get(config.staff_role_id);
      if (staffRole) {
        for (const [, member] of staffRole.members) {
          if (!admins.some(a => a.id === member.id)) admins.push(member);
        }
      }
    }
  } catch {}
  
  return admins;
}

async function getGiveawayPingContent(guildId) {
  try {
    const config = await getGuildConfig(guildId);
    if (config?.giveaway_ping_role_id) {
      return `<@&${config.giveaway_ping_role_id}> 🚗 **NEW CAR GIVEAWAY!**`;
    }
  } catch {}
  return '🚗 **NEW CAR GIVEAWAY!**';
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
  if (!phone) return true;
  return /^[\d\s\-\(\)\+]{10,15}$/.test(phone);
}

// ============================================
// SLASH COMMAND DEFINITION
// ============================================
module.exports = {
  data: new SlashCommandBuilder()
    .setName('cargiveaway')
    .setDescription('🚗 BYD Car Giveaway System')
    .addSubcommand(sub => 
      sub.setName('start')
        .setDescription('Start a BYD car giveaway')
        .addStringOption(opt => opt.setName('model').setDescription('BYD model to give away').setRequired(true).addChoices(...Object.keys(carModels).map(m => ({ name: m, value: m }))))
        .addIntegerOption(opt => opt.setName('shipping').setDescription(`Shipping cost (default: $${DEFAULT_SHIPPING.toLocaleString()})`).setRequired(false))
        .addIntegerOption(opt => opt.setName('doc_fee').setDescription(`Doc fee (default: $${DEFAULT_DOC_FEE})`).setRequired(false))
        .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in hours (24-720, default: 168)').setRequired(false).setMinValue(24).setMaxValue(720))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners (1-10)').setRequired(false).setMinValue(1).setMaxValue(10))
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post the giveaway').setRequired(false))
        .addIntegerOption(opt => opt.setName('entry_fee').setDescription('Entry fee (0 = free)').setRequired(false).setMinValue(0))
        .addStringOption(opt => opt.setName('image').setDescription('Custom image URL for the giveaway embed').setRequired(false))
    )
    .addSubcommand(sub => 
      sub.setName('end')
        .setDescription('End giveaway (winners must be selected manually with /cargiveaway select)')
        .addStringOption(opt => opt.setName('message_id').setDescription('Message ID').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('select')
        .setDescription('👑 Select a winner manually (admin only)')
        .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
        .addUserOption(opt => opt.setName('user').setDescription('Select winner').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('winners')
        .setDescription('👑 Select multiple winners at once')
        .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('paid')
        .setDescription('💰 Mark winner as paid')
        .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
        .addUserOption(opt => opt.setName('user').setDescription('Winner user').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('list')
        .setDescription('📋 List active car giveaways')
    )
    .addSubcommand(sub => 
      sub.setName('entries')
        .setDescription('📋 List all entries for a giveaway')
        .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('leads')
        .setDescription('📧 Export all leads from a giveaway')
        .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
    ),

  async execute(interaction) {
    if (!await isStaffOrAbove(interaction.member)) {
      return interaction.reply({ 
        content: '❌ This command requires Staff permissions or higher.', 
        ...EPHEMERAL 
      });
    }
    
    const sub = interaction.options.getSubcommand();
    switch (sub) {
      case 'start': await startCarGiveaway(interaction); break;
      case 'end': await endCarGiveaway(interaction); break;
      case 'select': await adminSelectWinner(interaction); break;
      case 'winners': await adminSelectMultipleWinners(interaction); break;
      case 'paid': await markWinnerPaid(interaction); break;
      case 'list': await listCarGiveaways(interaction); break;
      case 'entries': await listEntries(interaction); break;
      case 'leads': await exportLeads(interaction); break;
      default: await interaction.reply({ content: '❌ Unknown subcommand.', ...EPHEMERAL });
    }
  }
};

// ============================================
// START CAR GIVEAWAY
// ============================================
async function startCarGiveaway(interaction) {
  const model = interaction.options.getString('model');
  const shippingCost = interaction.options.getInteger('shipping') || DEFAULT_SHIPPING;
  const docFee = interaction.options.getInteger('doc_fee') || DEFAULT_DOC_FEE;
  const durationHours = interaction.options.getInteger('duration') || 168;
  const winnersCount = interaction.options.getInteger('winners') || 1;
  const entryFee = interaction.options.getInteger('entry_fee') || 0;
  const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
  const customImage = interaction.options.getString('image');
  const endTime = new Date(Date.now() + durationHours * 60 * 60 * 1000);
  
  // Validate custom image URL
  let imageUrl = customImage;
  if (imageUrl && !imageUrl.startsWith('https://')) {
    return interaction.reply({ 
      content: '❌ Image URL must use HTTPS protocol.', 
      ...EPHEMERAL 
    });
  }
  
  await interaction.deferReply(EPHEMERAL);
  
  const carData = carModels[model];
  if (!carData) {
    return interaction.editReply({ content: '❌ Invalid model selected.' });
  }

  const totalWinnerCost = shippingCost + docFee;
  const year = new Date().getFullYear();
  const guild = interaction.guild;
  const config = await getGuildConfig(guild.id);
  
  // Create or get categories
  let leadCategory = guild.channels.cache.find(c => 
    c.name === '🎁 Giveaway Leads' && c.type === ChannelType.GuildCategory
  );
  if (!leadCategory) {
    leadCategory = await guild.channels.create({ 
      name: '🎁 Giveaway Leads', 
      type: ChannelType.GuildCategory 
    });
  }
  
  let entryCategory = guild.channels.cache.find(c => 
    c.name === '🎁 Giveaway Entries' && c.type === ChannelType.GuildCategory
  );
  if (!entryCategory) {
    entryCategory = await guild.channels.create({ 
      name: '🎁 Giveaway Entries', 
      type: ChannelType.GuildCategory 
    });
  }
  
  // Create lead tracking thread
  const leadThread = await guild.channels.create({
    name: `giveaway-${model.toLowerCase()}-${Date.now()}`,
    type: ChannelType.GuildText,
    parent: leadCategory.id,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
      { id: interaction.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
    ],
  });
  
  if (config?.staff_role_id) {
    await leadThread.permissionOverwrites.create(config.staff_role_id, { 
      ViewChannel: true, 
      SendMessages: true, 
      ReadMessageHistory: true 
    });
  }
  
  await leadThread.send({ 
    embeds: [new EmbedBuilder()
      .setTitle(`🎁 BYD ${model} Giveaway - Lead Tracker`)
      .setDescription(`All entries for the **${year} BYD ${model}** giveaway will appear here.\n\n• **Value:** $${carData.msrp.toLocaleString()}\n• **Winner Cost:** $${totalWinnerCost.toLocaleString()}\n• **Ends:** <t:${Math.floor(endTime / 1000)}:R>\n• **Winners to be selected:** ${winnersCount}\n\n⚠️ Winners must be selected MANUALLY using \`/cargiveaway select\` or \`/cargiveaway winners\``)
      .setColor(carData.color || '#FFD700')
      .setTimestamp()
    ] 
  });

  // Create giveaway embed
  const embed = new EmbedBuilder()
    .setTitle('🚗 **OFFICIAL BYD CAR GIVEAWAY!** 🚗')
    .setDescription(`### 🎁 Win a ${year} BYD ${model}!\n\n### 📊 Vehicle Specs:\n• **MSRP:** $${carData.msrp.toLocaleString()}\n• **Range:** ${carData.range}\n• **Type:** ${carData.type}\n\n### ✨ How to Enter:\nClick **"ENTER GIVEAWAY"** below.\n\n### 📋 Winner Pays:\n• Shipping: $${shippingCost.toLocaleString()}\n• Doc Fee: $${docFee.toLocaleString()}\n• **Total:** $${totalWinnerCost.toLocaleString()}\n\n### ⏰ Entry Deadline:\n<t:${Math.floor(endTime / 1000)}:R>\n\n### 👑 Winners to be selected: **${winnersCount}**\n\n⚠️ Winners will be announced after the entry deadline by admins.\n\n${entryFee > 0 ? `### 💵 Entry Fee: $${entryFee}\n\n` : ''}*18+ with valid driver's license required.*`)
    .setColor(carData.color || '#FFD700')
    .setThumbnail('https://cdn.byd.com/bot/byd-logo.png')
    .setTimestamp(endTime);
  
  if (imageUrl) {
    embed.setImage(imageUrl);
  }
  
  embed.setFooter({ 
    text: `Hosted by ${interaction.user.tag} • Winner cost: $${totalWinnerCost.toLocaleString()} • Winners selected manually`, 
    iconURL: interaction.user.displayAvatarURL() 
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('cargiveaway_enter')
      .setLabel(entryFee > 0 ? `🚗 ENTER - $${entryFee}` : '🚗 ENTER FOR FREE')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎁')
  );
  
  const pingContent = await getGiveawayPingContent(guild.id);
  const message = await targetChannel.send({ 
    content: pingContent, 
    embeds: [embed], 
    components: [row] 
  });
  
  // Save to database
  const result = await pool.query(
    `INSERT INTO car_giveaways (guild_id, channel_id, message_id, car_model, car_year, msrp, shipping_cost, documentation_fee, winners_count, entry_fee, end_time, hosted_by) 
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [guild.id, targetChannel.id, message.id, model, year, carData.msrp, shippingCost, docFee, winnersCount, entryFee, endTime, interaction.user.id]
  );
  
  await pool.query('UPDATE car_giveaways SET payment_status = $2 WHERE id = $1', 
    [result.rows[0].id, JSON.stringify({ leadThreadId: leadThread.id, entryCategoryId: entryCategory.id })]
  );

  await interaction.editReply({ 
    content: `✅ **BYD ${model} Giveaway Started!**\n\n• Channel: ${targetChannel}\n• Value: $${carData.msrp.toLocaleString()}\n• Duration: ${durationHours}h\n• Winners to select: ${winnersCount}\n• Lead Thread: ${leadThread}\n• Entry Category: ${entryCategory}\n\n⚠️ Remember: Winners must be selected manually after the giveaway ends using \`/cargiveaway select\` or \`/cargiveaway winners\`` 
  });
  
  logger.success(`🚗 Car giveaway started: BYD ${model} (ID: ${result.rows[0].id}) by ${interaction.user.tag}`);
}

// ============================================
// END GIVEAWAY (NO AUTO WINNER SELECTION)
// ============================================
async function endCarGiveaway(interaction) {
  const messageId = interaction.options.getString('message_id');
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = false', [messageId]);
  
  if (!res.rows[0]) {
    return interaction.reply({ content: '❌ Giveaway not found or already ended.', ...EPHEMERAL });
  }
  
  const giveaway = res.rows[0];
  await interaction.deferReply(EPHEMERAL);
  
  // Get entry count
  const entriesRes = await pool.query('SELECT COUNT(*) as count FROM car_giveaway_entries WHERE giveaway_id = $1', [giveaway.id]);
  const entryCount = entriesRes.rows[0]?.count || 0;
  
  // Mark as ended without selecting winners
  await pool.query('UPDATE car_giveaways SET ended = true WHERE id = $1', [giveaway.id]);
  
  // Update the original message
  try {
    const channel = await interaction.client.channels.fetch(giveaway.channel_id);
    const originalMessage = await channel.messages.fetch(giveaway.message_id);
    
    const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0])
      .setDescription(originalMessage.embeds[0].description + `\n\n### ⏰ GIVEAWAY ENDED!\n• Total Entries: **${entryCount}**\n• Winners will be announced soon by admins.`)
      .setColor('#FFA500');
    
    await originalMessage.edit({ 
      embeds: [updatedEmbed],
      components: [] // Remove entry button
    });
  } catch (err) {
    logger.warn(`Could not update giveaway message: ${err.message}`);
  }
  
  // Notify lead thread
  const ps = giveaway.payment_status || {};
  if (ps.leadThreadId) {
    try {
      const lt = await interaction.client.channels.fetch(ps.leadThreadId);
      if (lt) {
        await lt.send({ 
          content: `⏰ **GIVEAWAY ENDED!**\n\n• ${giveaway.car_year} BYD ${giveaway.car_model}\n• Total Entries: ${entryCount}\n• Winners: ${giveaway.winners_count}\n\nUse \`/cargiveaway select\` or \`/cargiveaway winners\` to select winners!` 
        });
      }
    } catch {}
  }
  
  await interaction.editReply({ 
    content: `✅ **Giveaway Ended!**\n\n• ${giveaway.car_year} BYD ${giveaway.car_model}\n• Total Entries: ${entryCount}\n• Winners to select: ${giveaway.winners_count}\n\nUse \`/cargiveaway select\` to select winners manually or \`/cargiveaway winners\` to select multiple at once.` 
  });
  
  logger.info(`Giveaway ${giveaway.id} ended with ${entryCount} entries. Winners pending selection.`);
}

// ============================================
// ADMIN SELECT SINGLE WINNER
// ============================================
async function adminSelectWinner(interaction) {
  const messageId = interaction.options.getString('message_id');
  const winnerUser = interaction.options.getUser('user');
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1', [messageId]);
  const giveaway = res.rows[0];
  
  if (!giveaway) {
    return interaction.reply({ content: '❌ Giveaway not found.', ...EPHEMERAL });
  }
  
  // Check if giveaway has ended
  if (!giveaway.ended) {
    return interaction.reply({ content: '⚠️ Giveaway has not ended yet. Use `/cargiveaway end` first.', ...EPHEMERAL });
  }
  
  const entryCheck = await pool.query('SELECT * FROM car_giveaway_entries WHERE giveaway_id = $1 AND user_id = $2', [giveaway.id, winnerUser.id]);
  if (entryCheck.rows.length === 0) {
    return interaction.reply({ content: `❌ <@${winnerUser.id}> has not entered this giveaway.`, ...EPHEMERAL });
  }
  
  const totalCost = giveaway.shipping_cost + giveaway.documentation_fee;
  const currentWinners = giveaway.winners || [];
  
  if (currentWinners.includes(winnerUser.id)) {
    return interaction.reply({ content: `⚠️ <@${winnerUser.id}> is already a winner.`, ...EPHEMERAL });
  }
  
  if (currentWinners.length >= giveaway.winners_count) {
    return interaction.reply({ content: `❌ Already selected ${giveaway.winners_count} winner(s). Cannot add more.`, ...EPHEMERAL });
  }
  
  currentWinners.push(winnerUser.id);
  await pool.query('UPDATE car_giveaways SET winners = $2 WHERE id = $1', [giveaway.id, currentWinners]);
  
  // Update or create announcement
  await updateWinnerAnnouncement(interaction, giveaway, currentWinners);
  
  // Notify lead thread
  const ps = giveaway.payment_status || {};
  if (ps.leadThreadId) {
    try {
      const lt = await interaction.client.channels.fetch(ps.leadThreadId);
      if (lt) {
        await lt.send({ 
          content: `👑 **WINNER SELECTED!** <@${winnerUser.id}> selected as a winner for **${giveaway.car_year} BYD ${giveaway.car_model}** by ${interaction.user.tag}\n\nSelected: ${currentWinners.length}/${giveaway.winners_count} winners` 
        });
      }
    } catch {}
  }
  
  // DM winner
  try {
    await winnerUser.send({ 
      embeds: [new EmbedBuilder()
        .setTitle('🚗 YOU WON A BYD! 🚗')
        .setDescription(`# 🎉 CONGRATULATIONS!\n\nYou have been selected as a winner of the **${giveaway.car_year} BYD ${giveaway.car_model}** giveaway!\n\n### 💵 Payment Required:\n• Shipping: $${giveaway.shipping_cost.toLocaleString()}\n• Doc Fee: $${giveaway.documentation_fee.toLocaleString()}\n• **Total:** $${totalCost.toLocaleString()}\n\n### ⚠️ You have ${PAYMENT_DEADLINE_HOURS} hours to complete payment.\n\nReply **CLAIM** in this DM to get started with payment!`)
        .setColor('#00FF00')
        .setTimestamp()
      ] 
    });
    logger.info(`Winner DM sent to ${winnerUser.tag} for ${giveaway.car_model}`);
  } catch (err) {
    logger.warn(`Could not DM winner ${winnerUser.tag}: ${err.message}`);
  }
  
  const remaining = giveaway.winners_count - currentWinners.length;
  await interaction.reply({ 
    content: `✅ **Winner Selected!**\n\n• Winner: ${winnerUser.tag}\n• Vehicle: ${giveaway.car_year} BYD ${giveaway.car_model}\n• Amount Due: $${totalCost.toLocaleString()}\n• Winner has been DM'd.\n• ${remaining} winner(s) remaining to select.`, 
    ...EPHEMERAL 
  });
  
  logger.success(`Winner manually selected: ${winnerUser.tag} for ${giveaway.car_model} by ${interaction.user.tag} (${currentWinners.length}/${giveaway.winners_count})`);
}

// ============================================
// ADMIN SELECT MULTIPLE WINNERS
// ============================================
async function adminSelectMultipleWinners(interaction) {
  const messageId = interaction.options.getString('message_id');
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1', [messageId]);
  const giveaway = res.rows[0];
  
  if (!giveaway) {
    return interaction.reply({ content: '❌ Giveaway not found.', ...EPHEMERAL });
  }
  
  if (!giveaway.ended) {
    return interaction.reply({ content: '⚠️ Giveaway has not ended yet. Use `/cargiveaway end` first.', ...EPHEMERAL });
  }
  
  const entriesRes = await pool.query('SELECT user_id, user_email, user_phone FROM car_giveaway_entries WHERE giveaway_id = $1', [giveaway.id]);
  const entries = entriesRes.rows;
  
  if (entries.length === 0) {
    return interaction.reply({ content: '❌ No entries found.', ...EPHEMERAL });
  }
  
  // Create a select menu for winners
  const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
  
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_winners_${giveaway.id}`)
    .setPlaceholder(`Select ${giveaway.winners_count} winner(s)`)
    .setMinValues(1)
    .setMaxValues(Math.min(giveaway.winners_count, 25));
  
  // Add entries to select menu (limit to 25 for Discord)
  for (const entry of entries.slice(0, 25)) {
    const user = await interaction.client.users.fetch(entry.user_id).catch(() => null);
    const label = user ? user.username : entry.user_id.substring(0, 32);
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(label.substring(0, 100))
        .setValue(entry.user_id)
        .setDescription(`Email: ${entry.user_email || 'N/A'}`)
    );
  }
  
  const row = new ActionRowBuilder().addComponents(selectMenu);
  
  await interaction.reply({
    content: `🎁 **Select Winners for ${giveaway.car_year} BYD ${giveaway.car_model}**\n\nSelect ${giveaway.winners_count} winner(s) from the dropdown below.`,
    components: [row],
    ...EPHEMERAL
  });
  
  // Create collector for selection
  const filter = i => i.user.id === interaction.user.id && i.customId === `select_winners_${giveaway.id}`;
  const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });
  
  collector.on('collect', async (selectInteraction) => {
    const selectedUserIds = selectInteraction.values;
    
    if (selectedUserIds.length !== giveaway.winners_count) {
      await selectInteraction.reply({
        content: `⚠️ You selected ${selectedUserIds.length} winner(s), but the giveaway requires ${giveaway.winners_count} winner(s). Please run the command again.`,
        ephemeral: true
      });
      return;
    }
    
    await selectInteraction.deferUpdate();
    
    // Verify all selected users entered
    const validWinners = [];
    for (const userId of selectedUserIds) {
      const entryCheck = await pool.query('SELECT * FROM car_giveaway_entries WHERE giveaway_id = $1 AND user_id = $2', [giveaway.id, userId]);
      if (entryCheck.rows.length > 0) {
        validWinners.push(userId);
      }
    }
    
    if (validWinners.length !== giveaway.winners_count) {
      await interaction.followUp({ content: '❌ Some selected users did not enter the giveaway.', ephemeral: true });
      return;
    }
    
    await pool.query('UPDATE car_giveaways SET winners = $2 WHERE id = $1', [giveaway.id, validWinners]);
    
    // Update announcement
    await updateWinnerAnnouncement(interaction, giveaway, validWinners);
    
    const totalCost = giveaway.shipping_cost + giveaway.documentation_fee;
    
    // DM all winners
    for (const userId of validWinners) {
      try {
        const user = await interaction.client.users.fetch(userId);
        await user.send({ 
          embeds: [new EmbedBuilder()
            .setTitle('🚗 YOU WON A BYD! 🚗')
            .setDescription(`# 🎉 CONGRATULATIONS!\n\nYou have been selected as a winner of the **${giveaway.car_year} BYD ${giveaway.car_model}** giveaway!\n\n### 💵 Payment Required:\n• Shipping: $${giveaway.shipping_cost.toLocaleString()}\n• Doc Fee: $${giveaway.documentation_fee.toLocaleString()}\n• **Total:** $${totalCost.toLocaleString()}\n\n### ⚠️ You have ${PAYMENT_DEADLINE_HOURS} hours to complete payment.\n\nReply **CLAIM** in this DM to get started with payment!`)
            .setColor('#00FF00')
            .setTimestamp()
          ] 
        });
      } catch (err) {
        logger.warn(`Could not DM winner ${userId}: ${err.message}`);
      }
    }
    
    // Notify lead thread
    const ps = giveaway.payment_status || {};
    if (ps.leadThreadId) {
      try {
        const lt = await interaction.client.channels.fetch(ps.leadThreadId);
        if (lt) {
          await lt.send({ 
            content: `👑 **WINNERS SELECTED!**\n\nWinners for **${giveaway.car_year} BYD ${giveaway.car_model}**:\n${validWinners.map(id => `<@${id}>`).join('\n')}\n\nSelected by ${interaction.user.tag}` 
          });
        }
      } catch {}
    }
    
    await interaction.followUp({
      content: `✅ **${validWinners.length} Winner(s) Selected!**\n\nWinners:\n${validWinners.map(id => `<@${id}>`).join('\n')}\n\nAll winners have been DM'd.`,
      ephemeral: true
    });
    
    logger.success(`Multiple winners selected for ${giveaway.car_model} by ${interaction.user.tag}: ${validWinners.length} winners`);
  });
  
  collector.on('end', (collected) => {
    if (collected.size === 0) {
      interaction.followUp({ content: '❌ Selection timed out. Please run the command again.', ephemeral: true });
    }
  });
}

// ============================================
// UPDATE WINNER ANNOUNCEMENT
// ============================================
async function updateWinnerAnnouncement(interaction, giveaway, winners) {
  try {
    const channel = await interaction.client.channels.fetch(giveaway.channel_id);
    const originalMessage = await channel.messages.fetch(giveaway.message_id);
    
    const totalCost = giveaway.shipping_cost + giveaway.documentation_fee;
    const winnersList = winners.map(id => `<@${id}>`).join(', ');
    
    const winnerEmbed = new EmbedBuilder()
      .setTitle(`🚗 BYD CAR GIVEAWAY WINNER${winners.length > 1 ? 'S' : ''}! 🚗`)
      .setDescription(`## 🏆 CONGRATULATIONS!\n\n**Prize:** ${giveaway.car_year} BYD ${giveaway.car_model}\n**MSRP:** $${giveaway.msrp.toLocaleString()}\n\n### 👑 Winner${winners.length > 1 ? 's' : ''}:\n${winnersList}\n\n### 📋 Payment Required:\n• Shipping: $${giveaway.shipping_cost.toLocaleString()}\n• Doc Fee: $${giveaway.documentation_fee.toLocaleString()}\n• **Total:** $${totalCost.toLocaleString()}\n\nWinners have been DM'd with payment instructions.`)
      .setColor('#00FF00')
      .setFooter({ text: `Selected by ${interaction.user.tag} • BYD Official` })
      .setTimestamp();
    
    await originalMessage.edit({ embeds: [winnerEmbed], components: [] });
    await originalMessage.reply({ content: `🎉 Congratulations ${winnersList}! You won the **${giveaway.car_year} BYD ${giveaway.car_model}**! Check your DMs for payment instructions!` });
  } catch (err) {
    logger.warn(`Could not update winner announcement: ${err.message}`);
  }
}

// ============================================
// MARK WINNER AS PAID
// ============================================
async function markWinnerPaid(interaction) {
  const messageId = interaction.options.getString('message_id');
  const winnerUser = interaction.options.getUser('user');
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1', [messageId]);
  const giveaway = res.rows[0];
  
  if (!giveaway) {
    return interaction.reply({ content: '❌ Giveaway not found.', ...EPHEMERAL });
  }
  
  if (!giveaway.winners?.includes(winnerUser.id)) {
    return interaction.reply({ content: '❌ This user is not a winner of this giveaway.', ...EPHEMERAL });
  }
  
  const totalCost = giveaway.shipping_cost + giveaway.documentation_fee;
  const ps = giveaway.payment_status || {};
  ps[winnerUser.id] = { 
    paid: true, 
    processedBy: interaction.user.id, 
    processedAt: new Date().toISOString(),
    amount: totalCost
  };
  
  await pool.query('UPDATE car_giveaways SET payment_status = $2 WHERE id = $1', [giveaway.id, JSON.stringify(ps)]);
  
  await interaction.reply({ 
    content: `✅ **Payment Marked as Paid!**\n\n• Winner: ${winnerUser.tag}\n• Vehicle: ${giveaway.car_year} BYD ${giveaway.car_model}\n• Collected: $${totalCost.toLocaleString()}`, 
    ...EPHEMERAL 
  });
  
  try {
    await winnerUser.send({ 
      embeds: [new EmbedBuilder()
        .setTitle('📦 Payment Confirmed!')
        .setDescription(`# ✅ Payment Received!\n\nYour **${giveaway.car_year} BYD ${giveaway.car_model}** is being prepared for delivery.\n\nA delivery specialist will contact you within 24-48 hours with shipping details.\n\nThank you for being part of the BYD family! 🚗`)
        .setColor('#00FF00')
        .setTimestamp()
      ] 
    });
  } catch (err) {
    logger.warn(`Could not DM winner about payment: ${err.message}`);
  }
  
  logger.success(`Payment processed for ${winnerUser.tag} - ${giveaway.car_model} by ${interaction.user.tag}`);
}

// ============================================
// LIST ACTIVE GIVEAWAYS
// ============================================
async function listCarGiveaways(interaction) {
  const res = await pool.query('SELECT * FROM car_giveaways WHERE guild_id = $1 AND ended = false ORDER BY end_time ASC', [interaction.guildId]);
  
  if (res.rows.length === 0) {
    return interaction.reply({ content: '📭 No active giveaways.', ...EPHEMERAL });
  }
  
  const embed = new EmbedBuilder()
    .setTitle('🚗 Active Car Giveaways')
    .setColor('#FFD700')
    .setTimestamp();
  
  for (const gw of res.rows) {
    const countRes = await pool.query('SELECT COUNT(*) as count FROM car_giveaway_entries WHERE giveaway_id = $1', [gw.id]);
    const entryCount = countRes.rows[0]?.count || 0;
    const winnersSelected = (gw.winners || []).length;
    
    embed.addFields({ 
      name: `${gw.car_year} BYD ${gw.car_model}`, 
      value: `• Value: $${gw.msrp.toLocaleString()}\n• Entries: ${entryCount}\n• Winners: ${winnersSelected}/${gw.winners_count}\n• Ends: <t:${Math.floor(new Date(gw.end_time).getTime() / 1000)}:R>\n• Ended: ${gw.ended ? '✅ Yes' : '❌ No'}\n• ID: \`${gw.message_id}\``, 
      inline: true 
    });
  }
  
  await interaction.reply({ embeds: [embed], ...EPHEMERAL });
}

// ============================================
// LIST ALL ENTRIES
// ============================================
async function listEntries(interaction) {
  const messageId = interaction.options.getString('message_id');
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1', [messageId]);
  const giveaway = res.rows[0];
  
  if (!giveaway) {
    return interaction.reply({ content: '❌ Giveaway not found.', ...EPHEMERAL });
  }
  
  const entriesRes = await pool.query('SELECT user_id, user_email, user_phone, entered_at FROM car_giveaway_entries WHERE giveaway_id = $1 ORDER BY entered_at ASC', [giveaway.id]);
  const entries = entriesRes.rows;
  
  if (entries.length === 0) {
    return interaction.reply({ content: '❌ No entries yet.', ...EPHEMERAL });
  }
  
  const embed = new EmbedBuilder()
    .setTitle(`📋 Entries: ${giveaway.car_year} BYD ${giveaway.car_model}`)
    .setDescription(`Total: **${entries.length}** entries\n\n${entries.slice(0, 20).map((e, i) => 
      `**${i + 1}.** <@${e.user_id}>\n📧 ${e.user_email || 'N/A'}\n📱 ${e.user_phone || 'N/A'}\n🕐 <t:${Math.floor(new Date(e.entered_at).getTime() / 1000)}:R>`
    ).join('\n\n')}${entries.length > 20 ? `\n\n... and ${entries.length - 20} more entries` : ''}`)
    .setColor('#FFD700')
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed], ...EPHEMERAL });
}

// ============================================
// EXPORT LEADS
// ============================================
async function exportLeads(interaction) {
  const messageId = interaction.options.getString('message_id');
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1', [messageId]);
  const giveaway = res.rows[0];
  
  if (!giveaway) {
    return interaction.reply({ content: '❌ Giveaway not found.', ...EPHEMERAL });
  }
  
  const entriesRes = await pool.query('SELECT * FROM car_giveaway_entries WHERE giveaway_id = $1 ORDER BY entered_at ASC', [giveaway.id]);
  const entries = entriesRes.rows;
  
  if (entries.length === 0) {
    return interaction.reply({ content: '❌ No entries yet.', ...EPHEMERAL });
  }

  // Create CSV export
  let csvData = 'Name,User ID,Email,Phone,Entered At,Is Winner\n';
  for (const e of entries) {
    const user = await interaction.client.users.fetch(e.user_id).catch(() => null);
    const isWinner = (giveaway.winners || []).includes(e.user_id);
    csvData += `"${user?.tag || 'Unknown'}","${e.user_id}","${e.user_email || ''}","${e.user_phone || ''}","${e.entered_at}","${isWinner ? 'YES' : 'NO'}"\n`;
  }

  await interaction.reply({ 
    content: `📎 CSV export for **${giveaway.car_year} BYD ${giveaway.car_model}** (${entries.length} entries):`, 
    files: [{ name: `entries-${giveaway.car_model.toLowerCase()}-${Date.now()}.csv`, attachment: Buffer.from(csvData) }], 
    ...EPHEMERAL 
  });
  
  logger.info(`📊 Exported ${entries.length} entries for giveaway ${giveaway.id}`);
}

// ============================================
// BUTTON HANDLER
// ============================================
async function handleCarGiveawayButton(interaction) {
  if (interaction.customId !== 'cargiveaway_enter') return false;
  
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = false', [interaction.message.id]);
  const giveaway = res.rows[0];
  
  if (!giveaway) {
    return interaction.reply({ content: '❌ This giveaway has ended.', ...EPHEMERAL });
  }
  
  const existing = await pool.query('SELECT * FROM car_giveaway_entries WHERE giveaway_id = $1 AND user_id = $2', [giveaway.id, interaction.user.id]);
  if (existing.rows.length > 0) {
    return interaction.reply({ content: '✅ You are already entered! Good luck! 🍀', ...EPHEMERAL });
  }
  
  const modal = new ModalBuilder()
    .setCustomId('cargiveaway_entry_modal')
    .setTitle(`Enter: BYD ${giveaway.car_model}`);
  
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('email')
        .setLabel('Email Address')
        .setPlaceholder('you@example.com')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('phone')
        .setLabel('Phone Number (optional)')
        .setPlaceholder('(555) 123-4567')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('terms')
        .setLabel('Type "I AGREE" to accept terms')
        .setPlaceholder('I AGREE')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(6)
        .setMaxLength(7)
    )
  );
  
  await interaction.showModal(modal);
  return true;
}

// ============================================
// MODAL HANDLER
// ============================================
async function handleCarGiveawayModal(interaction) {
  if (interaction.customId !== 'cargiveaway_entry_modal') return false;
  
  await interaction.deferReply(EPHEMERAL);
  
  const email = interaction.fields.getTextInputValue('email');
  const phone = interaction.fields.getTextInputValue('phone');
  const terms = interaction.fields.getTextInputValue('terms');
  
  // Validate inputs
  if (terms.toUpperCase() !== 'I AGREE') {
    return interaction.editReply({ content: '❌ You must type "I AGREE" to accept the terms and conditions.' });
  }
  
  if (!validateEmail(email)) {
    return interaction.editReply({ content: '❌ Please provide a valid email address.' });
  }
  
  if (phone && !validatePhone(phone)) {
    return interaction.editReply({ content: '❌ Please provide a valid phone number (10-15 digits).' });
  }
  
  const messageId = interaction.message?.id;
  if (!messageId) {
    return interaction.editReply({ content: '❌ Error: Could not identify giveaway. Please try again.' });
  }
  
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = false', [messageId]);
  const giveaway = res.rows[0];
  
  if (!giveaway) {
    return interaction.editReply({ content: '❌ This giveaway has ended.' });
  }
  
  // Check for duplicate
  const existing = await pool.query('SELECT * FROM car_giveaway_entries WHERE giveaway_id = $1 AND user_id = $2', [giveaway.id, interaction.user.id]);
  if (existing.rows.length > 0) {
    return interaction.editReply({ content: '✅ You are already entered! Good luck! 🍀' });
  }
  
  // Save entry
  await pool.query(
    'INSERT INTO car_giveaway_entries (giveaway_id, user_id, user_email, user_phone, agreed_to_terms) VALUES ($1,$2,$3,$4,$5)',
    [giveaway.id, interaction.user.id, email, phone || null, true]
  );
  
  const guild = interaction.guild;
  const config = await getGuildConfig(guild.id);
  const ps = giveaway.payment_status || {};
  
  // Create entry channel
  let entryCategory = guild.channels.cache.find(c => c.name === '🎁 Giveaway Entries');
  if (ps.entryCategoryId) {
    entryCategory = guild.channels.cache.get(ps.entryCategoryId) || entryCategory;
  }
  
  const entryChannel = await guild.channels.create({
    name: `entry-${interaction.user.username}-${giveaway.car_model.toLowerCase()}`,
    type: ChannelType.GuildText,
    parent: entryCategory?.id,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
      { id: interaction.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
    ],
  });
  
  if (config?.staff_role_id) {
    await entryChannel.permissionOverwrites.create(config.staff_role_id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
  }
  
  const admins = await getAdminUsers(guild);
  for (const admin of admins) {
    try {
      await entryChannel.permissionOverwrites.create(admin.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
    } catch {}
  }
  
  const welcomeEmbed = new EmbedBuilder()
    .setTitle('🎁 Giveaway Entry Confirmed!')
    .setDescription(`Welcome <@${interaction.user.id}>! Your entry has been recorded.\n\n### 📋 Entry Details:\n• **Giveaway:** ${giveaway.car_year} BYD ${giveaway.car_model}\n• **Value:** $${giveaway.msrp.toLocaleString()}\n• **Email:** ${email}\n• **Phone:** ${phone || 'N/A'}\n• **Entry Fee:** $${(giveaway.entry_fee || 0).toLocaleString()}\n\n### ⏰ Entry Deadline:\n<t:${Math.floor(new Date(giveaway.end_time).getTime() / 1000)}:R>\n\n### 📋 What's Next:\n• Winners will be announced after the deadline\n• Admins will select winners manually\n• You will be DM'd if selected\n• Your entry is in the pool for review\n\n🍀 **Good luck!**`)
    .setColor('#FFD700')
    .setThumbnail(interaction.user.displayAvatarURL())
    .setFooter({ text: `Entry #${giveaway.id} • BYD Official Giveaway` })
    .setTimestamp();
  
  const adminRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`verify_entry_${giveaway.id}_${interaction.user.id}`)
      .setLabel('✅ Verify')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`contact_entry_${giveaway.id}_${interaction.user.id}`)
      .setLabel('📩 Contact')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`disqualify_entry_${giveaway.id}_${interaction.user.id}`)
      .setLabel('❌ Disqualify')
      .setStyle(ButtonStyle.Danger)
  );
  
  await entryChannel.send({ 
    content: `Welcome <@${interaction.user.id}>! Staff will review your entry.`, 
    embeds: [welcomeEmbed], 
    components: [adminRow] 
  });
  
  // Notify lead thread
  if (ps.leadThreadId) {
    try {
      const leadThread = await interaction.client.channels.fetch(ps.leadThreadId);
      if (leadThread) {
        await leadThread.send({ 
          embeds: [new EmbedBuilder()
            .setTitle('🆕 New Entry!')
            .setDescription(`**User:** ${interaction.user.tag} (<@${interaction.user.id}>)\n**Email:** ${email}\n**Phone:** ${phone || 'N/A'}\n**Entered:** <t:${Math.floor(Date.now() / 1000)}:R>\n**Channel:** ${entryChannel}`)
            .setColor('#00FF00')
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp()
          ] 
        });
      }
    } catch {}
  }
  
  // DM confirmation
  try {
    await interaction.user.send({ 
      embeds: [new EmbedBuilder()
        .setTitle('✅ Entry Confirmed!')
        .setDescription(`You're entered to win the **${giveaway.car_year} BYD ${giveaway.car_model}**!\n\n• Value: $${giveaway.msrp.toLocaleString()}\n• Entry Deadline: <t:${Math.floor(new Date(giveaway.end_time).getTime() / 1000)}:R>\n• Winners will be announced after the deadline\n• Your private channel: ${entryChannel}\n\n🍀 Good luck!`)
        .setColor('#FFD700')
        .setTimestamp()
      ] 
    });
  } catch (err) {
    logger.warn(`Could not DM entry confirmation to ${interaction.user.tag}`);
  }
  
  await interaction.editReply({ 
    content: `✅ **Successfully Entered!** 🎉\n\n• ${giveaway.car_year} BYD ${giveaway.car_model}\n• Value: $${giveaway.msrp.toLocaleString()}\n• Entry Deadline: <t:${Math.floor(new Date(giveaway.end_time).getTime() / 1000)}:R>\n• Your private channel: ${entryChannel}\n\n🍀 Good luck! Winners will be announced after the deadline.` 
  });
  
  logger.info(`User ${interaction.user.tag} entered car giveaway ${giveaway.id} - Channel: ${entryChannel.name}`);
  return true;
}

module.exports.handleCarGiveawayButton = handleCarGiveawayButton;
module.exports.handleCarGiveawayModal = handleCarGiveawayModal;