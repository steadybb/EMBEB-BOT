// schedulers/followUp.js
const cron = require('node-cron');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getStaleLeads, updateLastFollowup } = require('../utils/database');
const bydEmbeds = require('../modules/bydEmbeds');

module.exports = (client) => {
  // Run every hour at minute 0 (e.g., 00:00, 01:00, etc.)
  cron.schedule('0 * * * *', async () => {
    console.log('[FollowUp] Checking for stale leads...');
    try {
      const staleUsers = await getStaleLeads(48); // 48 hours inactivity

      if (staleUsers.length === 0) {
        console.log('[FollowUp] No stale leads found.');
        return;
      }

      console.log(`[FollowUp] Found ${staleUsers.length} stale lead(s).`);

      for (const lead of staleUsers) {
        const userId = lead.user_id;
        const selectedModel = lead.selected_model || 'BYD';

        // Fetch the Discord user
        const user = await client.users.fetch(userId).catch(err => {
          console.error(`[FollowUp] Could not fetch user ${userId}:`, err);
          return null;
        });
        if (!user) continue;

        // Build the follow‑up embed from template
        const embedTemplate = bydEmbeds.follow_up_dormant.embed;
        const embed = new EmbedBuilder()
          .setTitle(embedTemplate.title.replace('{{model}}', selectedModel))
          .setDescription(
            embedTemplate.description
              .replace('{{model}}', selectedModel)
              .replace('{{quote_link}}', `https://byd.com/quote?model=${encodeURIComponent(selectedModel)}&user=${userId}`)
              .replace('{{test_drive_link}}', `https://byd.com/testdrive?user=${userId}`)
          )
          .setColor(embedTemplate.color || '#F1C40F')
          .setFooter({ text: embedTemplate.footer.text, iconURL: embedTemplate.footer.iconURL })
          .setTimestamp();

        // Buttons for the follow‑up message
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('followup_brochure')
            .setLabel('📄 Download Brochure')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('followup_quote')
            .setLabel('💰 Get Your Quote')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('followup_testdrive')
            .setLabel('🗓️ Book a Test Drive')
            .setStyle(ButtonStyle.Success)
        );

        try {
          await user.send({ embeds: [embed], components: [row] });
          await updateLastFollowup(userId);
          console.log(`[FollowUp] Sent follow‑up to ${user.tag} (${userId})`);
        } catch (err) {
          console.error(`[FollowUp] Failed to send DM to ${user.tag}:`, err);
          // Optionally mark that we couldn't DM so we don't keep trying every hour?
          // For now, we still update last_followup_sent to avoid spamming errors.
          await updateLastFollowup(userId);
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('[FollowUp] Error in cron job:', error);
    }
  });

  console.log('[FollowUp] Scheduler started (runs every hour).');
};