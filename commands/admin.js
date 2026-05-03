// commands/admin.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('../utils/database');
const { isAdmin } = require('../utils/permissions');
const { getAutoPostStats } = require('../schedulers/autoPost');
const { getApiStats } = require('../utils/openai');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('🎛️ BYD Bot Admin Dashboard'),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: '❌ Only admins can use this dashboard.', ephemeral: true });
    }

    const guildId = interaction.guildId;
    const config = await getGuildConfig(guildId);

    // Get auto-poster stats if available
    let autoPostStats = null;
    let apiStats = null;
    try {
      autoPostStats = getAutoPostStats();
      apiStats = getApiStats();
    } catch (err) {
      logger.debug('Stats not available yet:', err.message);
    }

    // Format configured items
    const verifyRole = config.verify_role_id ? `<@&${config.verify_role_id}>` : '❌ Not set';
    const ticketCategory = config.ticket_category_id ? `<#${config.ticket_category_id}>` : '❌ Not set';
    const staffRole = config.staff_role_id ? `<@&${config.staff_role_id}>` : '❌ Not set';
    const logsChannel = config.ticket_logs_channel_id ? `<#${config.ticket_logs_channel_id}>` : '❌ Not set';
    const autoPostEnabled = config.auto_post_enabled ? '🟢 Enabled' : '🔴 Disabled';
    const autoPostChannels = config.auto_post_channels?.length ? config.auto_post_channels.map(id => `<#${id}>`).join(', ') : 'None';
    const lobbyStatus = config.lobby_chatter_enabled ? '🟢 Enabled' : '🔴 Disabled';
    const lobbyWebhook = config.lobby_webhook_url ? '✅ Set' : '❌ Not set';
    const giveawayPingRole = config.giveaway_ping_role_id ? `<@&${config.giveaway_ping_role_id}>` : '❌ Not set';

    // Build the main embed
    const embed = new EmbedBuilder()
      .setTitle('🎛️ BYD Bot Admin Dashboard')
      .setDescription('Configure all automated systems for your server.')
      .setColor('#00BFFF')
      .addFields(
        { 
          name: '✅ Verification', 
          value: `**Status:** ${config.verify_enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Role:** ${verifyRole}`, 
          inline: true 
        },
        { 
          name: '🎫 Ticket System', 
          value: `**Category:** ${ticketCategory}\n**Staff Role:** ${staffRole}\n**Logs Channel:** ${logsChannel}`, 
          inline: true 
        },
        { 
          name: '🤖 Auto Poster', 
          value: getAutoPostFieldValue(config, autoPostChannels, autoPostStats), 
          inline: true 
        },
        { 
          name: '💬 Lobby Chatter', 
          value: `**Status:** ${lobbyStatus}\n**Webhook:** ${lobbyWebhook}`, 
          inline: true 
        },
        { 
          name: '🎁 Giveaways', 
          value: `**Ping Role:** ${giveawayPingRole}\n**Commands:** \`/giveaway\` \`/cargiveaway\``, 
          inline: true 
        }
      )
      .setFooter({ text: 'Use the buttons below to configure each system.' })
      .setTimestamp();

    // Add auto-poster stats if available
    if (autoPostStats && autoPostStats.totalPosts > 0) {
      embed.addFields({
        name: '📊 Auto Poster Statistics',
        value: getStatsFieldValue(autoPostStats, apiStats),
        inline: false
      });
    }

    // Add system health indicator
    if (apiStats) {
      const healthStatus = getHealthStatus(apiStats);
      embed.addFields({
        name: '🏥 System Health',
        value: healthStatus,
        inline: false
      });
    }

    // Add fallback content status
    if (apiStats && apiStats.fallbackPostsAvailable > 0) {
      embed.addFields({
        name: '📦 Fallback Content Pool',
        value: `**Available Posts:** ${apiStats.fallbackPostsAvailable}\n**With Images:** ${apiStats.fallbackPostsWithImages || 0}\n**Times Used:** ${apiStats.fallbackUsed || 0}`,
        inline: false
      });
    }

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_verify_menu').setLabel('✅ Verification').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_ticket_menu').setLabel('🎫 Ticket System').setStyle(ButtonStyle.Primary)
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_autopost_menu').setLabel('🤖 Auto Poster').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_lobby_menu').setLabel('💬 Lobby Chatter').setStyle(ButtonStyle.Primary)
    );
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_giveaway_menu').setLabel('🎁 Giveaway Settings').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary)
    );
    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_stats_detail').setLabel('📊 Detailed Stats').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_test_autopost').setLabel('🧪 Test Auto Post').setStyle(ButtonStyle.Success)
    );

    await interaction.reply({ 
      embeds: [embed], 
      components: [row1, row2, row3, row4], 
      ephemeral: true 
    });
  },

  // ============================================
  // BUTTON HANDLER (called from interactionCreate.js)
  // ============================================
  async handleButton(interaction) {
    if (!interaction.isButton()) return false;
    if (!interaction.customId.startsWith('admin_')) return false;

    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: '❌ Only admins can use these controls.', ephemeral: true });
    }

    switch (interaction.customId) {
      // Refresh
      case 'admin_refresh':
        await interaction.deferUpdate();
        await this.execute(interaction);
        break;

      // Detailed Stats
      case 'admin_stats_detail':
        await showDetailedStats(interaction);
        break;

      // Test Auto Post
      case 'admin_test_autopost':
        await testAutoPost(interaction);
        break;

      // Auto Post Menu
      case 'admin_autopost_menu':
        await showAutoPostMenu(interaction);
        break;

      // Verification Menu
      case 'admin_verify_menu':
        await showVerifyMenu(interaction);
        break;

      // Ticket Menu
      case 'admin_ticket_menu':
        await showTicketMenu(interaction);
        break;

      // Lobby Menu
      case 'admin_lobby_menu':
        await showLobbyMenu(interaction);
        break;

      // Giveaway Menu
      case 'admin_giveaway_menu':
        await showGiveawayMenu(interaction);
        break;

      // Auto Post Toggle
      case 'admin_autopost_toggle':
        await toggleAutoPost(interaction);
        break;

      default:
        return false;
    }

    return true;
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getAutoPostFieldValue(config, autoPostChannels, autoPostStats) {
  let value = `**Status:** ${config.auto_post_enabled ? '🟢 Enabled' : '🔴 Disabled'}\n`;
  value += `**Channels:** ${autoPostChannels}\n`;
  value += `**Interval:** Every ${config.auto_post_interval_hours || 2} hours\n`;
  value += `**Mode:** ${process.env.AUTO_POST_ALL_CHANNELS === 'true' ? 'All channels' : 'Round-robin'}\n`;
  
  if (autoPostStats && autoPostStats.totalPosts > 0) {
    value += `**Total Posts:** ${autoPostStats.totalPosts}\n`;
    value += `**Success Rate:** ${autoPostStats.successRate}\n`;
    value += `**API/Fallback:** ${autoPostStats.apiPosts || 0}/${autoPostStats.fallbackPosts || 0}`;
  }
  
  return value;
}

function getStatsFieldValue(autoPostStats, apiStats) {
  let value = '';
  
  if (autoPostStats) {
    value += `**Uptime:** ${autoPostStats.uptime}\n`;
    value += `**Total Posts:** ${autoPostStats.totalPosts}\n`;
    value += `**Successful:** ${autoPostStats.successfulPosts} | **Failed:** ${autoPostStats.failedPosts}\n`;
    value += `**Success Rate:** ${autoPostStats.successRate}\n`;
    
    if (autoPostStats.apiVsFallback && autoPostStats.apiVsFallback !== 'N/A') {
      value += `**Source Split:** ${autoPostStats.apiVsFallback}\n`;
    }
    
    if (autoPostStats.lastPostTime) {
      const lastPost = new Date(autoPostStats.lastPostTime);
      const unixTimestamp = Math.floor(lastPost.getTime() / 1000);
      value += `**Last Post:** <t:${unixTimestamp}:R>\n`;
    }

    if (autoPostStats.currentType) {
      value += `**Next Type:** ${autoPostStats.currentType}\n`;
    }
  }
  
  if (apiStats) {
    value += `\n**API Calls:** ${apiStats.totalRequests}\n`;
    value += `**API Success:** ${apiStats.successfulRequests} | **Failed:** ${apiStats.failedRequests}\n`;
    value += `**API Success Rate:** ${apiStats.successRate}\n`;
    value += `**Fallback Used:** ${apiStats.fallbackUsed || 0} times\n`;
    value += `**Fallback Posts Available:** ${apiStats.fallbackPostsAvailable || 0}\n`;
    value += `**Fallback With Images:** ${apiStats.fallbackPostsWithImages || 0}`;
  }
  
  return value || 'No stats available yet';
}

function getHealthStatus(apiStats) {
  let status = '';
  
  if (!process.env.OPENROUTER_API_KEY) {
    status += '⚠️ **API Key:** Not set (using fallback only)\n';
  } else {
    const successRate = apiStats.totalRequests > 0 
      ? (apiStats.successfulRequests / apiStats.totalRequests) * 100 
      : 100;
    
    if (apiStats.totalRequests === 0) {
      status += '⚪ **API:** No requests yet\n';
    } else if (successRate >= 90) {
      status += '🟢 **API:** Healthy\n';
    } else if (successRate >= 50) {
      status += '🟡 **API:** Degraded\n';
    } else {
      status += '🔴 **API:** Failing\n';
    }
    
    if (apiStats.lastError && apiStats.lastErrorTime) {
      const errorTime = new Date(apiStats.lastErrorTime);
      const unixTimestamp = Math.floor(errorTime.getTime() / 1000);
      status += `⚠️ **Last Error:** <t:${unixTimestamp}:R>\n`;
      status += `\`\`\`${apiStats.lastError.substring(0, 150)}\`\`\`\n`;
    }
  }
  
  if (apiStats.fallbackPostsAvailable > 0) {
    status += `🟢 **Fallback Content:** ${apiStats.fallbackPostsAvailable} posts ready\n`;
  } else {
    status += '🔴 **Fallback Content:** No posts available\n';
  }
  
  if (apiStats.fallbackPostsWithImages) {
    status += `🖼️ **Image Assets:** ${apiStats.fallbackPostsWithImages} posts have images`;
  }
  
  return status;
}

// ============================================
// MENU & ACTION FUNCTIONS
// ============================================

async function showDetailedStats(interaction) {
  const autoPostStats = getAutoPostStats();
  const apiStats = getApiStats();
  
  const statsEmbed = new EmbedBuilder()
    .setTitle('📊 Detailed System Statistics')
    .setColor('#00BFFF')
    .setTimestamp();

  if (autoPostStats) {
    let autoPostValue = '```yaml\n';
    autoPostValue += `Uptime: ${autoPostStats.uptime}\n`;
    autoPostValue += `Total Posts: ${autoPostStats.totalPosts}\n`;
    autoPostValue += `Successful: ${autoPostStats.successfulPosts}\n`;
    autoPostValue += `Failed: ${autoPostStats.failedPosts}\n`;
    autoPostValue += `Success Rate: ${autoPostStats.successRate}\n`;
    autoPostValue += `API Posts: ${autoPostStats.apiPosts || 0}\n`;
    autoPostValue += `Fallback Posts: ${autoPostStats.fallbackPosts || 0}\n`;
    autoPostValue += `Current Type: ${autoPostStats.currentType || 'N/A'}\n`;
    autoPostValue += `Schedule: ${autoPostStats.nextPostSchedule}\n`;
    if (autoPostStats.lastPostTime) {
      autoPostValue += `Last Post: ${new Date(autoPostStats.lastPostTime).toLocaleString()}\n`;
    }
    autoPostValue += '```';

    statsEmbed.addFields({
      name: '🤖 Auto Poster',
      value: autoPostValue,
      inline: false
    });
  }

  if (apiStats) {
    let apiValue = '```yaml\n';
    apiValue += `Total Requests: ${apiStats.totalRequests}\n`;
    apiValue += `Successful: ${apiStats.successfulRequests}\n`;
    apiValue += `Failed: ${apiStats.failedRequests}\n`;
    apiValue += `API Success Rate: ${apiStats.successRate}\n`;
    apiValue += `Fallback Used: ${apiStats.fallbackUsed || 0} times\n`;
    apiValue += `Fallback Posts: ${apiStats.fallbackPostsAvailable || 0} available\n`;
    apiValue += `Posts with Images: ${apiStats.fallbackPostsWithImages || 0}\n`;
    apiValue += `Avg Response Time: ${apiStats.averageResponseTime?.toFixed(0) || 'N/A'}ms\n`;
    apiValue += '```';

    statsEmbed.addFields({
      name: '🔌 API Usage',
      value: apiValue,
      inline: false
    });

    if (apiStats.models && apiStats.models.length > 0) {
      let modelInfo = '';
      for (const model of apiStats.models) {
        const successRate = model.requests > 0 
          ? ((model.successes / model.requests) * 100).toFixed(0) 
          : 0;
        const statusEmoji = successRate >= 80 ? '🟢' : successRate >= 50 ? '🟡' : '🔴';
        modelInfo += `${statusEmoji} ${model.model}\n`;
        modelInfo += `   Requests: ${model.successes}/${model.requests} (${successRate}%)\n`;
        modelInfo += `   Avg Time: ${model.averageTime}\n\n`;
      }
      statsEmbed.addFields({
        name: '🤖 Model Performance',
        value: modelInfo || 'No data available',
        inline: false
      });
    }
  }

  if (autoPostStats?.contentTypes) {
    let typeInfo = '';
    const typeNames = {
      'model_spotlight': '🚗 Model Spotlight',
      'ev_fact': '🔋 EV Fact',
      'byd_news': '📰 BYD News',
      'ev_tip': '🚀 EV Tip',
    };
    
    for (const [type, typeStats] of Object.entries(autoPostStats.contentTypes)) {
      const typeName = typeNames[type] || type;
      const successRate = typeStats.attempts > 0 
        ? ((typeStats.successes / typeStats.attempts) * 100).toFixed(0) 
        : 0;
      
      typeInfo += `${typeName}: ${typeStats.successes}/${typeStats.attempts} (${successRate}%)\n`;
      if (typeStats.api !== undefined || typeStats.fallback !== undefined) {
        typeInfo += `  └ API: ${typeStats.api || 0} | Fallback: ${typeStats.fallback || 0}\n`;
      }
    }
    statsEmbed.addFields({
      name: '📝 Content Types Breakdown',
      value: typeInfo || 'No data available',
      inline: false
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_stats_detail').setLabel('🔄 Refresh Stats').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_refresh').setLabel('↩️ Back to Dashboard').setStyle(ButtonStyle.Secondary)
  );

  // Handle both reply and update cases
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ embeds: [statsEmbed], components: [row] });
  } else {
    await interaction.reply({ embeds: [statsEmbed], components: [row], ephemeral: true });
  }
}

async function testAutoPost(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const { postAutoContent } = require('../schedulers/autoPost');
  
  try {
    logger.info(`Admin ${interaction.user.tag} triggered test auto post`);
    const success = await postAutoContent(interaction.client);
    
    if (success) {
      const autoPostStats = getAutoPostStats();
      await interaction.editReply({ 
        content: `✅ **Test auto post sent successfully!**\n\nCheck the configured channel for the post.\n\n📊 **Current Stats:**\n• Total Posts: ${autoPostStats.totalPosts}\n• Success Rate: ${autoPostStats.successRate}\n• Last Post: Just now`, 
        ephemeral: true 
      });
    } else {
      await interaction.editReply({ 
        content: '❌ **Failed to send test auto post.**\n\nPossible issues:\n• No channels configured\n• Missing permissions\n• Content generation failed\n\nCheck the bot logs for detailed error information.', 
        ephemeral: true 
      });
    }
  } catch (err) {
    logger.error('Test auto post failed:', err);
    await interaction.editReply({ 
      content: `❌ **Error during test post:**\n\`\`\`${err.message}\`\`\`\nCheck logs for full stack trace.`, 
      ephemeral: true 
    });
  }
}

async function showAutoPostMenu(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  const autoPostStats = getAutoPostStats();
  
  const embed = new EmbedBuilder()
    .setTitle('🤖 Auto Poster Configuration')
    .setDescription('Configure automated BYD content posting')
    .setColor('#9B59B6')
    .addFields(
      {
        name: 'Current Status',
        value: `**Enabled:** ${config.auto_post_enabled ? '🟢 Yes' : '🔴 No'}\n**Channels:** ${config.auto_post_channels?.length ? config.auto_post_channels.map(id => `<#${id}>`).join(', ') : 'None'}\n**Interval:** Every ${config.auto_post_interval_hours || 2} hours\n**Mode:** ${process.env.AUTO_POST_ALL_CHANNELS === 'true' ? 'All channels' : 'Round-robin'}`,
        inline: false
      },
      {
        name: 'Statistics',
        value: `**Total Posts:** ${autoPostStats?.totalPosts || 0}\n**Success Rate:** ${autoPostStats?.successRate || 'N/A'}\n**API/Fallback:** ${autoPostStats?.apiPosts || 0}/${autoPostStats?.fallbackPosts || 0}`,
        inline: false
      }
    )
    .setFooter({ text: 'Changes are saved automatically' })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_autopost_toggle')
      .setLabel(config.auto_post_enabled ? '🔴 Disable Auto Post' : '🟢 Enable Auto Post')
      .setStyle(config.auto_post_enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('admin_test_autopost')
      .setLabel('🧪 Test Post Now')
      .setStyle(ButtonStyle.Primary)
  );
  
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_refresh')
      .setLabel('↩️ Back to Dashboard')
      .setStyle(ButtonStyle.Secondary)
  );

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ embeds: [embed], components: [row1, row2] });
  } else {
    await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
  }
}

async function toggleAutoPost(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  config.auto_post_enabled = !config.auto_post_enabled;
  await setGuildConfig(interaction.guildId, config);
  
  const status = config.auto_post_enabled ? 'enabled' : 'disabled';
  await interaction.reply({ 
    content: `✅ Auto poster has been **${status}**.`, 
    ephemeral: true 
  });
  
  // Refresh the auto post menu
  setTimeout(async () => {
    await showAutoPostMenu(interaction);
  }, 500);
}

// Menu display functions
async function showVerifyMenu(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('✅ Verification Configuration')
    .setDescription('Configure the verification system for your server.')
    .setColor('#2ECC71');
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_set_verify_role').setLabel('📌 Set Role').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_toggle_verify').setLabel('⏻ Toggle Enable/Disable').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_post_verify_panel').setLabel('📢 Post Panel').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('admin_refresh').setLabel('◀ Back').setStyle(ButtonStyle.Secondary)
  );
  
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ embeds: [embed], components: [row] });
  } else {
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
}

async function showTicketMenu(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🎫 Ticket System Configuration')
    .setDescription('Configure the support ticket system.')
    .setColor('#3498DB');
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_set_ticket_category').setLabel('📂 Set Category').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_set_ticket_staff').setLabel('👥 Set Staff Role').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_set_ticket_logs').setLabel('📝 Set Logs Channel').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_post_ticket_panel').setLabel('📢 Post Panel').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('admin_refresh').setLabel('◀ Back').setStyle(ButtonStyle.Secondary)
  );
  
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ embeds: [embed], components: [row] });
  } else {
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
}

async function showLobbyMenu(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  const embed = new EmbedBuilder()
    .setTitle('💬 Lobby Chatter Configuration')
    .setDescription(
      `**Status:** ${config.lobby_chatter_enabled ? '🟢 Enabled' : '🔴 Disabled'}\n` +
      `**Webhook:** ${config.lobby_webhook_url ? '✅ Set' : '❌ Not set'}\n` +
      `**Personas:** ${config.lobby_chatter_personas?.length || 9} active`
    )
    .setColor('#9B59B6');
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_lobby_toggle').setLabel('⏻ Toggle On/Off').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_lobby_set_webhook').setLabel('🔗 Set Webhook URL').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_lobby_set_personas').setLabel('👥 Set Personas (JSON)').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_refresh').setLabel('◀ Back').setStyle(ButtonStyle.Secondary)
  );
  
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ embeds: [embed], components: [row] });
  } else {
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
}

async function showGiveawayMenu(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  const embed = new EmbedBuilder()
    .setTitle('🎁 Giveaway Configuration')
    .setDescription(
      `**Ping Role:** ${config.giveaway_ping_role_id ? `<@&${config.giveaway_ping_role_id}>` : '❌ Not set'}\n\n` +
      `**Available Commands:**\n` +
      `• \`/giveaway start prize:"Prize" duration:24 winners:1\`\n` +
      `• \`/giveaway end message_id:123\`\n` +
      `• \`/giveaway reroll message_id:123\`\n\n` +
      `**Car Giveaway Commands:**\n` +
      `• \`/cargiveaway start model:Seal shipping:1999 duration:168 winners:1\`\n` +
      `• \`/cargiveaway end message_id:123\`\n` +
      `• \`/cargiveaway winner message_id:123 user:@winner\``
    )
    .setColor('#FFD700');
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_giveaway_set_pingrole').setLabel('📌 Set Ping Role').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_refresh').setLabel('◀ Back').setStyle(ButtonStyle.Secondary)
  );
  
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ embeds: [embed], components: [row] });
  } else {
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
}