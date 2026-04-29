// events/guildMemberUpdate.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const bydEmbeds = require('../modules/bydEmbeds');

module.exports = (client) => {
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // Get the role named "Lead" (case‑sensitive; adjust as needed)
    const leadRole = newMember.guild.roles.cache.find(r => r.name === 'Lead');
    if (!leadRole) return;

    const hadLead = oldMember.roles.cache.has(leadRole.id);
    const hasLead = newMember.roles.cache.has(leadRole.id);

    // User just gained the Lead role
    if (!hadLead && hasLead) {
      // Send welcome DM
      const embedTemplate = bydEmbeds.welcome_greeting.embed;
      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder(embedTemplate)
        .setTitle(embedTemplate.title.replace('{{username}}', newMember.user.username))
        .setDescription(embedTemplate.description.replace('{{username}}', newMember.user.username));

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('welcome_model_dolphin').setLabel('🐬 Dolphin').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('welcome_model_seal').setLabel('🦭 Seal').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('welcome_model_atto3').setLabel('⚔️ ATTO 3').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('welcome_model_han').setLabel('🏯 Han').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('welcome_model_commercial').setLabel('🚌 Commercial').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('welcome_model_notsure').setLabel('❓ Not Sure').setStyle(ButtonStyle.Secondary)
      );

      try {
        await newMember.send({ embeds: [embed], components: [row] });
        console.log(`Sent welcome DM to ${newMember.user.tag}`);
      } catch (err) {
        console.error(`Could not DM ${newMember.user.tag}:`, err);
      }
    }
  });
};