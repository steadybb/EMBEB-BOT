// events/guildMemberUpdate.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const bydEmbeds = require('../modules/bydEmbeds');
const logger = require('../utils/logger');

// Rotating testimonials for social proof
const testimonials = [
  "“Switched to the Seal and saved R$ 9,560/year on IPVA – best decision!” – Marina, SP",
  "“The ATTO 3’s Blade Battery gives my family real peace of mind.” – Carlos, RJ",
  "“Free home charger installation? BYD really cares.” – Luisa, BH",
  "“0‑100 km/h in 3.8s – the Han is pure adrenaline.” – Felipe, SP"
];

// Urgency phrases (rotated)
const urgencyPhrases = [
  "⚡ Only 3 test drive slots left this week!",
  "🔥 Limited edition Dolphin Sport – almost gone!",
  "⏳ IPVA exemption may change next quarter – lock yours now.",
  "🎁 Free charger installation ends in 48h for new leads."
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

      // Build a premium, conversion‑optimised welcome DM
      const embed = new EmbedBuilder()
        .setTitle(`⚡ Welcome to the BYD Elite Circle, ${newMember.user.username}!`)
        .setDescription(
          `You’ve been hand‑picked as a **Lead** – that means you get **priority access** to:\n` +
          `• 🔋 Real‑time EV incentives (IPVA exemption, tax breaks)\n` +
          `• 🚗 **Home test drives** – we bring the car to you\n` +
          `• 💰 **Exclusive launch prices** – before the public\n\n` +
          `_“${getRandomItem(testimonials)}”_\n\n` +
          `${getRandomItem(urgencyPhrases)}\n\n` +
          `👉 **Which BYD catches your eye?** Tap a model below – a personal advisor will message you within the hour.`
        )
        .setColor('#00BFFF') // BYD electric blue
        .setFooter({ text: '⚡ Blade Battery Technology • Trusted by 15,000+ drivers', iconURL: 'https://cdn.byd.com/bot/byd-logo.png' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('welcome_model_dolphin').setLabel('🐬 Dolphin').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('welcome_model_seal').setLabel('🦭 Seal').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('welcome_model_atto3').setLabel('⚔️ ATTO 3').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('welcome_model_han').setLabel('🏯 Han').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('welcome_model_commercial').setLabel('🚌 Commercial').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('welcome_model_notsure').setStyle(ButtonStyle.Secondary).setLabel('❓ Not Sure – help me decide')
      );

      try {
        await newMember.send({ embeds: [embed], components: [row] });
        logger.success(`📨 High‑conversion welcome DM sent to ${newMember.user.tag}`);
      } catch (err) {
        logger.error(`❌ Could not DM ${newMember.user.tag}:`, err);
      }
    }
  });
};