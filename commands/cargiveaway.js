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
};

const DEFAULT_SHIPPING = 1999;
const DEFAULT_DOC_FEE = 499;
const PAYMENT_DEADLINE_HOURS = 72;
const EPHEMERAL = { flags: MessageFlags.Ephemeral };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cargiveaway')
    .setDescription('🚗 BYD Car Giveaway System')
    .addSubcommand(sub => 
      sub.setName('start')
        .setDescription('Start a BYD car giveaway')
        .addStringOption(opt => opt.setName('model').setDescription('BYD model to give away').setRequired(true).addChoices(...Object.keys(carModels).map(m => ({ name: m, value: m }))))
        .addIntegerOption(opt => opt.setName('shipping').setDescription(`Shipping cost (default: $${DEFAULT_SHIPPING.toLocaleString()})`).setRequired(false))
        .addIntegerOption(opt => opt.setName('doc_fee').setDescription(`Documentation fee (default: $${DEFAULT_DOC_FEE})`).setRequired(false))
        .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in hours (24-720)').setRequired(false).setMinValue(24).setMaxValue(720))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners (1-10)').setRequired(false).setMinValue(1).setMaxValue(10))
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post the giveaway').setRequired(false))
        .addIntegerOption(opt => opt.setName('entry_fee').setDescription('Entry fee (0 = free)').setRequired(false).setMinValue(0))
    )
    .addSubcommand(sub => sub.setName('end').setDescription('End giveaway & auto-pick winners').addStringOption(opt => opt.setName('message_id').setDescription('Message ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('select').setDescription('👑 Admin picks winner manually').addStringOption(opt => opt.setName('message_id').setDescription('Message ID').setRequired(true)).addUserOption(opt => opt.setName('user').setDescription('Select winner').setRequired(true)))
    .addSubcommand(sub => sub.setName('paid').setDescription('💰 Mark winner as paid').addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true)).addUserOption(opt => opt.setName('user').setDescription('Winner user').setRequired(true)))
    .addSubcommand(sub => sub.setName('reroll').setDescription('🔄 Reroll a winner').addStringOption(opt => opt.setName('message_id').setDescription('Message ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('📋 List active car giveaways'))
    .addSubcommand(sub => sub.setName('leads').setDescription('📧 Export all leads from a giveaway').addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))),

  async execute(interaction) {
    if (!await isStaffOrAbove(interaction.member)) {
      return interaction.reply({ content: '❌ This command requires Staff permissions or higher.', ...EPHEMERAL });
    }
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    switch (sub) {
      case 'start': await startCarGiveaway(interaction, guildId); break;
      case 'end': await endCarGiveaway(interaction); break;
      case 'select': await adminSelectWinner(interaction); break;
      case 'paid': await markWinnerPaid(interaction); break;
      case 'reroll': await rerollCarGiveaway(interaction); break;
      case 'list': await listCarGiveaways(interaction, guildId); break;
      case 'leads': await exportLeads(interaction); break;
    }
  }
};

// ============================================
// HELPER: Get all admin/staff users for a guild
// ============================================
async function getAdminUsers(guild) {
  const admins = [];
  try { const owner = await guild.fetchOwner(); admins.push(owner); } catch {}
  const adminMembers = guild.members.cache.filter(m => m.permissions.has('Administrator') && m.id !== guild.ownerId);
  for (const [, member] of adminMembers) admins.push(member);
  try {
    const config = await getGuildConfig(guild.id);
    if (config?.staff_role_id) {
      const staffRole = guild.roles.cache.get(config.staff_role_id);
      if (staffRole) for (const [, member] of staffRole.members) if (!admins.some(a => a.id === member.id)) admins.push(member);
    }
  } catch {}
  return admins;
}

// ============================================
// START CAR GIVEAWAY
// ============================================
async function startCarGiveaway(interaction, guildId) {
  const model = interaction.options.getString('model');
  const shippingCost = interaction.options.getInteger('shipping') || DEFAULT_SHIPPING;
  const docFee = interaction.options.getInteger('doc_fee') || DEFAULT_DOC_FEE;
  const durationHours = interaction.options.getInteger('duration') || 168;
  const winnersCount = interaction.options.getInteger('winners') || 1;
  const entryFee = interaction.options.getInteger('entry_fee') || 0;
  const channel = interaction.options.getChannel('channel') || interaction.channel;
  const endTime = new Date(Date.now() + durationHours * 60 * 60 * 1000);
  
  await interaction.deferReply(EPHEMERAL);
  const carData = carModels[model];
  if (!carData) return interaction.editReply({ content: '❌ Invalid model.' });

  const totalWinnerCost = shippingCost + docFee;
  const year = new Date().getFullYear();
  const guild = interaction.guild;
  const config = await getGuildConfig(guildId);

  let leadCategory = guild.channels.cache.find(c => c.name === '🎁 Giveaway Leads' && c.type === ChannelType.GuildCategory);
  if (!leadCategory) leadCategory = await guild.channels.create({ name: '🎁 Giveaway Leads', type: ChannelType.GuildCategory });

  const leadThread = await guild.channels.create({
    name: `🎁 ${model} Giveaway Leads`,
    type: ChannelType.GuildText,
    parent: leadCategory.id,
    permissionOverwrites: [
      { id: guild.id, deny: ['ViewChannel'] },
      { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
      { id: interaction.client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
    ],
  });
  if (config?.staff_role_id) await leadThread.permissionOverwrites.create(config.staff_role_id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });

  await leadThread.send({ embeds: [new EmbedBuilder().setTitle(`🎁 BYD ${model} Giveaway - Lead Tracker`).setDescription(`All entries for the **${year} BYD ${model}** giveaway will appear here.\n\n• **Value:** $${carData.msrp.toLocaleString()}\n• **Winner Cost:** $${totalWinnerCost.toLocaleString()}\n• **Ends:** <t:${Math.floor(endTime / 1000)}:R>`).setColor(carData.color || '#FFD700')] });

  let entryCategory = guild.channels.cache.find(c => c.name === '🎁 Giveaway Entries' && c.type === ChannelType.GuildCategory);
  if (!entryCategory) entryCategory = await guild.channels.create({ name: '🎁 Giveaway Entries', type: ChannelType.GuildCategory });

  const embed = new EmbedBuilder()
    .setTitle('🚗 **OFFICIAL BYD CAR GIVEAWAY!** 🚗')
    .setDescription(`# 🎁 Win a ${year} BYD ${model}!\n\n### 📊 Vehicle Specs:\n• **MSRP:** $${carData.msrp.toLocaleString()}\n• **Range:** ${carData.range}\n• **Type:** ${carData.type}\n\n### ✨ How to Enter:\nClick **"ENTER GIVEAWAY"** below.\n\n### 📋 Winner Pays:\n• Shipping: $${shippingCost.toLocaleString()}\n• Doc Fee: $${docFee.toLocaleString()}\n• **Total:** $${totalWinnerCost.toLocaleString()}\n\n### ⏰ Ends:\n<t:${Math.floor(endTime / 1000)}:R>\n\n### 👑 Winners: **${winnersCount}**\n\n${entryFee > 0 ? `### 💵 Entry Fee: $${entryFee}\n\n` : ''}*18+ with valid license required.*`)
    .setColor(carData.color || '#FFD700')
    .setThumbnail('https://cdn.byd.com/bot/byd-logo.png')
    .setFooter({ text: `Hosted by ${interaction.user.tag} • Winner cost: $${totalWinnerCost.toLocaleString()}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp(endTime);

  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cargiveaway_enter').setLabel(entryFee > 0 ? `🚗 ENTER - $${entryFee}` : '🚗 ENTER FOR FREE').setStyle(ButtonStyle.Success).setEmoji('🎁'));
  const message = await channel.send({ content: await getGiveawayPingContent(guildId), embeds: [embed], components: [row] });
  
  const result = await pool.query(`INSERT INTO car_giveaways (guild_id, channel_id, message_id, car_model, car_year, msrp, shipping_cost, documentation_fee, winners_count, entry_fee, end_time, hosted_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`, [guildId, channel.id, message.id, model, year, carData.msrp, shippingCost, docFee, winnersCount, entryFee, endTime, interaction.user.id]);
  await pool.query('UPDATE car_giveaways SET payment_status = $2 WHERE id = $1', [result.rows[0].id, JSON.stringify({ leadThreadId: leadThread.id, entryCategoryId: entryCategory.id })]);

  await interaction.editReply({ content: `✅ **BYD ${model} Giveaway Started!**\n\n• Channel: ${channel}\n• Value: $${carData.msrp.toLocaleString()}\n• Duration: ${durationHours}h\n• Winners: ${winnersCount}\n• Lead Thread: ${leadThread}\n• Entry Channels: ${entryCategory}` });
  logger.success(`🚗 Car giveaway started: BYD ${model} (ID: ${result.rows[0].id})`);
}

// ============================================
// EXPORT LEADS
// ============================================
async function exportLeads(interaction) {
  const messageId = interaction.options.getString('message_id');
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1', [messageId]);
  const giveaway = res.rows[0];
  if (!giveaway) return interaction.reply({ content: '❌ Giveaway not found.', ...EPHEMERAL });
  const entriesRes = await pool.query('SELECT * FROM car_giveaway_entries WHERE giveaway_id = $1 ORDER BY entered_at ASC', [giveaway.id]);
  const entries = entriesRes.rows;
  if (entries.length === 0) return interaction.reply({ content: '❌ No entries.', ...EPHEMERAL });

  const embed = new EmbedBuilder().setTitle(`📋 Leads: ${giveaway.car_year} BYD ${giveaway.car_model}`).setDescription(`Total: **${entries.length}**\n\n${entries.map((e, i) => `**${i + 1}.** <@${e.user_id}>\n📧 ${e.user_email || 'N/A'}\n📱 ${e.user_phone || 'N/A'}\n🕐 <t:${Math.floor(new Date(e.entered_at).getTime() / 1000)}:R>`).join('\n\n')}`).setColor('#FFD700').setTimestamp();

  let csvData = 'Name,User ID,Email,Phone,Entered At\n';
  for (const e of entries) { const user = await interaction.client.users.fetch(e.user_id).catch(() => null); csvData += `"${user?.tag || 'Unknown'}",${e.user_id},${e.user_email || ''},${e.user_phone || ''},${e.entered_at}\n`; }

  await interaction.reply({ embeds: [embed], ...EPHEMERAL });
  if (entries.length > 0) await interaction.followUp({ content: '📎 CSV export:', files: [{ name: `leads-${giveaway.car_model}.csv`, attachment: Buffer.from(csvData) }], ...EPHEMERAL });
}

// ============================================
// END GIVEAWAY (RANDOM)
// ============================================
async function endCarGiveaway(interaction) {
  const messageId = interaction.options.getString('message_id');
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = false', [messageId]);
  if (!res.rows[0]) return interaction.reply({ content: '❌ Giveaway not found.', ...EPHEMERAL });
  await interaction.deferReply(EPHEMERAL);
  await selectCarWinners(interaction, res.rows[0], false);
}

// ============================================
// REROLL GIVEAWAY
// ============================================
async function rerollCarGiveaway(interaction) {
  const messageId = interaction.options.getString('message_id');
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = true', [messageId]);
  if (!res.rows[0]) return interaction.reply({ content: '❌ Giveaway not found.', ...EPHEMERAL });
  await interaction.deferReply(EPHEMERAL);
  await selectCarWinners(interaction, res.rows[0], true, res.rows[0].winners || []);
}

// ============================================
// RANDOM WINNER SELECTION
// ============================================
async function selectCarWinners(interaction, giveaway, isReroll = false, excludeWinners = []) {
  const entriesRes = await pool.query('SELECT user_id, user_email, user_phone FROM car_giveaway_entries WHERE giveaway_id = $1', [giveaway.id]);
  let entries = entriesRes.rows;
  if (isReroll && excludeWinners.length > 0) entries = entries.filter(e => !excludeWinners.includes(e.user_id));
  
  const channel = await interaction.client.channels.fetch(giveaway.channel_id).catch(() => null);
  const originalMessage = channel ? await channel.messages.fetch(giveaway.message_id).catch(() => null) : null;
  
  if (entries.length === 0) {
    if (originalMessage) await originalMessage.edit({ embeds: [new EmbedBuilder().setTitle('🚗 BYD Car Giveaway Ended').setDescription(`**Prize:** ${giveaway.car_year} BYD ${giveaway.car_model}\n**Value:** $${giveaway.msrp.toLocaleString()}\n\n❌ No one entered!`).setColor('#FF0000').setTimestamp()], components: [] });
    await pool.query('UPDATE car_giveaways SET ended = true WHERE id = $1', [giveaway.id]);
    return interaction.editReply({ content: '❌ No entrants.' });
  }

  const shuffled = [...entries.map(e => e.user_id)].sort(() => 0.5 - Math.random());
  const winners = shuffled.slice(0, giveaway.winners_count);
  const totalCost = giveaway.shipping_cost + giveaway.documentation_fee;
  
  if (originalMessage) {
    await originalMessage.edit({ embeds: [new EmbedBuilder().setTitle(`🚗 ${isReroll ? '🔄 REROLL - ' : ''}BYD CAR GIVEAWAY WINNER! 🚗`).setDescription(`## 🏆 CONGRATULATIONS!\n\n**Prize:** ${giveaway.car_year} BYD ${giveaway.car_model}\n**MSRP:** $${giveaway.msrp.toLocaleString()}\n\n### 👑 Winner(s):\n${winners.map(id => `<@${id}>`).join('\n')}\n\n### 📋 Next Steps:\n• Winners DM'd\n• **Payment:** $${totalCost.toLocaleString()}\n• **Deadline:** ${PAYMENT_DEADLINE_HOURS}h`).setColor('#00FF00').setFooter({ text: `BYD Official • ${isReroll ? 'Rerolled' : 'Ended'}` }).setTimestamp()], components: [] });
    await originalMessage.reply({ content: `🎉 ${winners.map(id => `<@${id}>`).join(', ')} - You won the **${giveaway.car_year} BYD ${giveaway.car_model}**! Check DMs!` });
  }
  
  await pool.query('UPDATE car_giveaways SET ended = true, winners = $2 WHERE id = $1', [giveaway.id, winners]);
  
  const ps = giveaway.payment_status || {};
  if (ps.leadThreadId) {
    try { const lt = await interaction.client.channels.fetch(ps.leadThreadId); if (lt) await lt.send({ content: `🎉 **WINNER!** ${winners.map(id => `<@${id}>`).join(', ')} won the **${giveaway.car_year} BYD ${giveaway.car_model}**!` }); } catch {}
  }
  
  for (const userId of winners) {
    try {
      const user = await interaction.client.users.fetch(userId);
      await user.send({ embeds: [new EmbedBuilder().setTitle('🚗 YOU WON A BYD! 🚗').setDescription(`# 🎉 CONGRATULATIONS!\n\nYou won the **${giveaway.car_year} BYD ${giveaway.car_model}**!\n\n### 💵 Payment:\n• Shipping: $${giveaway.shipping_cost.toLocaleString()}\n• Doc Fee: $${giveaway.documentation_fee.toLocaleString()}\n• **Total:** $${totalCost.toLocaleString()}\n\n### ⚠️ ${PAYMENT_DEADLINE_HOURS}h to pay\n\nReply **CLAIM** to get started!`).setColor('#00FF00')] });
    } catch {}
  }
  
  await interaction.editReply({ content: `✅ **Winners!**\n\n🏆 ${winners.map(id => `<@${id}>`).join(', ')}\n\n• Entries: ${entries.length}\n• Cost: $${totalCost.toLocaleString()}` });
}

// ============================================
// ADMIN SELECTS WINNER MANUALLY
// ============================================
async function adminSelectWinner(interaction) {
  const messageId = interaction.options.getString('message_id');
  const winnerUser = interaction.options.getUser('user');
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1', [messageId]);
  const giveaway = res.rows[0];
  if (!giveaway) return interaction.reply({ content: '❌ Giveaway not found. Check the ID from /cargiveaway list.', ...EPHEMERAL });
  if (giveaway.ended) return interaction.reply({ content: '❌ This giveaway has already ended.', ...EPHEMERAL });
  
  const entryCheck = await pool.query('SELECT * FROM car_giveaway_entries WHERE giveaway_id = $1 AND user_id = $2', [giveaway.id, winnerUser.id]);
  if (entryCheck.rows.length === 0) return interaction.reply({ content: `❌ <@${winnerUser.id}> has not entered this giveaway.`, ...EPHEMERAL });
  
  const totalCost = giveaway.shipping_cost + giveaway.documentation_fee;
  const currentWinners = giveaway.winners || [];
  if (currentWinners.includes(winnerUser.id)) return interaction.reply({ content: `⚠️ <@${winnerUser.id}> is already a winner.`, ...EPHEMERAL });
  currentWinners.push(winnerUser.id);
  
  await pool.query('UPDATE car_giveaways SET ended = true, winners = $2 WHERE id = $1', [giveaway.id, currentWinners]);
  
  try {
    const channel = await interaction.client.channels.fetch(giveaway.channel_id);
    const msg = await channel.messages.fetch(giveaway.message_id);
    await msg.edit({ embeds: [new EmbedBuilder().setTitle('🚗 BYD CAR GIVEAWAY WINNER! 🚗').setDescription(`## 🏆 CONGRATULATIONS!\n\n**Prize:** ${giveaway.car_year} BYD ${giveaway.car_model}\n**MSRP:** $${giveaway.msrp.toLocaleString()}\n\n### 👑 Winner:\n<@${winnerUser.id}>\n\n### 📋 Payment Due:\n• Shipping: $${giveaway.shipping_cost.toLocaleString()}\n• Doc Fee: $${giveaway.documentation_fee.toLocaleString()}\n• **Total:** $${totalCost.toLocaleString()}\n\n*Winner will be DM'd for payment.*`).setColor('#00FF00').setFooter({ text: `Selected by ${interaction.user.tag}` }).setTimestamp()], components: [] });
    await msg.reply({ content: `🎉 <@${winnerUser.id}> - You won the **${giveaway.car_year} BYD ${giveaway.car_model}**! Check DMs!` });
  } catch {}
  
  const ps = giveaway.payment_status || {};
  if (ps.leadThreadId) { try { const lt = await interaction.client.channels.fetch(ps.leadThreadId); if (lt) await lt.send({ content: `🎉 **WINNER!** <@${winnerUser.id}> won the **${giveaway.car_year} BYD ${giveaway.car_model}**! Selected by ${interaction.user.tag}` }); } catch {} }
  
  try { await winnerUser.send({ embeds: [new EmbedBuilder().setTitle('🚗 YOU WON A BYD! 🚗').setDescription(`# 🎉 CONGRATULATIONS!\n\nYou won the **${giveaway.car_year} BYD ${giveaway.car_model}**!\n\n### 💵 Payment:\n• Shipping: $${giveaway.shipping_cost.toLocaleString()}\n• Doc Fee: $${giveaway.documentation_fee.toLocaleString()}\n• **Total:** $${totalCost.toLocaleString()}\n\n### ⚠️ ${PAYMENT_DEADLINE_HOURS}h to pay\n\nReply **CLAIM** to get started!`).setColor('#00FF00')] }); } catch {}
  
  await interaction.reply({ content: `✅ **Winner Selected!**\n\n• Winner: ${winnerUser.tag}\n• Vehicle: ${giveaway.car_year} BYD ${giveaway.car_model}\n• Amount Due: $${totalCost.toLocaleString()}\n• Winner has been DM'd.`, ...EPHEMERAL });
  logger.success(`Winner manually selected: ${winnerUser.tag} for ${giveaway.car_model} by ${interaction.user.tag}`);
}

// ============================================
// MARK WINNER AS PAID
// ============================================
async function markWinnerPaid(interaction) {
  const messageId = interaction.options.getString('message_id');
  const winnerUser = interaction.options.getUser('user');
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = true', [messageId]);
  const giveaway = res.rows[0];
  if (!giveaway) return interaction.reply({ content: '❌ Giveaway not found or not ended yet.', ...EPHEMERAL });
  if (!giveaway.winners?.includes(winnerUser.id)) return interaction.reply({ content: '❌ Not a winner of this giveaway.', ...EPHEMERAL });
  
  const totalCost = giveaway.shipping_cost + giveaway.documentation_fee;
  const ps = giveaway.payment_status || {};
  ps[winnerUser.id] = { paid: true, processedBy: interaction.user.id, processedAt: new Date().toISOString() };
  await pool.query('UPDATE car_giveaways SET payment_status = $2 WHERE id = $1', [giveaway.id, JSON.stringify(ps)]);
  
  await interaction.reply({ content: `✅ **Paid!**\n\n• Winner: ${winnerUser.tag}\n• Vehicle: ${giveaway.car_year} BYD ${giveaway.car_model}\n• Collected: $${totalCost.toLocaleString()}`, ...EPHEMERAL });
  await winnerUser.send({ embeds: [new EmbedBuilder().setTitle('📦 Payment Confirmed!').setDescription(`# ✅ Paid!\n\nYour **${giveaway.car_year} BYD ${giveaway.car_model}** is being prepared.\n\nDelivery specialist contacts you within 24-48h.`).setColor('#00FF00')] }).catch(() => {});
  logger.success(`Payment processed for ${winnerUser.tag} - ${giveaway.car_model}`);
}

// ============================================
// LIST ACTIVE GIVEAWAYS
// ============================================
async function listCarGiveaways(interaction, guildId) {
  const res = await pool.query('SELECT * FROM car_giveaways WHERE guild_id = $1 AND ended = false ORDER BY end_time ASC', [guildId]);
  if (res.rows.length === 0) return interaction.reply({ content: '📭 No active giveaways.', ...EPHEMERAL });
  const embed = new EmbedBuilder().setTitle('🚗 Active Car Giveaways').setColor('#FFD700').setTimestamp();
  for (const gw of res.rows) {
    const c = await pool.query('SELECT COUNT(*) as count FROM car_giveaway_entries WHERE giveaway_id = $1', [gw.id]);
    embed.addFields({ name: `${gw.car_year} BYD ${gw.car_model}`, value: `• Value: $${gw.msrp.toLocaleString()}\n• Entries: ${c.rows[0]?.count || 0}\n• Ends: <t:${Math.floor(new Date(gw.end_time).getTime() / 1000)}:R>\n• ID: ${gw.message_id}`, inline: true });
  }
  await interaction.reply({ embeds: [embed], ...EPHEMERAL });
}

// ============================================
// PING CONTENT
// ============================================
async function getGiveawayPingContent(guildId) {
  try { const c = await getGuildConfig(guildId); if (c?.giveaway_ping_role_id) return `<@&${c.giveaway_ping_role_id}> 🚗 **NEW CAR GIVEAWAY!**`; } catch {}
  return '🚗 **NEW CAR GIVEAWAY!**';
}

// ============================================
// BUTTON HANDLER
// ============================================
async function handleCarGiveawayButton(interaction) {
  if (interaction.customId !== 'cargiveaway_enter') return false;
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = false', [interaction.message.id]);
  const giveaway = res.rows[0];
  if (!giveaway) return interaction.reply({ content: '❌ Giveaway ended.', ...EPHEMERAL });
  const existing = await pool.query('SELECT * FROM car_giveaway_entries WHERE giveaway_id = $1 AND user_id = $2', [giveaway.id, interaction.user.id]);
  if (existing.rows.length > 0) return interaction.reply({ content: '✅ Already entered! 🍀', ...EPHEMERAL });
  
  const modal = new ModalBuilder().setCustomId('cargiveaway_entry_modal').setTitle(`Enter: BYD ${giveaway.car_model}`);
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('email').setLabel('Email').setPlaceholder('you@email.com').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('phone').setLabel('Phone (optional)').setPlaceholder('(555) 123-4567').setStyle(TextInputStyle.Short).setRequired(false)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('terms').setLabel('Type "I AGREE"').setPlaceholder('I AGREE').setStyle(TextInputStyle.Short).setRequired(true).setMinLength(6).setMaxLength(7))
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
  
  if (terms.toUpperCase() !== 'I AGREE') {
    return interaction.editReply({ content: '❌ Type "I AGREE" to accept.' });
  }
  
  const messageId = interaction.message?.id;
  if (!messageId) return interaction.editReply({ content: '❌ Error. Try again.' });
  
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = false', [messageId]);
  const giveaway = res.rows[0];
  if (!giveaway) return interaction.editReply({ content: '❌ Giveaway ended.' });
  
  await pool.query('INSERT INTO car_giveaway_entries (giveaway_id, user_id, user_email, user_phone, agreed_to_terms) VALUES ($1,$2,$3,$4,$5)', [giveaway.id, interaction.user.id, email, phone || null, true]);
  
  const guild = interaction.guild;
  const config = await getGuildConfig(guild.id);
  const ps = giveaway.payment_status || {};
  
  let entryCategory = guild.channels.cache.find(c => c.name === '🎁 Giveaway Entries' && c.type === ChannelType.GuildCategory);
  if (ps.entryCategoryId) entryCategory = guild.channels.cache.get(ps.entryCategoryId) || entryCategory;
  if (!entryCategory) entryCategory = await guild.channels.create({ name: '🎁 Giveaway Entries', type: ChannelType.GuildCategory });
  
  const entryChannel = await guild.channels.create({
    name: `entry-${interaction.user.username}-${giveaway.car_model}`,
    type: ChannelType.GuildText,
    parent: entryCategory.id,
    permissionOverwrites: [
      { id: guild.id, deny: ['ViewChannel'] },
      { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
      { id: interaction.client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
    ],
  });
  
  if (config?.staff_role_id) {
    await entryChannel.permissionOverwrites.create(config.staff_role_id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
  }
  
  const admins = await getAdminUsers(guild);
  for (const admin of admins) {
    try { await entryChannel.permissionOverwrites.create(admin.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }); } catch {}
  }
  
  const welcomeEmbed = new EmbedBuilder()
    .setTitle('🎁 Giveaway Entry Confirmed!')
    .setDescription(`Welcome <@${interaction.user.id}>! Your entry has been recorded.\n\n### 📋 Entry Details:\n• **Giveaway:** ${giveaway.car_year} BYD ${giveaway.car_model}\n• **Value:** $${giveaway.msrp.toLocaleString()}\n• **Email:** ${email}\n• **Phone:** ${phone || 'N/A'}\n• **Entry Fee:** $${(giveaway.entry_fee || 0).toLocaleString()}\n\n### ⏰ Ends:\n<t:${Math.floor(new Date(giveaway.end_time).getTime() / 1000)}:R>\n\n### 📋 What's Next:\n• Winners will be announced here\n• Admins may contact you for verification\n• Check back for updates\n\n🍀 **Good luck!**`)
    .setColor('#FFD700')
    .setThumbnail(interaction.user.displayAvatarURL())
    .setFooter({ text: `Entry #${giveaway.id} • BYD Official Giveaway` })
    .setTimestamp();
  
  const adminRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`verify_entry_${giveaway.id}_${interaction.user.id}`).setLabel('✅ Verify').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`contact_entry_${giveaway.id}_${interaction.user.id}`).setLabel('📩 Contact').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`disqualify_entry_${giveaway.id}_${interaction.user.id}`).setLabel('❌ Disqualify').setStyle(ButtonStyle.Danger)
  );
  
  await entryChannel.send({ content: `Welcome <@${interaction.user.id}>! Staff will review your entry shortly.`, embeds: [welcomeEmbed], components: [adminRow] });
  
  if (ps.leadThreadId) {
    try {
      const leadThread = await interaction.client.channels.fetch(ps.leadThreadId);
      if (leadThread) {
        await leadThread.send({ embeds: [new EmbedBuilder().setTitle('🆕 New Entry!').setDescription(`**User:** ${interaction.user.tag} (<@${interaction.user.id}>)\n**Email:** ${email}\n**Phone:** ${phone || 'N/A'}\n**Entered:** <t:${Math.floor(Date.now() / 1000)}:R>\n**Channel:** ${entryChannel}`).setColor('#00FF00').setThumbnail(interaction.user.displayAvatarURL()).setTimestamp()] });
      }
    } catch {}
  }
  
  try { await interaction.user.send({ embeds: [new EmbedBuilder().setTitle('✅ Entry Confirmed!').setDescription(`You're entered to win the **${giveaway.car_year} BYD ${giveaway.car_model}**!\n\n• Value: $${giveaway.msrp.toLocaleString()}\n• Ends: <t:${Math.floor(new Date(giveaway.end_time).getTime() / 1000)}:R>\n• Your channel: ${entryChannel}\n\n🍀 Good luck!`).setColor('#FFD700')] }); } catch {}
  
  await interaction.editReply({ content: `✅ **Entered!** 🎉\n\n• ${giveaway.car_year} BYD ${giveaway.car_model}\n• Value: $${giveaway.msrp.toLocaleString()}\n• Ends: <t:${Math.floor(new Date(giveaway.end_time).getTime() / 1000)}:R>\n• Your channel: ${entryChannel}\n\n🍀 Good luck!` });
  logger.info(`User ${interaction.user.tag} entered car giveaway ${giveaway.id} - Channel: ${entryChannel.name}`);
  return true;
}

module.exports.handleCarGiveawayButton = handleCarGiveawayButton;
module.exports.handleCarGiveawayModal = handleCarGiveawayModal;
