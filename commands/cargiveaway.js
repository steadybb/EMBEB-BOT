// commands/cargiveaway.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const { pool } = require('../utils/database');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cargiveaway')
    .setDescription('🚗 BYD Car Giveaway System (admin only)')
    .addSubcommand(sub => 
      sub.setName('start')
        .setDescription('Start a BYD car giveaway')
        .addStringOption(opt => opt.setName('model').setDescription('BYD model (Seal, Dolphin, ATTO 3, Han)').setRequired(true))
        .addIntegerOption(opt => opt.setName('shipping').setDescription('Shipping cost (USD). Default: $1,999').setRequired(false))
        .addIntegerOption(opt => opt.setName('doc_fee').setDescription('Documentation fee (USD). Default: $499').setRequired(false))
        .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in hours (min 24, max 720). Default: 168').setRequired(false))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners (default 1)').setRequired(false))
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post giveaway').setRequired(false))
    )
    .addSubcommand(sub => 
      sub.setName('end')
        .setDescription('End a giveaway early')
        .addStringOption(opt => opt.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('winner')
        .setDescription('Mark a winner as paid & arrange delivery')
        .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
        .addUserOption(opt => opt.setName('user').setDescription('Winner user').setRequired(true))
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'start') {
      const model = interaction.options.getString('model');
      const shippingCost = interaction.options.getInteger('shipping') || 1999;
      const docFee = interaction.options.getInteger('doc_fee') || 499;
      const durationHours = interaction.options.getInteger('duration') || 168;
      const winnersCount = interaction.options.getInteger('winners') || 1;
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const endTime = new Date(Date.now() + durationHours * 60 * 60 * 1000);
      
      await interaction.deferReply({ ephemeral: true });

      // Car pricing data
      const carPrices = {
        'Seagull': 19990,
        'Dolphin': 29990,
        'Seal': 39990,
        'ATTO 3': 34990,
        'Han': 59990,
        'Tang': 49990,
      };
      const msrp = carPrices[model] || 39990;

      const embed = new EmbedBuilder()
        .setTitle('🚗 **BYD CAR GIVEAWAY!** 🚗')
        .setDescription(
          `🎁 **Prize:** **${new Date().getFullYear()} BYD ${model}**\n` +
          `💰 **MSRP Value:** $${msrp.toLocaleString()}\n\n` +
          `**✨ HOW TO ENTER:**\n` +
          `Click the **ENTER GIVEAWAY** button below and fill out the form.\n\n` +
          `**📋 WINNER RESPONSIBILITIES:**\n` +
          `• **Shipping & Handling:** $${shippingCost.toLocaleString()}\n` +
          `• **Documentation Fee:** $${docFee.toLocaleString()}\n` +
          `• **Total due upon winning:** $${(shippingCost + docFee).toLocaleString()}\n\n` +
          `**⏰ Ends:** <t:${Math.floor(endTime / 1000)}:R>\n` +
          `**👑 Winners:** ${winnersCount}\n\n` +
          `_*Winner will be contacted via DM to arrange payment & delivery._`
        )
        .setColor('#FFD700')
        .setThumbnail('https://cdn.byd.com/bot/car-giveaway.png')
        .setFooter({ text: 'BYD Official Giveaway | Winners pay only shipping + docs' })
        .setTimestamp(endTime);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('cargiveaway_enter')
          .setLabel('🚗 ENTER NOW')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🎁')
      );

      const message = await channel.send({ embeds: [embed], components: [row] });
      
      const result = await pool.query(
        `INSERT INTO car_giveaways (guild_id, channel_id, message_id, car_model, car_year, msrp, shipping_cost, documentation_fee, winners_count, end_time, hosted_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [guildId, channel.id, message.id, model, 2026, msrp, shippingCost, docFee, winnersCount, endTime, interaction.user.id]
      );

      await interaction.editReply({ content: `✅ BYD ${model} giveaway started in ${channel}! Winners pay $${(shippingCost + docFee).toLocaleString()} total.`, ephemeral: true });
      logger.success(`Car giveaway started: BYD ${model} in guild ${guildId}`);

    } else if (sub === 'end') {
      const messageId = interaction.options.getString('message_id');
      const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = false', [messageId]);
      const giveaway = res.rows[0];
      
      if (!giveaway) {
        return interaction.reply({ content: '❌ Giveaway not found or already ended.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      await selectCarWinners(interaction, giveaway);

    } else if (sub === 'winner') {
      const messageId = interaction.options.getString('message_id');
      const winnerUser = interaction.options.getUser('user');
      
      const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = true', [messageId]);
      const giveaway = res.rows[0];
      
      if (!giveaway) {
        return interaction.reply({ content: '❌ Giveaway not found or still active.', ephemeral: true });
      }
      
      // Mark winner as paid and initiate delivery
      await interaction.reply({ 
        content: `✅ Winner ${winnerUser} marked for delivery. Total to collect: $${(giveaway.shipping_cost + giveaway.documentation_fee).toLocaleString()}\n\n` +
                 `📦 DM the winner with payment instructions and delivery form.`,
        ephemeral: true 
      });
      
      // DM the winner
      const winnerEmbed = new EmbedBuilder()
        .setTitle('🚗 CONGRATULATIONS! You won a BYD Car! 🚗')
        .setDescription(
          `You've been selected as a winner of the **${giveaway.car_year} BYD ${giveaway.car_model}** giveaway!\n\n` +
          `**To claim your prize:**\n` +
          `1️⃣ Pay **$${giveaway.shipping_cost.toLocaleString()}** for shipping & handling\n` +
          `2️⃣ Pay **$${giveaway.documentation_fee.toLocaleString()}** for documentation fees\n` +
          `3️⃣ Complete the delivery form (sent via DM)\n\n` +
          `**Total due:** $${(giveaway.shipping_cost + giveaway.documentation_fee).toLocaleString()}\n\n` +
          `⚠️ You have **72 hours** to complete payment, or the prize will be forfeited.\n\n` +
          `Reply with **CLAIM** to get started!`
        )
        .setColor('#00FF00');
      
      await winnerUser.send({ embeds: [winnerEmbed] }).catch(() => logger.warn(`Could not DM winner ${winnerUser.tag}`));
      logger.success(`Winner ${winnerUser.tag} notified for car giveaway ${giveaway.id}`);
    }
  }
};

async function selectCarWinners(interaction, giveaway) {
  const entriesRes = await pool.query(
    'SELECT user_id FROM car_giveaway_entries WHERE giveaway_id = $1',
    [giveaway.id]
  );
  const entries = entriesRes.rows.map(row => row.user_id);
  const channel = await interaction.client.channels.fetch(giveaway.channel_id);
  const originalMessage = await channel.messages.fetch(giveaway.message_id).catch(() => null);
  
  if (entries.length === 0) {
    const noWinnerEmbed = new EmbedBuilder()
      .setTitle('🚗 BYD Car Giveaway Ended 🚗')
      .setDescription(`**Prize:** ${giveaway.car_year} BYD ${giveaway.car_model}\n\n❌ No one entered! Better luck next time.`)
      .setColor('#FF0000');
    
    if (originalMessage) {
      await originalMessage.edit({ embeds: [noWinnerEmbed], components: [] });
    }
    
    await pool.query('UPDATE car_giveaways SET ended = true WHERE id = $1', [giveaway.id]);
    await interaction.editReply({ content: '❌ Giveaway ended with no entrants.', ephemeral: true });
    return;
  }

  // Shuffle and select winners
  const shuffled = [...entries];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  const winners = shuffled.slice(0, giveaway.winners_count);
  const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
  
  const winnerEmbed = new EmbedBuilder()
    .setTitle('🚗 BYD CAR GIVEAWAY WINNER! 🚗')
    .setDescription(
      `**Prize:** ${giveaway.car_year} BYD ${giveaway.car_model}\n` +
      `**MRSP Value:** $${giveaway.msrp.toLocaleString()}\n\n` +
      `**🏆 WINNER(S):** ${winnerMentions}\n\n` +
      `**📋 Next Steps:**\n` +
      `• Winners will be contacted via DM within 24 hours\n` +
      `• Shipping & documentation fee: $${(giveaway.shipping_cost + giveaway.documentation_fee).toLocaleString()}\n` +
      `• Payment must be completed within 72 hours\n\n` +
      `Congratulations! 🎉`
    )
    .setColor('#00FF00');
  
  if (originalMessage) {
    await originalMessage.edit({ embeds: [winnerEmbed], components: [] });
  }
  
  await pool.query('UPDATE car_giveaways SET ended = true, winners = $2 WHERE id = $1', [giveaway.id, winners]);
  await interaction.editReply({ content: `✅ Winners selected: ${winnerMentions}\n\n⚠️ They have been notified via DM about payment.`, ephemeral: true });
  logger.success(`Car giveaway ${giveaway.id} ended with winners: ${winners.join(', ')}`);
}