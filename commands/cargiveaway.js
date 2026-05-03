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
  StringSelectMenuBuilder,
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
            .addChoices(
              ...Object.keys(carModels).map(m => ({ name: m, value: m }))
            ))
        .addIntegerOption(opt => 
          opt.setName('shipping')
            .setDescription(`Shipping cost in USD (default: $${DEFAULT_SHIPPING.toLocaleString()})`)
            .setRequired(false))
        .addIntegerOption(opt => 
          opt.setName('doc_fee')
            .setDescription(`Documentation fee in USD (default: $${DEFAULT_DOC_FEE})`)
            .setRequired(false))
        .addIntegerOption(opt => 
          opt.setName('duration')
            .setDescription('Duration in hours (24-720)')
            .setRequired(false)
            .setMinValue(24)
            .setMaxValue(720))
        .addIntegerOption(opt => 
          opt.setName('winners')
            .setDescription('Number of winners (1-10)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10))
        .addChannelOption(opt => 
          opt.setName('channel')
            .setDescription('Channel to post the giveaway (default: current channel)')
            .setRequired(false))
        .addIntegerOption(opt => 
          opt.setName('entry_fee')
            .setDescription('Entry fee in USD (0 = free entry)')
            .setRequired(false)
            .setMinValue(0))
    )
    .addSubcommand(sub => 
      sub.setName('end')
        .setDescription('End a giveaway and select winners')
        .addStringOption(opt => 
          opt.setName('message_id')
            .setDescription('Message ID of the giveaway')
            .setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('reroll')
        .setDescription('Reroll a winner for a completed giveaway')
        .addStringOption(opt => 
          opt.setName('message_id')
            .setDescription('Message ID of the giveaway')
            .setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('winner')
        .setDescription('Mark a winner as paid & arrange delivery')
        .addStringOption(opt => 
          opt.setName('message_id')
            .setDescription('Giveaway message ID')
            .setRequired(true))
        .addUserOption(opt => 
          opt.setName('user')
            .setDescription('Winner user')
            .setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('list')
        .setDescription('List all active car giveaways')
    ),

  async execute(interaction) {
    // Check permissions - allow staff or admin
    if (!await isStaffOrAbove(interaction.member)) {
      return interaction.reply({ 
        content: '❌ This command requires Staff permissions or higher.', 
        ephemeral: true 
      });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    switch (sub) {
      case 'start':
        await startCarGiveaway(interaction, guildId);
        break;
      case 'end':
        await endCarGiveaway(interaction);
        break;
      case 'reroll':
        await rerollCarGiveaway(interaction);
        break;
      case 'winner':
        await processWinner(interaction);
        break;
      case 'list':
        await listCarGiveaways(interaction, guildId);
        break;
    }
  }
};

// ============================================
// START CAR GIVEAWAY
// ============================================

async function startCarGiveaway(interaction, guildId) {
  const model = interaction.options.getString('model');
  const shippingCost = interaction.options.getInteger('shipping') || DEFAULT_SHIPPING;
  const docFee = interaction.options.getInteger('doc_fee') || DEFAULT_DOC_FEE;
  const durationHours = interaction.options.getInteger('duration') || 168; // 7 days default
  const winnersCount = interaction.options.getInteger('winners') || 1;
  const entryFee = interaction.options.getInteger('entry_fee') || 0;
  const channel = interaction.options.getChannel('channel') || interaction.channel;
  const endTime = new Date(Date.now() + durationHours * 60 * 60 * 1000);
  
  await interaction.deferReply({ ephemeral: true });

  const carData = carModels[model];
  if (!carData) {
    return interaction.editReply({ content: '❌ Invalid model. Choose from: ' + Object.keys(carModels).join(', '), ephemeral: true });
  }

  const totalWinnerCost = shippingCost + docFee;
  const year = new Date().getFullYear();

  // Build the giveaway embed
  const embed = new EmbedBuilder()
    .setTitle('🚗 **OFFICIAL BYD CAR GIVEAWAY!** 🚗')
    .setDescription(
      `# 🎁 Win a ${year} BYD ${model}!\n\n` +
      `### 📊 Vehicle Specs:\n` +
      `• **MSRP Value:** $${carData.msrp.toLocaleString()}\n` +
      `• **Range:** ${carData.range}\n` +
      `• **Type:** ${carData.type}\n\n` +
      `### ✨ How to Enter:\n` +
      `Click the **"ENTER GIVEAWAY"** button below and fill out the registration form.\n\n` +
      `### 📋 Winner Responsibilities:\n` +
      `• **Shipping & Handling:** $${shippingCost.toLocaleString()}\n` +
      `• **Documentation Fee:** $${docFee.toLocaleString()}\n` +
      `• **Total due upon winning:** $${totalWinnerCost.toLocaleString()}\n` +
      `• Payment must be completed within **${PAYMENT_DEADLINE_HOURS} hours** of winning\n\n` +
      `### ⏰ Giveaway Ends:\n` +
      `<t:${Math.floor(endTime / 1000)}:R> (<t:${Math.floor(endTime / 1000)}:F>)\n\n` +
      `### 👑 Winners:\n` +
      `**${winnersCount}** lucky winner(s) will be selected!\n\n` +
      `${entryFee > 0 ? `### 💵 Entry Fee: $${entryFee}\n\n` : ''}` +
      `*Winners will be contacted via DM to arrange payment & delivery.*\n` +
      `*Must be 18+ with valid driver's license to claim.*`
    )
    .setColor(carData.color || '#FFD700')
    .setThumbnail('https://cdn.byd.com/bot/byd-logo.png')
    .setImage(`https://ui-avatars.com/api/?name=BYD+${model.replace(/ /g, '+')}&background=${carData.color?.replace('#', '') || 'FFD700'}&color=fff&size=512&bold=true&font-size=0.3`)
    .setFooter({ 
      text: `Hosted by ${interaction.user.tag} • BYD Official Giveaway • Total winner cost: $${totalWinnerCost.toLocaleString()}`, 
      iconURL: interaction.user.displayAvatarURL() 
    })
    .setTimestamp(endTime);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('cargiveaway_enter')
      .setLabel(entryFee > 0 ? `🚗 ENTER NOW - $${entryFee}` : '🚗 ENTER FOR FREE')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎁')
  );

  // Send the giveaway message
  const message = await channel.send({ 
    content: getGiveawayPingContent(guildId),
    embeds: [embed], 
    components: [row] 
  });
  
  // Save to database
  const result = await pool.query(
    `INSERT INTO car_giveaways (
      guild_id, channel_id, message_id, car_model, car_year, msrp, 
      shipping_cost, documentation_fee, winners_count, entry_fee, 
      end_time, hosted_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
    RETURNING id`,
    [guildId, channel.id, message.id, model, year, carData.msrp, 
     shippingCost, docFee, winnersCount, entryFee, 
     endTime, interaction.user.id]
  );

  await interaction.editReply({ 
    content: `✅ **BYD ${model} Giveaway Started!**\n\n` +
             `• **Channel:** ${channel}\n` +
             `• **Value:** $${carData.msrp.toLocaleString()}\n` +
             `• **Duration:** ${durationHours} hours\n` +
             `• **Winners:** ${winnersCount}\n` +
             `• **Winner Cost:** $${totalWinnerCost.toLocaleString()}\n` +
             `• **Entry Fee:** ${entryFee > 0 ? '$' + entryFee : 'Free'}\n` +
             `• **DB ID:** ${result.rows[0].id}`,
    ephemeral: true 
  });
  
  logger.success(`🚗 Car giveaway started: BYD ${model} (ID: ${result.rows[0].id}) in guild ${guildId}`);
}

// ============================================
// END CAR GIVEAWAY
// ============================================

async function endCarGiveaway(interaction) {
  const messageId = interaction.options.getString('message_id');
  
  const res = await pool.query(
    'SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = false', 
    [messageId]
  );
  const giveaway = res.rows[0];
  
  if (!giveaway) {
    return interaction.reply({ 
      content: '❌ Giveaway not found or already ended.', 
      ephemeral: true 
    });
  }

  await interaction.deferReply({ ephemeral: true });
  await selectCarWinners(interaction, giveaway, false);
}

// ============================================
// REROLL CAR GIVEAWAY
// ============================================

async function rerollCarGiveaway(interaction) {
  const messageId = interaction.options.getString('message_id');
  
  const res = await pool.query(
    'SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = true', 
    [messageId]
  );
  const giveaway = res.rows[0];
  
  if (!giveaway) {
    return interaction.reply({ 
      content: '❌ Giveaway not found or still active.', 
      ephemeral: true 
    });
  }

  await interaction.deferReply({ ephemeral: true });
  
  // Get previous winners to exclude
  const previousWinners = giveaway.winners || [];
  
  await selectCarWinners(interaction, giveaway, true, previousWinners);
}

// ============================================
// SELECT WINNERS
// ============================================

async function selectCarWinners(interaction, giveaway, isReroll = false, excludeWinners = []) {
  const entriesRes = await pool.query(
    'SELECT user_id, user_email, user_phone FROM car_giveaway_entries WHERE giveaway_id = $1',
    [giveaway.id]
  );
  
  let entries = entriesRes.rows;
  
  // Exclude previous winners for rerolls
  if (isReroll && excludeWinners.length > 0) {
    entries = entries.filter(e => !excludeWinners.includes(e.user_id));
  }
  
  const channel = await interaction.client.channels.fetch(giveaway.channel_id).catch(() => null);
  const originalMessage = channel ? await channel.messages.fetch(giveaway.message_id).catch(() => null) : null;
  
  // No entries
  if (entries.length === 0) {
    const noWinnerEmbed = new EmbedBuilder()
      .setTitle('🚗 BYD Car Giveaway Ended 🚗')
      .setDescription(
        `**Prize:** ${giveaway.car_year} BYD ${giveaway.car_model}\n` +
        `**Value:** $${giveaway.msrp.toLocaleString()}\n\n` +
        `❌ No one entered! Better luck next time.\n\n` +
        `*Stay tuned for future giveaways!*`
      )
      .setColor('#FF0000')
      .setFooter({ text: 'BYD Official Giveaway' })
      .setTimestamp();
    
    if (originalMessage) {
      await originalMessage.edit({ embeds: [noWinnerEmbed], components: [] });
    }
    
    await pool.query('UPDATE car_giveaways SET ended = true WHERE id = $1', [giveaway.id]);
    await interaction.editReply({ content: '❌ Giveaway ended with no entrants.', ephemeral: true });
    return;
  }

  // Select random winners
  const entryIds = entries.map(e => e.user_id);
  const shuffled = [...entryIds].sort(() => 0.5 - Math.random());
  const winners = shuffled.slice(0, giveaway.winners_count);
  
  // Get winner details
  const winnerDetails = winners.map(wId => {
    const entry = entries.find(e => e.user_id === wId);
    return {
      userId: wId,
      email: entry?.user_email || 'N/A',
      phone: entry?.user_phone || 'N/A',
    };
  });
  
  const winnerMentions = winners.map(id => `<@${id}>`).join('\n');
  const totalCost = giveaway.shipping_cost + giveaway.documentation_fee;
  
  // Build winner announcement
  const rerollLabel = isReroll ? '🔄 REROLL - ' : '';
  const winnerEmbed = new EmbedBuilder()
    .setTitle(`🚗 ${rerollLabel}BYD CAR GIVEAWAY WINNER! 🚗`)
    .setDescription(
      `## 🏆 CONGRATULATIONS!\n\n` +
      `**Prize:** ${giveaway.car_year} BYD ${giveaway.car_model}\n` +
      `**MSRP Value:** $${giveaway.msrp.toLocaleString()}\n\n` +
      `### 👑 Winner(s):\n${winnerMentions}\n\n` +
      `### 📋 Next Steps:\n` +
      `• Winners will be contacted via DM\n` +
      `• **Payment due:** $${totalCost.toLocaleString()}\n` +
      `• **Deadline:** ${PAYMENT_DEADLINE_HOURS} hours\n\n` +
      `*Check your DMs for payment & delivery instructions!*\n` +
      `🎉 Congratulations to the winner(s)!`
    )
    .setColor('#00FF00')
    .setFooter({ text: `BYD Official Giveaway • ${isReroll ? 'Rerolled' : 'Ended'} by ${interaction.user.tag}` })
    .setTimestamp();
  
  if (originalMessage) {
    await originalMessage.edit({ embeds: [winnerEmbed], components: [] });
    await originalMessage.reply({ 
      content: `🎉 ${winners.map(id => `<@${id}>`).join(', ')} - You won the **${giveaway.car_year} BYD ${giveaway.car_model}**! Check your DMs!`,
    });
  }
  
  // Update database
  await pool.query(
    'UPDATE car_giveaways SET ended = true, winners = $2 WHERE id = $1',
    [giveaway.id, winners]
  );
  
  // DM each winner
  for (const winner of winnerDetails) {
    try {
      const user = await interaction.client.users.fetch(winner.userId);
      const dmEmbed = new EmbedBuilder()
        .setTitle('🚗 CONGRATULATIONS! You Won a BYD Car! 🚗')
        .setDescription(
          `# 🎉 YOU WON!\n\n` +
          `You've been selected as a winner of the **${giveaway.car_year} BYD ${giveaway.car_model}** giveaway!\n\n` +
          `### 📊 Your Prize:\n` +
          `• **Vehicle:** ${giveaway.car_year} BYD ${giveaway.car_model}\n` +
          `• **MSRP Value:** $${giveaway.msrp.toLocaleString()}\n\n` +
          `### 💵 Payment Required:\n` +
          `• **Shipping & Handling:** $${giveaway.shipping_cost.toLocaleString()}\n` +
          `• **Documentation Fee:** $${giveaway.documentation_fee.toLocaleString()}\n` +
          `• **Total Due:** $${totalCost.toLocaleString()}\n\n` +
          `### ⚠️ IMPORTANT:\n` +
          `• You have **${PAYMENT_DEADLINE_HOURS} hours** to complete payment\n` +
          `• Failure to pay will result in forfeiture of the prize\n` +
          `• A new winner will be selected if payment is not received\n\n` +
          `### 📝 To Claim:\n` +
          `Reply to this message with **"CLAIM"** and a staff member will provide payment instructions.\n\n` +
          `*Congratulations on your new BYD! 🎉*`
        )
        .setColor('#00FF00')
        .setThumbnail('https://cdn.byd.com/bot/byd-logo.png')
        .setFooter({ text: 'BYD Official Giveaway • Reply with CLAIM to get started' })
        .setTimestamp();
      
      await user.send({ embeds: [dmEmbed] });
      logger.success(`Winner DM sent to ${user.tag} for car giveaway ${giveaway.id}`);
    } catch (err) {
      logger.warn(`Could not DM winner ${winner.userId}:`, err.message);
    }
  }
  
  await interaction.editReply({ 
    content: `✅ **Winners Selected!**\n\n` +
             `🏆 ${winnerMentions}\n\n` +
             `• **Total entries:** ${entries.length}\n` +
             `• **Winner cost:** $${totalCost.toLocaleString()}\n` +
             `• Winners have been notified via DM.`,
    ephemeral: true 
  });
  
  logger.success(`Car giveaway ${giveaway.id} ended. Winners: ${winners.join(', ')}`);
}

// ============================================
// PROCESS WINNER PAYMENT
// ============================================

async function processWinner(interaction) {
  const messageId = interaction.options.getString('message_id');
  const winnerUser = interaction.options.getUser('user');
  
  const res = await pool.query(
    'SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = true', 
    [messageId]
  );
  const giveaway = res.rows[0];
  
  if (!giveaway) {
    return interaction.reply({ 
      content: '❌ Giveaway not found or still active.', 
      ephemeral: true 
    });
  }
  
  if (!giveaway.winners?.includes(winnerUser.id)) {
    return interaction.reply({ 
      content: '❌ This user is not a winner of this giveaway.', 
      ephemeral: true 
    });
  }
  
  const totalCost = giveaway.shipping_cost + giveaway.documentation_fee;
  
  // Update payment status
  const paymentStatus = giveaway.payment_status || {};
  paymentStatus[winnerUser.id] = {
    paid: true,
    processedBy: interaction.user.id,
    processedAt: new Date().toISOString(),
  };
  
  await pool.query(
    'UPDATE car_giveaways SET payment_status = $2 WHERE id = $1',
    [giveaway.id, JSON.stringify(paymentStatus)]
  );
  
  await interaction.reply({ 
    content: `✅ **Payment Processed!**\n\n` +
             `• **Winner:** ${winnerUser.tag}\n` +
             `• **Vehicle:** ${giveaway.car_year} BYD ${giveaway.car_model}\n` +
             `• **Total Collected:** $${totalCost.toLocaleString()}\n\n` +
             `📦 Please arrange delivery with the winner.\n` +
             `📧 Winner's email & phone are available in the database.`,
    ephemeral: true 
  });
  
  // DM the winner with delivery info
  const deliveryEmbed = new EmbedBuilder()
    .setTitle('📦 Your BYD Delivery - Payment Confirmed!')
    .setDescription(
      `# ✅ Payment Confirmed!\n\n` +
      `Your payment of **$${totalCost.toLocaleString()}** has been received.\n\n` +
      `### 🚗 Your Vehicle:\n` +
      `**${giveaway.car_year} BYD ${giveaway.car_model}**\n\n` +
      `### 📋 Next Steps:\n` +
      `1️⃣ A delivery specialist will contact you within 24-48 hours\n` +
      `2️⃣ You'll receive tracking information via email\n` +
      `3️⃣ Delivery typically takes 2-4 weeks\n\n` +
      `*If you have any questions, reply to this message!*\n\n` +
      `🎉 Congratulations on your new BYD!`
    )
    .setColor('#00FF00')
    .setFooter({ text: 'BYD Official Delivery • Payment Confirmed' })
    .setTimestamp();
  
  await winnerUser.send({ embeds: [deliveryEmbed] }).catch(() => {});
  
  logger.success(`Winner ${winnerUser.tag} payment processed for giveaway ${giveaway.id}`);
}

// ============================================
// LIST ACTIVE GIVEAWAYS
// ============================================

async function listCarGiveaways(interaction, guildId) {
  const res = await pool.query(
    'SELECT * FROM car_giveaways WHERE guild_id = $1 AND ended = false ORDER BY end_time ASC',
    [guildId]
  );
  
  const giveaways = res.rows;
  
  if (giveaways.length === 0) {
    return interaction.reply({ 
      content: '📭 No active car giveaways in this server.', 
      ephemeral: true 
    });
  }
  
  const embed = new EmbedBuilder()
    .setTitle('🚗 Active Car Giveaways')
    .setColor('#FFD700')
    .setTimestamp();
  
  for (const gw of giveaways) {
    const entriesRes = await pool.query(
      'SELECT COUNT(*) as count FROM car_giveaway_entries WHERE giveaway_id = $1',
      [gw.id]
    );
    const entryCount = entriesRes.rows[0]?.count || 0;
    
    embed.addFields({
      name: `${gw.car_year} BYD ${gw.car_model}`,
      value: `• **Value:** $${gw.msrp.toLocaleString()}\n` +
             `• **Entries:** ${entryCount}\n` +
             `• **Winners:** ${gw.winners_count}\n` +
             `• **Ends:** <t:${Math.floor(new Date(gw.end_time).getTime() / 1000)}:R>\n` +
             `• **Message ID:** ${gw.message_id}\n` +
             `• **Channel:** <#${gw.channel_id}>`,
      inline: true
    });
  }
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getGiveawayPingContent(guildId) {
  try {
    const config = await getGuildConfig(guildId);
    if (config?.giveaway_ping_role_id) {
      return `<@&${config.giveaway_ping_role_id}> 🚗 **NEW CAR GIVEAWAY!**`;
    }
  } catch {}
  return '🚗 **NEW CAR GIVEAWAY!**';
}

// ============================================
// BUTTON HANDLER (for entry modal)
// ============================================

async function handleCarGiveawayButton(interaction) {
  if (interaction.customId !== 'cargiveaway_enter') return false;
  
  // Get giveaway from database
  const res = await pool.query(
    'SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = false',
    [interaction.message.id]
  );
  const giveaway = res.rows[0];
  
  if (!giveaway) {
    return interaction.reply({ 
      content: '❌ This giveaway has ended or is no longer available.', 
      ephemeral: true 
    });
  }
  
  // Check if already entered
  const existingEntry = await pool.query(
    'SELECT * FROM car_giveaway_entries WHERE giveaway_id = $1 AND user_id = $2',
    [giveaway.id, interaction.user.id]
  );
  
  if (existingEntry.rows.length > 0) {
    return interaction.reply({ 
      content: '✅ You have already entered this giveaway! Good luck! 🍀', 
      ephemeral: true 
    });
  }
  
  // Show entry modal
  const modal = new ModalBuilder()
    .setCustomId('cargiveaway_entry_modal')
    .setTitle(`Enter: BYD ${giveaway.car_model} Giveaway`);
  
  const emailInput = new TextInputBuilder()
    .setCustomId('email')
    .setLabel('Email Address')
    .setPlaceholder('your@email.com')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  
  const phoneInput = new TextInputBuilder()
    .setCustomId('phone')
    .setLabel('Phone Number (optional)')
    .setPlaceholder('(555) 123-4567')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);
  
  const termsInput = new TextInputBuilder()
    .setCustomId('terms')
    .setLabel('Type "I AGREE" to accept terms')
    .setPlaceholder('I AGREE')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(6)
    .setMaxLength(7);
  
  modal.addComponents(
    new ActionRowBuilder().addComponents(emailInput),
    new ActionRowBuilder().addComponents(phoneInput),
    new ActionRowBuilder().addComponents(termsInput)
  );
  
  await interaction.showModal(modal);
  return true;
}

// ============================================
// MODAL HANDLER (for entry submission)
// ============================================

async function handleCarGiveawayModal(interaction) {
  if (interaction.customId !== 'cargiveaway_entry_modal') return false;
  
  const email = interaction.fields.getTextInputValue('email');
  const phone = interaction.fields.getTextInputValue('phone');
  const terms = interaction.fields.getTextInputValue('terms');
  
  if (terms.toUpperCase() !== 'I AGREE') {
    return interaction.reply({ 
      content: '❌ You must type "I AGREE" to accept the terms and enter.', 
      ephemeral: true 
    });
  }
  
  // Get the giveaway from the original message
  const messageId = interaction.message?.id;
  if (!messageId) {
    return interaction.reply({ 
      content: '❌ Could not find the giveaway. Please try again.', 
      ephemeral: true 
    });
  }
  
  const res = await pool.query(
    'SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = false',
    [messageId]
  );
  const giveaway = res.rows[0];
  
  if (!giveaway) {
    return interaction.reply({ 
      content: '❌ This giveaway has ended.', 
      ephemeral: true 
    });
  }
  
  // Add entry
  await pool.query(
    `INSERT INTO car_giveaway_entries (giveaway_id, user_id, user_email, user_phone, agreed_to_terms)
     VALUES ($1, $2, $3, $4, $5)`,
    [giveaway.id, interaction.user.id, email, phone || null, true]
  );
  
  await interaction.reply({ 
    content: `✅ **You're entered!** 🎉\n\n` +
             `• **Giveaway:** ${giveaway.car_year} BYD ${giveaway.car_model}\n` +
             `• **Value:** $${giveaway.msrp.toLocaleString()}\n` +
             `• **Ends:** <t:${Math.floor(new Date(giveaway.end_time).getTime() / 1000)}:R>\n\n` +
             `Good luck! 🍀`,
    ephemeral: true 
  });
  
  logger.info(`User ${interaction.user.tag} entered car giveaway ${giveaway.id}`);
  return true;
}

// Export button/modal handlers
module.exports.handleCarGiveawayButton = handleCarGiveawayButton;
module.exports.handleCarGiveawayModal = handleCarGiveawayModal;