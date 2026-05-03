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
        .addStringOption(opt => 
          opt.setName('model')
            .setDescription('BYD model to give away')
            .setRequired(true)
            .addChoices(...Object.keys(carModels).map(m => ({ name: m, value: m }))))
        .addIntegerOption(opt => opt.setName('shipping').setDescription(`Shipping cost (default: $${DEFAULT_SHIPPING.toLocaleString()})`).setRequired(false))
        .addIntegerOption(opt => opt.setName('doc_fee').setDescription(`Documentation fee (default: $${DEFAULT_DOC_FEE})`).setRequired(false))
        .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in hours (24-720)').setRequired(false).setMinValue(24).setMaxValue(720))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners (1-10)').setRequired(false).setMinValue(1).setMaxValue(10))
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post the giveaway').setRequired(false))
        .addIntegerOption(opt => opt.setName('entry_fee').setDescription('Entry fee (0 = free)').setRequired(false).setMinValue(0))
    )
    .addSubcommand(sub => sub.setName('end').setDescription('End a giveaway and select winners').addStringOption(opt => opt.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true)))
    .addSubcommand(sub => sub.setName('reroll').setDescription('Reroll a winner').addStringOption(opt => opt.setName('message_id').setDescription('Message ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('winner').setDescription('Mark winner as paid').addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true)).addUserOption(opt => opt.setName('user').setDescription('Winner user').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List active car giveaways')),

  async execute(interaction) {
    if (!await isStaffOrAbove(interaction.member)) {
      return interaction.reply({ content: '❌ This command requires Staff permissions or higher.', ...EPHEMERAL });
    }
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    switch (sub) {
      case 'start': await startCarGiveaway(interaction, guildId); break;
      case 'end': await endCarGiveaway(interaction); break;
      case 'reroll': await rerollCarGiveaway(interaction); break;
      case 'winner': await processWinner(interaction); break;
      case 'list': await listCarGiveaways(interaction, guildId); break;
    }
  }
};

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
  if (!carData) return interaction.editReply({ content: '❌ Invalid model. Choose from: ' + Object.keys(carModels).join(', ') });

  const totalWinnerCost = shippingCost + docFee;
  const year = new Date().getFullYear();

  const embed = new EmbedBuilder()
    .setTitle('🚗 **OFFICIAL BYD CAR GIVEAWAY!** 🚗')
    .setDescription(`# 🎁 Win a ${year} BYD ${model}!\n\n### 📊 Vehicle Specs:\n• **MSRP:** $${carData.msrp.toLocaleString()}\n• **Range:** ${carData.range}\n• **Type:** ${carData.type}\n\n### ✨ How to Enter:\nClick **"ENTER GIVEAWAY"** below.\n\n### 📋 Winner Pays:\n• Shipping: $${shippingCost.toLocaleString()}\n• Doc Fee: $${docFee.toLocaleString()}\n• **Total:** $${totalWinnerCost.toLocaleString()}\n• Due within **${PAYMENT_DEADLINE_HOURS}h**\n\n### ⏰ Ends:\n<t:${Math.floor(endTime / 1000)}:R>\n\n### 👑 Winners: **${winnersCount}**\n\n${entryFee > 0 ? `### 💵 Entry Fee: $${entryFee}\n\n` : ''}*18+ with valid license required.*`)
    .setColor(carData.color || '#FFD700')
    .setThumbnail('https://cdn.byd.com/bot/byd-logo.png')
    .setFooter({ text: `Hosted by ${interaction.user.tag} • Winner cost: $${totalWinnerCost.toLocaleString()}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp(endTime);

  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cargiveaway_enter').setLabel(entryFee > 0 ? `🚗 ENTER - $${entryFee}` : '🚗 ENTER FOR FREE').setStyle(ButtonStyle.Success).setEmoji('🎁'));
  const message = await channel.send({ content: await getGiveawayPingContent(guildId), embeds: [embed], components: [row] });
  
  const result = await pool.query(`INSERT INTO car_giveaways (guild_id, channel_id, message_id, car_model, car_year, msrp, shipping_cost, documentation_fee, winners_count, entry_fee, end_time, hosted_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`, [guildId, channel.id, message.id, model, year, carData.msrp, shippingCost, docFee, winnersCount, entryFee, endTime, interaction.user.id]);
  await interaction.editReply({ content: `✅ **BYD ${model} Giveaway Started!**\n\n• Channel: ${channel}\n• Value: $${carData.msrp.toLocaleString()}\n• Duration: ${durationHours}h\n• Winners: ${winnersCount}\n• Winner Cost: $${totalWinnerCost.toLocaleString()}` });
  logger.success(`🚗 Car giveaway started: BYD ${model} (ID: ${result.rows[0].id})`);
}

async function endCarGiveaway(interaction) {
  const messageId = interaction.options.getString('message_id');
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = false', [messageId]);
  const giveaway = res.rows[0];
  if (!giveaway) return interaction.reply({ content: '❌ Giveaway not found or already ended.', ...EPHEMERAL });
  await interaction.deferReply(EPHEMERAL);
  await selectCarWinners(interaction, giveaway, false);
}

async function rerollCarGiveaway(interaction) {
  const messageId = interaction.options.getString('message_id');
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = true', [messageId]);
  const giveaway = res.rows[0];
  if (!giveaway) return interaction.reply({ content: '❌ Giveaway not found or still active.', ...EPHEMERAL });
  await interaction.deferReply(EPHEMERAL);
  await selectCarWinners(interaction, giveaway, true, giveaway.winners || []);
}

async function selectCarWinners(interaction, giveaway, isReroll = false, excludeWinners = []) {
  const entriesRes = await pool.query('SELECT user_id, user_email, user_phone FROM car_giveaway_entries WHERE giveaway_id = $1', [giveaway.id]);
  let entries = entriesRes.rows;
  if (isReroll && excludeWinners.length > 0) entries = entries.filter(e => !excludeWinners.includes(e.user_id));
  
  const channel = await interaction.client.channels.fetch(giveaway.channel_id).catch(() => null);
  const originalMessage = channel ? await channel.messages.fetch(giveaway.message_id).catch(() => null) : null;
  
  if (entries.length === 0) {
    const noWinnerEmbed = new EmbedBuilder().setTitle('🚗 BYD Car Giveaway Ended 🚗').setDescription(`**Prize:** ${giveaway.car_year} BYD ${giveaway.car_model}\n**Value:** $${giveaway.msrp.toLocaleString()}\n\n❌ No one entered!`).setColor('#FF0000').setTimestamp();
    if (originalMessage) await originalMessage.edit({ embeds: [noWinnerEmbed], components: [] });
    await pool.query('UPDATE car_giveaways SET ended = true WHERE id = $1', [giveaway.id]);
    return interaction.editReply({ content: '❌ Giveaway ended with no entrants.' });
  }

  const shuffled = [...entries.map(e => e.user_id)].sort(() => 0.5 - Math.random());
  const winners = shuffled.slice(0, giveaway.winners_count);
  const totalCost = giveaway.shipping_cost + giveaway.documentation_fee;
  
  const winnerEmbed = new EmbedBuilder()
    .setTitle(`🚗 ${isReroll ? '🔄 REROLL - ' : ''}BYD CAR GIVEAWAY WINNER! 🚗`)
    .setDescription(`## 🏆 CONGRATULATIONS!\n\n**Prize:** ${giveaway.car_year} BYD ${giveaway.car_model}\n**MSRP:** $${giveaway.msrp.toLocaleString()}\n\n### 👑 Winner(s):\n${winners.map(id => `<@${id}>`).join('\n')}\n\n### 📋 Next Steps:\n• Winners DM'd\n• **Payment:** $${totalCost.toLocaleString()}\n• **Deadline:** ${PAYMENT_DEADLINE_HOURS}h`)
    .setColor('#00FF00').setFooter({ text: `BYD Official • ${isReroll ? 'Rerolled' : 'Ended'}` }).setTimestamp();
  
  if (originalMessage) {
    await originalMessage.edit({ embeds: [winnerEmbed], components: [] });
    await originalMessage.reply({ content: `🎉 ${winners.map(id => `<@${id}>`).join(', ')} - You won the **${giveaway.car_year} BYD ${giveaway.car_model}**! Check DMs!` });
  }
  
  await pool.query('UPDATE car_giveaways SET ended = true, winners = $2 WHERE id = $1', [giveaway.id, winners]);
  
  for (const userId of winners) {
    try {
      const user = await interaction.client.users.fetch(userId);
      const dmEmbed = new EmbedBuilder().setTitle('🚗 YOU WON A BYD! 🚗').setDescription(`# 🎉 CONGRATULATIONS!\n\nYou won the **${giveaway.car_year} BYD ${giveaway.car_model}**!\n\n### 💵 Payment:\n• Shipping: $${giveaway.shipping_cost.toLocaleString()}\n• Doc Fee: $${giveaway.documentation_fee.toLocaleString()}\n• **Total:** $${totalCost.toLocaleString()}\n\n### ⚠️ ${PAYMENT_DEADLINE_HOURS}h to pay\n\nReply **CLAIM** to get started!`).setColor('#00FF00');
      await user.send({ embeds: [dmEmbed] });
      logger.success(`Winner DM sent to ${user.tag}`);
    } catch (err) { logger.warn(`Could not DM winner ${userId}`); }
  }
  
  await interaction.editReply({ content: `✅ **Winners Selected!**\n\n🏆 ${winners.map(id => `<@${id}>`).join(', ')}\n\n• Entries: ${entries.length}\n• Winner cost: $${totalCost.toLocaleString()}` });
}

async function processWinner(interaction) {
  const messageId = interaction.options.getString('message_id');
  const winnerUser = interaction.options.getUser('user');
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = true', [messageId]);
  const giveaway = res.rows[0];
  if (!giveaway) return interaction.reply({ content: '❌ Giveaway not found.', ...EPHEMERAL });
  if (!giveaway.winners?.includes(winnerUser.id)) return interaction.reply({ content: '❌ Not a winner.', ...EPHEMERAL });
  
  const totalCost = giveaway.shipping_cost + giveaway.documentation_fee;
  const paymentStatus = giveaway.payment_status || {};
  paymentStatus[winnerUser.id] = { paid: true, processedBy: interaction.user.id, processedAt: new Date().toISOString() };
  await pool.query('UPDATE car_giveaways SET payment_status = $2 WHERE id = $1', [giveaway.id, JSON.stringify(paymentStatus)]);
  
  await interaction.reply({ content: `✅ **Payment Processed!**\n\n• Winner: ${winnerUser.tag}\n• Vehicle: ${giveaway.car_year} BYD ${giveaway.car_model}\n• Collected: $${totalCost.toLocaleString()}`, ...EPHEMERAL });
  
  const deliveryEmbed = new EmbedBuilder().setTitle('📦 Payment Confirmed!').setDescription(`# ✅ Paid!\n\nYour **${giveaway.car_year} BYD ${giveaway.car_model}** is being prepared.\n\nDelivery specialist contacts you within 24-48h.`).setColor('#00FF00');
  await winnerUser.send({ embeds: [deliveryEmbed] }).catch(() => {});
}

async function listCarGiveaways(interaction, guildId) {
  const res = await pool.query('SELECT * FROM car_giveaways WHERE guild_id = $1 AND ended = false ORDER BY end_time ASC', [guildId]);
  if (res.rows.length === 0) return interaction.reply({ content: '📭 No active car giveaways.', ...EPHEMERAL });
  
  const embed = new EmbedBuilder().setTitle('🚗 Active Car Giveaways').setColor('#FFD700').setTimestamp();
  for (const gw of res.rows) {
    const countRes = await pool.query('SELECT COUNT(*) as count FROM car_giveaway_entries WHERE giveaway_id = $1', [gw.id]);
    embed.addFields({ name: `${gw.car_year} BYD ${gw.car_model}`, value: `• Value: $${gw.msrp.toLocaleString()}\n• Entries: ${countRes.rows[0]?.count || 0}\n• Ends: <t:${Math.floor(new Date(gw.end_time).getTime() / 1000)}:R>\n• ID: ${gw.message_id}`, inline: true });
  }
  await interaction.reply({ embeds: [embed], ...EPHEMERAL });
}

async function getGiveawayPingContent(guildId) {
  try { const config = await getGuildConfig(guildId); if (config?.giveaway_ping_role_id) return `<@&${config.giveaway_ping_role_id}> 🚗 **NEW CAR GIVEAWAY!**`; } catch {}
  return '🚗 **NEW CAR GIVEAWAY!**';
}

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

async function handleCarGiveawayModal(interaction) {
  if (interaction.customId !== 'cargiveaway_entry_modal') return false;
  const email = interaction.fields.getTextInputValue('email');
  const phone = interaction.fields.getTextInputValue('phone');
  const terms = interaction.fields.getTextInputValue('terms');
  if (terms.toUpperCase() !== 'I AGREE') return interaction.reply({ content: '❌ Type "I AGREE" to accept.', ...EPHEMERAL });
  
  const messageId = interaction.message?.id;
  if (!messageId) return interaction.reply({ content: '❌ Error. Try again.', ...EPHEMERAL });
  
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = false', [messageId]);
  const giveaway = res.rows[0];
  if (!giveaway) return interaction.reply({ content: '❌ Giveaway ended.', ...EPHEMERAL });
  
  await pool.query('INSERT INTO car_giveaway_entries (giveaway_id, user_id, user_email, user_phone, agreed_to_terms) VALUES ($1,$2,$3,$4,$5)', [giveaway.id, interaction.user.id, email, phone || null, true]);
  await interaction.reply({ content: `✅ **Entered!** 🎉\n\n• ${giveaway.car_year} BYD ${giveaway.car_model}\n• Value: $${giveaway.msrp.toLocaleString()}\n• Ends: <t:${Math.floor(new Date(giveaway.end_time).getTime() / 1000)}:R>\n\n🍀 Good luck!`, ...EPHEMERAL });
  logger.info(`User ${interaction.user.tag} entered car giveaway ${giveaway.id}`);
  return true;
}

module.exports.handleCarGiveawayButton = handleCarGiveawayButton;
module.exports.handleCarGiveawayModal = handleCarGiveawayModal;