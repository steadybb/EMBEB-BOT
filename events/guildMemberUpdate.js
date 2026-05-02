// events/guildMemberUpdate.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const bydEmbeds = require('../modules/bydEmbeds');
const logger = require('../utils/logger');

// USD testimonials (US states)
const testimonials = [
  "“Saved $7,500 with federal credits – the Seal is a steal!” – Marina, CA",
  "“ATTO 3’s Blade Battery gave my family real peace of mind.” – Carlos, TX",
  "“Free home charger installation? BYD really cares.” – Luisa, NY",
  "“0‑60 in 3.8s – the Han Performance is pure adrenaline.” – Felipe, FL"
];

// US urgency phrases
const urgencyPhrases = [
  "⚡ Only 5 test drive slots left this week!",
  "🔥 Launch edition models – limited inventory!",
  "⏳ EV tax credits may phase out – lock yours now.",
  "🎁 Free Level 2 charger installation ends June 30."
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = (client) => {
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // Get the role named "Lead" (case‑sensitive; adjust as needed)
    const leadRole = newMember.guild.roles.cache.find(r => r.name === 'Lead');
    if (!leadRole) return;

    const hadLead = oldMember.roles.cache.has(leadRole.id);
    const hasLead = newMember.roles.cache.has(leadRole.id);

    if (!hadLead && hasLead) {
      logger.info(`👤 ${newMember.user.tag} became a Lead in ${newMember.guild.name}`);

      // Use static URL or fallback
      const staticBase = process.env.STATIC_URL || 'https://cdn.byd.com/bot';

      // Build a premium, conversion‑optimised welcome DM (USD)
      const embed = new EmbedBuilder()
        .setTitle(`⚡ Welcome to the BYD Elite Circle, ${newMember.user.username}!`)
        .setDescription(
          `You’ve been hand‑picked as a **Lead** – that means you get **priority access** to:\n` +
          `• 🔋 Real‑time US EV incentives (federal/state credits, HOV access)\n` +
          `• 🚗 **Home test drives** – we bring the car to you\n` +
          `• 💰 **Exclusive launch prices** – starting from $19,990\n\n` +
          `_“${getRandomItem(testimonials)}”_\n\n` +
          `${getRandomItem(urgencyPhrases)}\n\n` +
          `👉 **Which BYD catches your eye?** Tap a model below – a personal advisor will message you within the hour.`
        )
        .setColor('#00BFFF')
        .setFooter({ 
          text: '⚡ Blade Battery Technology • Trusted by 15,000+ US drivers', 
          iconURL: `${staticBase}/byd-logo.png`
        })
        .setTimestamp();

      // Two rows of buttons (6 total – max 5 per row)
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('welcome_model_dolphin').setLabel('🐬 Dolphin').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('welcome_model_seal').setLabel('🦭 Seal').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('welcome_model_atto3').setLabel('⚔️ ATTO 3').setStyle(ButtonStyle.Primary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('welcome_model_han').setLabel('🏯 Han').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('welcome_model_commercial').setLabel('🚌 Commercial').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('welcome_model_notsure').setLabel('❓ Not Sure – help me decide').setStyle(ButtonStyle.Secondary)
      );

      try {
        await newMember.send({ embeds: [embed], components: [row1, row2] });
        logger.success(`📨 High‑conversion welcome DM sent to ${newMember.user.tag}`);
      } catch (err) {
        logger.error(`❌ Could not DM ${newMember.user.tag}:`, err);
      }
    }
  });
};