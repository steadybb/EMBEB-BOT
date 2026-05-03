// events/guildMemberUpdate.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const bydEmbeds = require('../modules/bydEmbeds');
const { upsertLead, getGuildConfig } = require('../utils/database');
const logger = require('../utils/logger');

// USD testimonials (US states)
const testimonials = [
  "“Saved $7,500 with federal credits – the Seal is a steal!” – Marina, CA",
  "“ATTO 3's Blade Battery gave my family real peace of mind.” – Carlos, TX",
  "“Free home charger installation? BYD really cares.” – Luisa, NY",
  "“0‑60 in 3.8s – the Han Performance is pure adrenaline.” – Felipe, FL",
  "“Best EV decision I ever made. And I saved thousands.” – Ahmed, CO"
];

// US urgency phrases
const urgencyPhrases = [
  "⚡ Only 5 test drive slots left this week!",
  "🔥 Launch edition models – limited inventory!",
  "⏳ EV tax credits may phase out – lock yours now.",
  "🎁 Free Level 2 charger installation ends June 30.",
  "📉 0.99% financing – last 10 cars at this rate."
];

// Lead scoring based on activity
const leadActivityPoints = {
  'BUTTON_CLICK': 10,
  'MODEL_SELECT': 25,
  'QUOTE_REQUEST': 30,
  'TEST_DRIVE_BOOK': 50,
  'TRADE_IN_START': 20,
};

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get a personalized greeting based on time of day
 */
function getTimeBasedGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Calculate lead score based on role additions
 */
function calculateInitialLeadScore(member) {
  let score = 10; // Base score for becoming a lead
  
  // Bonus points for other roles
  const highValueRoles = ['VIP', 'Premium', 'Owner', 'Investor', 'Partner'];
  for (const roleName of highValueRoles) {
    if (member.roles.cache.some(r => r.name.toLowerCase() === roleName.toLowerCase())) {
      score += 25;
    }
  }
  
  // Bonus for boosting server
  if (member.premiumSince) {
    score += 15;
  }
  
  return score;
}

module.exports = (client) => {
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
      // Get the role named "Lead" (case‑insensitive)
      const leadRole = newMember.guild.roles.cache.find(
        r => r.name.toLowerCase() === 'lead'
      );
      if (!leadRole) return;

      const hadLead = oldMember.roles.cache.has(leadRole.id);
      const hasLead = newMember.roles.cache.has(leadRole.id);

      // Only trigger when Lead role is ADDED (not removed)
      if (!hadLead && hasLead) {
        logger.info(`👤 ${newMember.user.tag} became a Lead in ${newMember.guild.name}`);

        // Calculate lead score
        const leadScore = calculateInitialLeadScore(newMember);

        // Save lead to database
        try {
          await upsertLead(
            newMember.guild.id,
            newMember.user.id,
            newMember.user.username,
            leadScore
          );
          logger.debug(`Lead saved to database: ${newMember.user.tag} (Score: ${leadScore})`);
        } catch (dbErr) {
          logger.error('Failed to save lead to database:', dbErr);
        }

        // Log to ticket logs channel if configured
        const config = await getGuildConfig(newMember.guild.id).catch(() => null);
        if (config?.ticket_logs_channel_id) {
          const logChannel = newMember.guild.channels.cache.get(config.ticket_logs_channel_id);
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle('👤 New Lead Detected')
              .setDescription(`${newMember.user.tag} was assigned the Lead role`)
              .addFields(
                { name: 'User', value: `${newMember.user.tag} (${newMember.user.id})`, inline: true },
                { name: 'Lead Score', value: `${leadScore} points`, inline: true },
                { name: 'Account Created', value: `<t:${Math.floor(newMember.user.createdTimestamp / 1000)}:R>`, inline: true }
              )
              .setColor('#FFD700')
              .setThumbnail(newMember.user.displayAvatarURL())
              .setTimestamp();
            
            logChannel.send({ embeds: [logEmbed] }).catch(() => {});
          }
        }

        // Use static URL or fallback
        const staticBase = process.env.STATIC_URL || 'https://cdn.byd.com/bot';
        const greeting = getTimeBasedGreeting();

        // Build a premium, conversion‑optimised welcome DM (USD)
        const embed = new EmbedBuilder()
          .setTitle(`⚡ ${greeting}, ${newMember.user.username}! Welcome to the BYD Elite Circle!`)
          .setDescription(
            `You've been recognized as a **Lead** – unlocking **priority access** to:\n\n` +
            `🔋 **Real‑time US EV Incentives**\n` +
            `• Federal tax credits up to $7,500\n` +
            `• State‑specific rebates & HOV access\n\n` +
            `🚗 **VIP Test Drive Experience**\n` +
            `• Home delivery – we bring the car to you\n` +
            `• Extended 2‑hour test drives\n\n` +
            `💰 **Exclusive Lead Pricing**\n` +
            `• Early access to launch editions\n` +
            `• Priority financing & lease options\n\n` +
            `💬 **Personal BYD Advisor**\n` +
            `• Dedicated expert for all questions\n` +
            `• Response within 1 hour\n\n` +
            `> *"${getRandomItem(testimonials)}"*\n\n` +
            `**${getRandomItem(urgencyPhrases)}**\n\n` +
            `👉 **Ready to explore?** Choose a model below and your personal advisor will reach out!`
          )
          .setColor('#FFD700')
          .setThumbnail(`${staticBase}/byd-logo.png`)
          .setImage(`${staticBase}/byd-lineup.jpg`) // Add lineup image if available
          .setFooter({ 
            text: '⚡ Blade Battery Technology • Trusted by 15,000+ US drivers • Your Lead Score: ' + leadScore, 
            iconURL: `${staticBase}/byd-logo.png`
          })
          .setTimestamp();

        // Model buttons - Row 1: Popular models
        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('welcome_model_seal')
            .setLabel('🦭 BYD Seal')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚡'),
          new ButtonBuilder()
            .setCustomId('welcome_model_atto3')
            .setLabel('⚔️ ATTO 3')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🚙'),
          new ButtonBuilder()
            .setCustomId('welcome_model_dolphin')
            .setLabel('🐬 Dolphin')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💙')
        );

        // Model buttons - Row 2: Premium & other options
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('welcome_model_han')
            .setLabel('🏯 Han')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👑'),
          new ButtonBuilder()
            .setCustomId('welcome_model_commercial')
            .setLabel('🚌 Commercial')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('welcome_model_notsure')
            .setLabel('❓ Help Me Choose')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🤔')
        );

        // Quick action buttons - Row 3
        const row3 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('action_brochure')
            .setLabel('📄 Brochure')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('action_quote')
            .setLabel('💰 Get Quote')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('action_testdrive')
            .setLabel('🗓️ Book Test Drive')
            .setStyle(ButtonStyle.Danger)
        );

        try {
          // Send the welcome DM
          await newMember.send({ 
            embeds: [embed], 
            components: [row1, row2, row3] 
          });
          
          logger.success(`📨 Premium welcome DM sent to ${newMember.user.tag} (Lead Score: ${leadScore})`);
          
          // Optional: Send a second follow-up message after 2 minutes
          setTimeout(async () => {
            try {
              const followUpEmbed = new EmbedBuilder()
                .setTitle('💡 Quick Tip for New Leads')
                .setDescription(
                  `Hey ${newMember.user.username}! 👋\n\n` +
                  `Here's a quick tip: **Book a test drive this week** and you'll receive:\n\n` +
                  `• 🎁 Free BYD merchandise kit\n` +
                  `• 📊 Personalized cost‑savings analysis\n` +
                  `• 🔌 Complimentary home charging assessment\n\n` +
                  `No pressure, no obligation – just a fun experience! 🚗✨\n\n` +
                  `Tap **🗓️ Book Test Drive** above to schedule yours!`
                )
                .setColor('#00BFFF')
                .setFooter({ text: '⚡ BYD Blade Battery • Powering the future' });
              
              await newMember.send({ embeds: [followUpEmbed] });
              logger.debug(`Follow-up DM sent to ${newMember.user.tag}`);
            } catch (followUpErr) {
              // Silently fail if user blocked DMs
              logger.debug(`Follow-up DM failed for ${newMember.user.tag} (likely DMs closed)`);
            }
          }, 2 * 60 * 1000); // 2 minutes

        } catch (err) {
          // User might have DMs disabled
          logger.warn(`⚠️ Could not DM ${newMember.user.tag} (DMs may be closed)`);
          
          // Try to send a welcome message in a public channel
          try {
            const systemChannel = newMember.guild.systemChannel;
            const welcomeChannel = newMember.guild.channels.cache.find(
              c => c.name === 'welcome' || c.name === 'introductions' || c.name === 'general'
            );
            
            const targetChannel = welcomeChannel || systemChannel;
            
            if (targetChannel) {
              const publicEmbed = new EmbedBuilder()
                .setTitle(`👋 Welcome our newest Lead, ${newMember.user.username}!`)
                .setDescription(
                  `${newMember.user}, you've been recognized as a **Lead**!\n\n` +
                  `Check your DMs for exclusive access, or use \`/help\` to explore our features.\n\n` +
                  `🚗 **Browse Models** • 💰 **Get a Quote** • 🗓️ **Book a Test Drive**`
                )
                .setColor('#FFD700')
                .setThumbnail(newMember.user.displayAvatarURL())
                .setTimestamp();
              
              await targetChannel.send({ 
                content: `${newMember.user}`, 
                embeds: [publicEmbed] 
              });
              logger.info(`📢 Public welcome sent for ${newMember.user.tag} in #${targetChannel.name}`);
            }
          } catch (publicErr) {
            logger.error(`Failed to send public welcome for ${newMember.user.tag}:`, publicErr);
          }
        }
      }

      // Optional: Handle Lead role REMOVAL
      if (hadLead && !hasLead) {
        logger.info(`👤 ${newMember.user.tag} is no longer a Lead in ${newMember.guild.name}`);
        
        // Log to ticket logs channel if configured
        const config = await getGuildConfig(newMember.guild.id).catch(() => null);
        if (config?.ticket_logs_channel_id) {
          const logChannel = newMember.guild.channels.cache.get(config.ticket_logs_channel_id);
          if (logChannel) {
            logChannel.send(`🔻 ${newMember.user.tag} had the Lead role removed.`).catch(() => {});
          }
        }
      }

    } catch (err) {
      logger.error('Error in guildMemberUpdate event:', err);
    }
  });
};