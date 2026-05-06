// events/guildMemberUpdate.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { upsertLead, getGuildConfig, updateLastFollowup } = require('../utils/database');
const logger = require('../utils/logger');

// USD testimonials (US states)
const testimonials = [
  "“Saved $7,500 with federal credits – the Seal is a steal!” – Marina, CA",
  "“ATTO 3's Blade Battery gave my family real peace of mind.” – Carlos, TX",
  "“Free home charger installation? BYD really cares.” – Luisa, NY",
  "“0‑60 in 3.8s – the Han Performance is pure adrenaline.” – Felipe, FL",
  "“Best EV decision I ever made. And I saved thousands.” – Ahmed, CO",
  "“The Yangwang U8 is absolutely unreal – worth every penny.” – James, CA",
  "“BYD’s customer service blew me away. Real humans who care.” – Sarah, NY"
];

// US urgency phrases
const urgencyPhrases = [
  "⚡ Only 5 test drive slots left this week!",
  "🔥 Launch edition models – limited inventory!",
  "⏳ EV tax credits may phase out – lock yours now.",
  "🎁 Free Level 2 charger installation ends June 30.",
  "📉 0.99% financing – last 10 cars at this rate.",
  "🏆 BYD just won 'EV of the Year' – demand is surging!",
  "💨 Spring delivery slots filling fast – order this week!"
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
 * Get seasonal message based on month
 */
function getSeasonalMessage() {
  const month = new Date().getMonth();
  if (month >= 11 || month <= 1) return '❄️ Winter range protection technology included with every BYD!';
  if (month >= 2 && month <= 4) return '🌸 Spring into savings with 0% financing for qualified leads!';
  if (month >= 5 && month <= 7) return '☀️ Summer road trip ready – max A/C efficiency in all BYD models!';
  return '🍂 Fall EV event – test drive any BYD model this month!';
}

/**
 * Calculate lead score based on role additions
 */
function calculateInitialLeadScore(member) {
  let score = 10; // Base score for becoming a lead
  
  // Bonus points for other roles
  const highValueRoles = ['VIP', 'Premium', 'Owner', 'Investor', 'Partner', 'Supporter'];
  for (const roleName of highValueRoles) {
    if (member.roles.cache.some(r => r.name.toLowerCase() === roleName.toLowerCase())) {
      score += 25;
      break; // Only add once
    }
  }
  
  // Bonus for server booster
  if (member.premiumSince) {
    score += 15;
  }
  
  // Bonus for account age (older accounts get slightly higher score)
  const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
  if (accountAgeDays > 365) score += 10;
  else if (accountAgeDays > 180) score += 5;
  
  return Math.min(score, 100); // Cap at 100
}

/**
 * Get lead stage based on score
 */
function getLeadStage(score) {
  if (score >= 80) return 'HOT';
  if (score >= 60) return 'WARM';
  if (score >= 40) return 'INTERESTED';
  if (score >= 20) return 'AWARE';
  return 'NEW';
}

/**
 * Get emoji for lead stage
 */
function getLeadStageEmoji(stage) {
  switch (stage) {
    case 'HOT': return '🔥';
    case 'WARM': return '🟡';
    case 'INTERESTED': return '🔵';
    case 'AWARE': return '🟢';
    default: return '🆕';
  }
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
        const leadStage = getLeadStage(leadScore);
        const stageEmoji = getLeadStageEmoji(leadStage);

        // Save lead to database
        try {
          await upsertLead(
            newMember.user.id,
            newMember.user.username,
            {
              leadScore: leadScore,
              leadStage: leadStage,
              lastInteraction: new Date(),
              selectedModel: null,
              step: 'lead_assigned',
              tempData: { 
                assignedVia: 'role', 
                guildId: newMember.guild.id,
                assignedAt: new Date().toISOString(),
                initialScore: leadScore
              },
            }
          );
          logger.debug(`Lead saved to database: ${newMember.user.tag} (Score: ${leadScore}, Stage: ${leadStage})`);
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
                { name: 'Lead Stage', value: `${stageEmoji} ${leadStage}`, inline: true },
                { name: 'Account Created', value: `<t:${Math.floor(newMember.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: 'Joined Server', value: `<t:${Math.floor(newMember.joinedTimestamp / 1000)}:R>`, inline: true }
              )
              .setColor('#FFD700')
              .setThumbnail(newMember.user.displayAvatarURL())
              .setTimestamp();
            
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
          }
        }

        // Use static URL or fallback
        const staticBase = process.env.STATIC_URL || 'https://cdn.byd.com/bot';
        const greeting = getTimeBasedGreeting();
        const seasonalMessage = getSeasonalMessage();
        const randomTestimonial = getRandomItem(testimonials);
        const randomUrgency = getRandomItem(urgencyPhrases);

        // Build a premium, conversion‑optimised welcome DM
        const embed = new EmbedBuilder()
          .setTitle(`${getLeadStageEmoji(leadStage)} ${greeting}, ${newMember.user.username}! Welcome to the BYD Elite Circle!`)
          .setDescription(
            `You've been recognized as a **${leadStage} Lead** – unlocking **priority access** to:\n\n` +
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
            `> *"${randomTestimonial}"*\n\n` +
            `**${randomUrgency}**\n\n` +
            `🍀 **${seasonalMessage}**\n\n` +
            `👉 **Ready to explore?** Choose a model below and your personal advisor will reach out!`
          )
          .setColor(leadScore >= 80 ? '#FF0000' : leadScore >= 60 ? '#FFA500' : '#FFD700')
          .setThumbnail(`${staticBase}/byd-logo.png`)
          .setImage(`${staticBase}/byd-lineup.jpg`)
          .setFooter({ 
            text: `⚡ Blade Battery Technology • Trusted by 15,000+ US drivers • Lead Score: ${leadScore} (${leadStage})`, 
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
            .setCustomId('welcome_model_yangwang')
            .setLabel('🐉 Yangwang')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⭐'),
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
            .setLabel('📄 Digital Brochure')
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

        // Row 4: Additional resources
        const row4 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('action_incentives')
            .setLabel('💰 EV Incentives')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('action_compare')
            .setLabel('📊 Compare Models')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('action_specs')
            .setLabel('📋 Full Specs')
            .setStyle(ButtonStyle.Secondary)
        );

        try {
          // Send the welcome DM
          await newMember.send({ 
            embeds: [embed], 
            components: [row1, row2, row3, row4] 
          });
          
          logger.success(`📨 Premium welcome DM sent to ${newMember.user.tag} (Lead Score: ${leadScore}, Stage: ${leadStage})`);
          
          // Send a second follow-up message after 3 minutes
          setTimeout(async () => {
            try {
              const followUpEmbed = new EmbedBuilder()
                .setTitle('💡 Quick Tip for New Leads')
                .setDescription(
                  `Hey ${newMember.user.username}! 👋\n\n` +
                  `Here's a quick tip: **Book a test drive this week** and you'll receive:\n\n` +
                  `• 🎁 Free BYD merchandise kit\n` +
                  `• 📊 Personalized cost‑savings analysis\n` +
                  `• 🔌 Complimentary home charging assessment\n` +
                  `• 📞 30-min consultation with a BYD specialist\n\n` +
                  `No pressure, no obligation – just a fun experience! 🚗✨\n\n` +
                  `Tap **🗓️ Book Test Drive** above to schedule yours!`
                )
                .setColor('#00BFFF')
                .setFooter({ text: '⚡ BYD Blade Battery • Powering the future' })
                .setTimestamp();
              
              await newMember.send({ embeds: [followUpEmbed] });
              logger.debug(`Follow-up DM sent to ${newMember.user.tag}`);
            } catch (followUpErr) {
              logger.debug(`Follow-up DM failed for ${newMember.user.tag} (likely DMs closed)`);
            }
          }, 3 * 60 * 1000);

          // Send a third follow-up after 2 days
          setTimeout(async () => {
            try {
              const reminderEmbed = new EmbedBuilder()
                .setTitle('🚗 Still exploring BYD?')
                .setDescription(
                  `Hi ${newMember.user.username}! Just checking in.\n\n` +
                  `If you have any questions about BYD vehicles, incentives, or financing, ` +
                  `our team is here to help!\n\n` +
                  `Feel free to:\n` +
                  `• Reply to this DM\n` +
                  `• Use \`/help\` in the server\n` +
                  `• Click any button above to get started\n\n` +
                  `We look forward to helping you find your perfect BYD! 🌟`
                )
                .setColor('#9B59B6')
                .setTimestamp();
              
              await newMember.send({ embeds: [reminderEmbed] });
              logger.debug(`2-day follow-up DM sent to ${newMember.user.tag}`);
            } catch (reminderErr) {
              logger.debug(`2-day follow-up DM failed for ${newMember.user.tag}`);
            }
          }, 48 * 60 * 60 * 1000);

        } catch (err) {
          logger.warn(`⚠️ Could not DM ${newMember.user.tag} (DMs may be closed) - ${err.message}`);
          
          // Try to send a welcome message in a public channel
          try {
            const systemChannel = newMember.guild.systemChannel;
            const welcomeChannel = newMember.guild.channels.cache.find(
              c => c.name === 'welcome' || c.name === 'introductions' || c.name === 'general'
            );
            
            const targetChannel = welcomeChannel || systemChannel;
            
            if (targetChannel) {
              const publicEmbed = new EmbedBuilder()
                .setTitle(`👋 Welcome our newest ${stageEmoji} Lead, ${newMember.user.username}!`)
                .setDescription(
                  `${newMember.user}, you've been recognized as a **${leadStage} Lead**!\n\n` +
                  `We tried to send you a DM with exclusive access, but your DMs appear to be closed.\n\n` +
                  `Please enable DMs from server members or use \`/help\` to explore our features.\n\n` +
                  `🚗 **Browse Models** • 💰 **Get a Quote** • 🗓️ **Book a Test Drive**\n\n` +
                  `✨ Check out <#${config?.welcome_channel_id || 'your-channel'}> to get started!`
                )
                .setColor(leadScore >= 80 ? '#FF0000' : leadScore >= 60 ? '#FFA500' : '#FFD700')
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

      // Handle Lead role REMOVAL
      if (hadLead && !hasLead) {
        logger.info(`👤 ${newMember.user.tag} is no longer a Lead in ${newMember.guild.name}`);
        
        // Log to ticket logs channel if configured
        const config = await getGuildConfig(newMember.guild.id).catch(() => null);
        if (config?.ticket_logs_channel_id) {
          const logChannel = newMember.guild.channels.cache.get(config.ticket_logs_channel_id);
          if (logChannel) {
            const removalEmbed = new EmbedBuilder()
              .setTitle('🔻 Lead Role Removed')
              .setDescription(`${newMember.user.tag} no longer has the Lead role`)
              .addFields(
                { name: 'User', value: `${newMember.user.tag} (${newMember.user.id})`, inline: true },
                { name: 'Removed At', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
              )
              .setColor('#FF0000')
              .setThumbnail(newMember.user.displayAvatarURL())
              .setTimestamp();
            
            await logChannel.send({ embeds: [removalEmbed] }).catch(() => {});
          }
        }
        
        // Optionally send a DM about role removal
        try {
          const removalMessage = new EmbedBuilder()
            .setTitle('🔻 Lead Role Update')
            .setDescription(
              `Hi ${newMember.user.username},\n\n` +
              `Your Lead role in **${newMember.guild.name}** has been removed.\n\n` +
              `If you believe this is an error, please contact a server administrator.\n\n` +
              `Thank you for being part of the BYD community!`
            )
            .setColor('#FFA500')
            .setTimestamp();
          
          await newMember.send({ embeds: [removalMessage] });
        } catch (dmErr) {
          logger.debug(`Could not send role removal DM to ${newMember.user.tag}`);
        }
      }

    } catch (err) {
      logger.error('Error in guildMemberUpdate event:', err);
    }
  });
};