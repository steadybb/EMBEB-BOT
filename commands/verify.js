// commands/verify.js
const { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('../utils/database');
const { isAdmin } = require('../utils/permissions');
const logger = require('../utils/logger');

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

// ============================================
// VERIFICATION QUESTIONS
// ============================================
const verificationQuestions = [
  {
    id: 'interest',
    question: 'What interests you about BYD vehicles?',
    placeholder: 'e.g., Sustainability, Performance, Technology, Value, Test Drive'
  },
  {
    id: 'model',
    question: 'Which BYD model(s) are you most interested in?',
    placeholder: 'e.g., Seal, ATTO 3, Dolphin, Han, Yangwang U8'
  },
  {
    id: 'referral',
    question: 'How did you hear about BYD?',
    placeholder: 'e.g., Social Media, Friend, Advertisement, Test Drive Event'
  }
];

// ============================================
// HELPER FUNCTIONS
// ============================================
function getVerificationEmbed() {
  return new EmbedBuilder()
    .setTitle('⚡ Welcome to the BYD Community')
    .setDescription(
      `Before you explore test drives, exclusive offers, and owner discussions, we need a quick verification — it helps keep our community safe and spam‑free.\n\n` +
      `**Click the button below** to get instant access. You'll also unlock:\n` +
      `• 🔒 Private test drive booking\n` +
      `• 💰 Real‑time EV incentives (federal + state rebates)\n` +
      `• 🎫 Priority support tickets\n` +
      `• 📊 Exclusive owner statistics\n` +
      `• 🎁 Early access to limited‑edition BYD drops\n\n` +
      `✨ Verified members get **priority test drive scheduling** and **exclusive event invites**.`
    )
    .setColor('#00BFFF')
    .setThumbnail('https://cdn.byd.com/bot/byd-logo.png')
    .setFooter({ 
      text: '⚡ Blade Battery Technology • Trusted by 15,000+ drivers', 
      iconURL: 'https://cdn.byd.com/bot/byd-logo.png' 
    })
    .setTimestamp();
}

function getVerificationModal() {
  const modal = new ModalBuilder()
    .setCustomId('verify_modal')
    .setTitle('BYD Community Verification');
  
  // Add a welcome message field
  const welcomeInput = new TextInputBuilder()
    .setCustomId('welcome')
    .setLabel('Introduce yourself!')
    .setPlaceholder('Hi, I\'m interested in BYD because...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);
  
  modal.addComponents(new ActionRowBuilder().addComponents(welcomeInput));
  
  // Add verification questions
  for (const q of verificationQuestions) {
    const input = new TextInputBuilder()
      .setCustomId(q.id)
      .setLabel(q.question)
      .setPlaceholder(q.placeholder)
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(200);
    
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }
  
  return modal;
}

function getVerifiedEmbed(username, answers) {
  const embed = new EmbedBuilder()
    .setTitle('✅ Verification Successful!')
    .setDescription(`Welcome to the BYD community, **${username}**! 🎉\n\nYou now have access to all channels and features.\n\n### 📋 What's Next?\n• Check out <#test-drive> to book a test drive\n• Visit <#pricing> for real-time incentives\n• Join <#general> to meet other BYD owners\n• Explore <#giveaways> for exclusive contests\n\n### 📊 Your Interests:\n${answers.welcome ? `• **Introduction:** ${answers.welcome.substring(0, 100)}${answers.welcome.length > 100 ? '...' : ''}\n` : ''}${answers.interest ? `• **Interest:** ${answers.interest}\n` : ''}${answers.model ? `• **Models:** ${answers.model}\n` : ''}${answers.referral ? `• **Found via:** ${answers.referral}\n` : ''}\nThank you for joining the BYD family! 🚗`)
    .setColor('#00FF00')
    .setFooter({ text: 'BYD Community • Build Your Dreams' })
    .setTimestamp();
  
  return embed;
}

// ============================================
// LOGGING FUNCTION
// ============================================
async function logVerification(guild, user, answers) {
  const config = await getGuildConfig(guild.id);
  
  if (config.ticket_logs_channel_id) {
    const logsChannel = guild.channels.cache.get(config.ticket_logs_channel_id);
    if (logsChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('✅ User Verified')
        .setDescription(`**User:** ${user.tag} (<@${user.id}>)\n**User ID:** ${user.id}\n**Verified at:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n**Responses:**\n• Introduction: ${answers.welcome?.substring(0, 100) || 'N/A'}\n• Interest: ${answers.interest || 'N/A'}\n• Models: ${answers.model || 'N/A'}\n• Referral: ${answers.referral || 'N/A'}`)
        .setColor('#00FF00')
        .setTimestamp();
      
      await logsChannel.send({ embeds: [logEmbed] });
    }
  }
  
  logger.info(`User ${user.tag} verified in guild ${guild.id}`);
}

// ============================================
// SLASH COMMAND
// ============================================
module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('🔐 BYD server verification (admin only)')
    .addSubcommand(sub => 
      sub.setName('setup')
        .setDescription('Post the verification button panel (branded)')
    )
    .addSubcommand(sub => 
      sub.setName('role')
        .setDescription('Set the role to give upon verification')
        .addRoleOption(opt => 
          opt.setName('role')
            .setDescription('The role to assign to verified users')
            .setRequired(true)
        )
    )
    .addSubcommand(sub => 
      sub.setName('channel')
        .setDescription('Set the channel where verification panel should be posted')
        .addChannelOption(opt => 
          opt.setName('channel')
            .setDescription('Text channel for verification panel')
            .setRequired(true)
        )
    )
    .addSubcommand(sub => 
      sub.setName('enable')
        .setDescription('Enable verification system')
    )
    .addSubcommand(sub => 
      sub.setName('disable')
        .setDescription('Disable verification system')
    )
    .addSubcommand(sub => 
      sub.setName('check')
        .setDescription('Check verification status of a user')
        .addUserOption(opt => 
          opt.setName('user')
            .setDescription('User to check')
            .setRequired(true)
        )
    )
    .addSubcommand(sub => 
      sub.setName('remove')
        .setDescription('Remove verification role from a user')
        .addUserOption(opt => 
          opt.setName('user')
            .setDescription('User to unverify')
            .setRequired(true)
        )
    )
    .addSubcommand(sub => 
      sub.setName('stats')
        .setDescription('Show verification statistics')
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      logger.warn(`⛔ Non‑admin ${interaction.user.tag} tried /verify`);
      return interaction.reply({ 
        content: '❌ This command is for BYD server admins only.', 
        ...EPHEMERAL 
      });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ---- Set verification channel ----
    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel');
      const config = await getGuildConfig(guildId);
      config.verify_channel_id = channel.id;
      await setGuildConfig(guildId, config);
      logger.success(`Verification channel set to #${channel.name} in guild ${guildId}`);
      return interaction.reply({ 
        content: `✅ Verification channel set to ${channel.name}`, 
        ...EPHEMERAL 
      });
    }

    // ---- Set verification role ----
    if (sub === 'role') {
      const role = interaction.options.getRole('role');
      const config = await getGuildConfig(guildId);
      config.verify_role_id = role.id;
      await setGuildConfig(guildId, config);
      logger.success(`Verification role set to "${role.name}" in guild ${guildId}`);
      return interaction.reply({ 
        content: `✅ Verification role set to ${role.name}`, 
        ...EPHEMERAL 
      });
    }

    // ---- Enable verification system ----
    if (sub === 'enable') {
      const config = await getGuildConfig(guildId);
      if (!config.verify_role_id) {
        return interaction.reply({ 
          content: '❌ Please set a role first using `/verify role`.', 
          ...EPHEMERAL 
        });
      }
      config.verify_enabled = true;
      await setGuildConfig(guildId, config);
      logger.info(`Verification system ENABLED in guild ${guildId}`);
      return interaction.reply({ 
        content: '✅ Verification enabled. Use `/verify setup` to post the button panel.', 
        ...EPHEMERAL 
      });
    }

    // ---- Disable verification system ----
    if (sub === 'disable') {
      const config = await getGuildConfig(guildId);
      config.verify_enabled = false;
      await setGuildConfig(guildId, config);
      logger.info(`Verification system DISABLED in guild ${guildId}`);
      return interaction.reply({ 
        content: '❌ Verification disabled. New members will not be prompted.', 
        ...EPHEMERAL 
      });
    }

    // ---- Check user verification status ----
    if (sub === 'check') {
      const targetUser = interaction.options.getUser('user');
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      const config = await getGuildConfig(guildId);
      
      if (!member) {
        return interaction.reply({ 
          content: '❌ User not found in this server.', 
          ...EPHEMERAL 
        });
      }
      
      const isVerified = config.verify_role_id ? member.roles.cache.has(config.verify_role_id) : false;
      
      const embed = new EmbedBuilder()
        .setTitle('🔍 Verification Status')
        .setDescription(`**User:** ${targetUser.tag}\n**Status:** ${isVerified ? '✅ Verified' : '❌ Not Verified'}`)
        .setColor(isVerified ? '#00FF00' : '#FF0000')
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ...EPHEMERAL });
    }

    // ---- Remove verification from user ----
    if (sub === 'remove') {
      const targetUser = interaction.options.getUser('user');
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      const config = await getGuildConfig(guildId);
      
      if (!member) {
        return interaction.reply({ 
          content: '❌ User not found in this server.', 
          ...EPHEMERAL 
        });
      }
      
      if (!config.verify_role_id) {
        return interaction.reply({ 
          content: '❌ Verification role not configured.', 
          ...EPHEMERAL 
        });
      }
      
      if (!member.roles.cache.has(config.verify_role_id)) {
        return interaction.reply({ 
          content: `❌ ${targetUser.tag} is not verified.`, 
          ...EPHEMERAL 
        });
      }
      
      await member.roles.remove(config.verify_role_id);
      
      const embed = new EmbedBuilder()
        .setTitle('❌ Verification Removed')
        .setDescription(`**User:** ${targetUser.tag}\n**Action by:** ${interaction.user.tag}\n**Role removed:** <@&${config.verify_role_id}>`)
        .setColor('#FF0000')
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed], ...EPHEMERAL });
      logger.info(`Verification removed from ${targetUser.tag} by ${interaction.user.tag}`);
      
      // DM the user
      try {
        await targetUser.send({ 
          embeds: [new EmbedBuilder()
            .setTitle('❌ Verification Revoked')
            .setDescription(`Your verification has been removed in **${interaction.guild.name}**.\n\nPlease contact an admin if you believe this is an error.`)
            .setColor('#FF0000')
            .setTimestamp()
          ] 
        });
      } catch {}
    }

    // ---- Show verification statistics ----
    if (sub === 'stats') {
      const config = await getGuildConfig(guildId);
      const members = await interaction.guild.members.fetch();
      
      let verifiedCount = 0;
      if (config.verify_role_id) {
        const role = interaction.guild.roles.cache.get(config.verify_role_id);
        if (role) {
          verifiedCount = role.members.size;
        }
      }
      
      const totalMembers = members.size;
      const percentVerified = totalMembers > 0 ? ((verifiedCount / totalMembers) * 100).toFixed(1) : 0;
      
      const embed = new EmbedBuilder()
        .setTitle('📊 Verification Statistics')
        .setDescription(`**Server:** ${interaction.guild.name}\n**Verification System:** ${config.verify_enabled ? '✅ Enabled' : '❌ Disabled'}`)
        .addFields(
          { name: '👥 Total Members', value: totalMembers.toLocaleString(), inline: true },
          { name: '✅ Verified Members', value: verifiedCount.toLocaleString(), inline: true },
          { name: '📈 Verification Rate', value: `${percentVerified}%`, inline: true },
          { name: '🎭 Verification Role', value: config.verify_role_id ? `<@&${config.verify_role_id}>` : 'Not set', inline: true },
          { name: '📢 Panel Channel', value: config.verify_channel_id ? `<#${config.verify_channel_id}>` : 'Not set', inline: true }
        )
        .setColor('#00BFFF')
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ...EPHEMERAL });
    }

    // ---- Setup verification panel ----
    if (sub === 'setup') {
      const config = await getGuildConfig(guildId);
      if (!config.verify_enabled) {
        return interaction.reply({ 
          content: '❌ Verification not enabled. Use `/verify enable` first.', 
          ...EPHEMERAL 
        });
      }
      if (!config.verify_role_id) {
        return interaction.reply({ 
          content: '❌ Verification role not set. Use `/verify role` first.', 
          ...EPHEMERAL 
        });
      }
      
      // Determine where to post
      let targetChannel = interaction.channel;
      if (config.verify_channel_id) {
        const channel = interaction.guild.channels.cache.get(config.verify_channel_id);
        if (channel) targetChannel = channel;
      }
      
      const embed = getVerificationEmbed();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('verify_button')
          .setLabel('✅ Verify Me – It\'s Free')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🔑')
      );
      
      await targetChannel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ 
        content: `✅ Verification panel posted in ${targetChannel}`, 
        ...EPHEMERAL 
      });
      logger.success(`Verification panel posted in #${targetChannel.name} (guild ${guildId})`);
    }
  },
  
  // ============================================
  // BUTTON HANDLER
  // ============================================
  async handleButton(interaction) {
    if (interaction.customId !== 'verify_button') return false;
    
    const config = await getGuildConfig(interaction.guildId);
    
    if (!config.verify_enabled) {
      return interaction.reply({ 
        content: '❌ Verification is currently disabled. Please contact an administrator.', 
        ...EPHEMERAL 
      });
    }
    
    if (!config.verify_role_id) {
      return interaction.reply({ 
        content: '❌ Verification role not configured. Please contact an administrator.', 
        ...EPHEMERAL 
      });
    }
    
    // Check if user is already verified
    const member = interaction.member;
    if (member.roles.cache.has(config.verify_role_id)) {
      return interaction.reply({ 
        content: '✅ You are already verified! Welcome to the BYD community! 🚗', 
        ...EPHEMERAL 
      });
    }
    
    const modal = getVerificationModal();
    await interaction.showModal(modal);
    return true;
  },
  
  // ============================================
  // MODAL HANDLER
  // ============================================
  async handleModal(interaction) {
    if (interaction.customId !== 'verify_modal') return false;
    
    const config = await getGuildConfig(interaction.guildId);
    
    if (!config.verify_enabled) {
      return interaction.reply({ 
        content: '❌ Verification is currently disabled.', 
        ...EPHEMERAL 
      });
    }
    
    // Collect answers
    const answers = {
      welcome: interaction.fields.getTextInputValue('welcome'),
      interest: interaction.fields.getTextInputValue('interest'),
      model: interaction.fields.getTextInputValue('model'),
      referral: interaction.fields.getTextInputValue('referral')
    };
    
    // Add verification role
    const member = interaction.member;
    const role = interaction.guild.roles.cache.get(config.verify_role_id);
    
    if (!role) {
      return interaction.reply({ 
        content: '❌ Verification role not found. Please contact an administrator.', 
        ...EPHEMERAL 
      });
    }
    
    await member.roles.add(role);
    
    // Log verification
    await logVerification(interaction.guild, interaction.user, answers);
    
    // Send confirmation
    const embed = getVerifiedEmbed(interaction.user.username, answers);
    await interaction.reply({ embeds: [embed], ...EPHEMERAL });
    
    // Optional: Send welcome DM
    try {
      await interaction.user.send({ 
        embeds: [new EmbedBuilder()
          .setTitle('🚗 Welcome to the BYD Family!')
          .setDescription(`Thank you for verifying in **${interaction.guild.name}**!\n\nYou now have access to:\n• 🔒 Test drive booking\n• 💰 EV incentives tracker\n• 🎫 Priority support\n• 🎁 Exclusive giveaways\n\nStart exploring and feel free to ask questions in <#general>!\n\n⚡ Build Your Dreams with BYD!`)
          .setColor('#00FF00')
          .setTimestamp()
        ] 
      });
    } catch (err) {
      logger.debug(`Could not send welcome DM to ${interaction.user.tag}`);
    }
    
    logger.info(`User ${interaction.user.tag} verified in guild ${interaction.guildId}`);
    return true;
  }
};