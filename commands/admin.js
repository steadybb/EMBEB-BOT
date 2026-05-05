// commands/admin.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, StringSelectMenuBuilder } = require('discord.js');
const { getGuildConfig, setGuildConfig, pool } = require('../utils/database');
const { isAdmin } = require('../utils/permissions');
const { getAutoPostStats } = require('../schedulers/autoPost');
const { getApiStats } = require('../utils/openai');
const logger = require('../utils/logger');

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('🎛️ BYD Bot Admin Dashboard'),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: '❌ Only admins can use this dashboard.', ...EPHEMERAL });
    }

    const guildId = interaction.guildId;
    const config = await getGuildConfig(guildId);

    let autoPostStats = null;
    let apiStats = null;
    let activeGiveaways = 0;
    try {
      autoPostStats = getAutoPostStats();
      apiStats = getApiStats();
      const gwRes = await pool.query('SELECT COUNT(*) as count FROM car_giveaways WHERE guild_id = $1 AND ended = false', [guildId]);
      activeGiveaways = parseInt(gwRes.rows[0]?.count || 0);
    } catch (err) {
      logger.debug('Stats not available yet:', err.message);
    }

    const verifyRole = config.verify_role_id ? `<@&${config.verify_role_id}>` : '❌ Not set';
    const ticketCategory = config.ticket_category_id ? `<#${config.ticket_category_id}>` : '❌ Not set';
    const staffRole = config.staff_role_id ? `<@&${config.staff_role_id}>` : '❌ Not set';
    const logsChannel = config.ticket_logs_channel_id ? `<#${config.ticket_logs_channel_id}>` : '❌ Not set';
    const autoPostEnabled = config.auto_post_enabled ? '🟢 Enabled' : '🔴 Disabled';
    const autoPostChannels = config.auto_post_channels?.length ? config.auto_post_channels.map(id => `<#${id}>`).join(', ') : 'None';
    const lobbyStatus = config.lobby_chatter_enabled ? '🟢 Enabled' : '🔴 Disabled';
    const lobbyWebhook = config.lobby_webhook_url ? '✅ Set' : '❌ Not set';
    const giveawayPingRole = config.giveaway_ping_role_id ? `<@&${config.giveaway_ping_role_id}>` : '❌ Not set';

    const embed = new EmbedBuilder()
      .setTitle('🎛️ BYD Bot Admin Dashboard')
      .setDescription('Configure all automated systems for your server.')
      .setColor('#00BFFF')
      .addFields(
        { name: '✅ Verification', value: `**Status:** ${config.verify_enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Role:** ${verifyRole}`, inline: true },
        { name: '🎫 Ticket System', value: `**Category:** ${ticketCategory}\n**Staff Role:** ${staffRole}\n**Logs Channel:** ${logsChannel}`, inline: true },
        { name: '🤖 Auto Poster', value: getAutoPostFieldValue(config, autoPostChannels, autoPostStats), inline: true },
        { name: '💬 Lobby Chatter', value: `**Status:** ${lobbyStatus}\n**Webhook:** ${lobbyWebhook}`, inline: true },
        { name: '🎁 Giveaways', value: `**Ping Role:** ${giveawayPingRole}\n**Active:** ${activeGiveaways} giveaway(s)\n**Commands:** \`/cargiveaway\``, inline: true }
      )
      .setFooter({ text: 'Use the buttons below to configure each system.' })
      .setTimestamp();

    if (autoPostStats && autoPostStats.totalPosts > 0) {
      embed.addFields({ name: '📊 Auto Poster Statistics', value: getStatsFieldValue(autoPostStats, apiStats), inline: false });
    }

    if (apiStats) {
      embed.addFields({ name: '🏥 System Health', value: getHealthStatus(apiStats), inline: false });
    }

    if (apiStats && apiStats.fallbackPostsAvailable > 0) {
      embed.addFields({ name: '📦 Fallback Content Pool', value: `**Available Posts:** ${apiStats.fallbackPostsAvailable}\n**With Images:** ${apiStats.fallbackPostsWithImages || 0}\n**Times Used:** ${apiStats.fallbackUsed || 0}`, inline: false });
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

    await interaction.reply({ embeds: [embed], components: [row1, row2, row3, row4], ...EPHEMERAL });
  },

  // ============================================
  // BUTTON HANDLER
  // ============================================
  async handleButton(interaction) {
    if (!interaction.isButton()) return false;
    if (!interaction.customId.startsWith('admin_')) return false;

    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: '❌ Only admins can use these controls.', ...EPHEMERAL });
    }

    switch (interaction.customId) {
      case 'admin_refresh': await interaction.deferUpdate(); await this.execute(interaction); break;
      case 'admin_stats_detail': await showDetailedStats(interaction); break;
      case 'admin_test_autopost': await testAutoPost(interaction); break;
      case 'admin_autopost_menu': await showAutoPostMenu(interaction); break;
      case 'admin_verify_menu': await showVerifyMenu(interaction); break;
      case 'admin_ticket_menu': await showTicketMenu(interaction); break;
      case 'admin_lobby_menu': await showLobbyMenu(interaction); break;
      case 'admin_giveaway_menu': await showGiveawayMenu(interaction); break;
      case 'admin_autopost_toggle': await toggleAutoPost(interaction); break;
      case 'admin_pull_all_leads': await pullAllLeads(interaction); break;
      case 'admin_pull_active_leads': await pullActiveGiveawayLeads(interaction); break;
      default: return false;
    }
    return true;
  }
};

// ============================================
// PULL LEADS FUNCTIONS
// ============================================

async function pullAllLeads(interaction) {
  await interaction.deferReply(EPHEMERAL);
  const guildId = interaction.guildId;

  const res = await pool.query(
    `SELECT cge.*, cg.car_model, cg.car_year, cg.msrp, cg.message_id, cg.ended
     FROM car_giveaway_entries cge
     JOIN car_giveaways cg ON cge.giveaway_id = cg.id
     WHERE cg.guild_id = $1
     ORDER BY cge.entered_at DESC
     LIMIT 100`,
    [guildId]
  );
  const entries = res.rows;

  if (entries.length === 0) {
    return interaction.editReply({ content: '📭 No giveaway leads found in this server.' });
  }

  const embed = new EmbedBuilder()
    .setTitle('📋 All Giveaway Leads')
    .setDescription(`Total entries: **${entries.length}**`)
    .setColor('#FFD700')
    .setTimestamp();

  const grouped = {};
  for (const e of entries) {
    const key = `${e.car_year} BYD ${e.car_model}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }

  for (const [giveawayName, leads] of Object.entries(grouped)) {
    embed.addFields({
      name: `${giveawayName} (${leads.length} leads)`,
      value: leads.slice(0, 10).map((l, i) => `**${i + 1}.** <@${l.user_id}> | 📧 ${l.user_email || 'N/A'} | 📱 ${l.user_phone || 'N/A'}`).join('\n') + (leads.length > 10 ? `\n*...and ${leads.length - 10} more*` : ''),
      inline: false
    });
  }

  let csv = 'Giveaway,User ID,Email,Phone,Entered At\n';
  for (const e of entries) {
    csv += `"${e.car_year} BYD ${e.car_model}",${e.user_id},${e.user_email || ''},${e.user_phone || ''},${e.entered_at}\n`;
  }

  await interaction.editReply({ embeds: [embed] });
  await interaction.followUp({ content: '📎 **CSV Export:**', files: [{ name: `all-leads.csv`, attachment: Buffer.from(csv) }], ...EPHEMERAL });
}

async function pullActiveGiveawayLeads(interaction) {
  await interaction.deferReply(EPHEMERAL);
  const guildId = interaction.guildId;

  const gwRes = await pool.query('SELECT * FROM car_giveaways WHERE guild_id = $1 AND ended = false ORDER BY end_time ASC', [guildId]);
  const giveaways = gwRes.rows;

  if (giveaways.length === 0) {
    return interaction.editReply({ content: '📭 No active giveaways in this server.' });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('admin_select_giveaway_leads')
    .setPlaceholder('Select a giveaway to pull leads')
    .addOptions(giveaways.slice(0, 25).map(gw => ({
      label: `${gw.car_year} BYD ${gw.car_model}`,
      description: `Ends: ${new Date(gw.end_time).toLocaleDateString()}`,
      value: gw.id.toString()
    })));

  const row = new ActionRowBuilder().addComponents(selectMenu);
  await interaction.editReply({ content: '📋 **Select a giveaway to export leads:**', components: [row] });
}

async function handleLeadSelect(interaction) {
  if (interaction.customId !== 'admin_select_giveaway_leads') return false;
  
  const giveawayId = parseInt(interaction.values[0]);
  const entriesRes = await pool.query('SELECT * FROM car_giveaway_entries WHERE giveaway_id = $1 ORDER BY entered_at ASC', [giveawayId]);
  const gwRes = await pool.query('SELECT * FROM car_giveaways WHERE id = $1', [giveawayId]);
  const giveaway = gwRes.rows[0];
  const entries = entriesRes.rows;

  if (!giveaway || entries.length === 0) {
    return interaction.update({ content: '❌ No leads found for this giveaway.', components: [] });
  }

  const embed = new EmbedBuilder()
    .setTitle(`📋 Leads: ${giveaway.car_year} BYD ${giveaway.car_model}`)
    .setDescription(`Total entries: **${entries.length}**\n\n${entries.map((e, i) => `**${i + 1}.** <@${e.user_id}>\n📧 ${e.user_email || 'N/A'}\n📱 ${e.user_phone || 'N/A'}\n🕐 <t:${Math.floor(new Date(e.entered_at).getTime() / 1000)}:R>`).join('\n\n')}`)
    .setColor('#FFD700')
    .setTimestamp();

  let csv = 'Name,User ID,Email,Phone,Entered At\n';
  for (const e of entries) {
    const user = await interaction.client.users.fetch(e.user_id).catch(() => null);
    csv += `"${user?.tag || 'Unknown'}",${e.user_id},${e.user_email || ''},${e.user_phone || ''},${e.entered_at}\n`;
  }

  await interaction.update({ embeds: [embed], components: [] });
  await interaction.followUp({ content: '📎 **CSV Export:**', files: [{ name: `leads-${giveaway.car_model}.csv`, attachment: Buffer.from(csv) }], ...EPHEMERAL });
  return true;
}

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
    if (autoPostStats.apiVsFallback && autoPostStats.apiVsFallback !== 'N/A') value += `**Source Split:** ${autoPostStats.apiVsFallback}\n`;
    if (autoPostStats.lastPostTime) {
      const unixTimestamp = Math.floor(new Date(autoPostStats.lastPostTime).getTime() / 1000);
      value += `**Last Post:** <t:${unixTimestamp}:R>\n`;
    }
    if (autoPostStats.currentType) value += `**Next Type:** ${autoPostStats.currentType}\n`;
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
  if (!process.env.OPENROUTER_API_KEY) status += '⚠️ **API Key:** Not set (using fallback only)\n';
  else {
    const successRate = apiStats.totalRequests > 0 ? (apiStats.successfulRequests / apiStats.totalRequests) * 100 : 100;
    if (apiStats.totalRequests === 0) status += '⚪ **API:** No requests yet\n';
    else if (successRate >= 90) status += '🟢 **API:** Healthy\n';
    else if (successRate >= 50) status += '🟡 **API:** Degraded\n';
    else status += '🔴 **API:** Failing\n';
    if (apiStats.lastError && apiStats.lastErrorTime) {
      const errorTime = new Date(apiStats.lastErrorTime);
      const unixTimestamp = Math.floor(errorTime.getTime() / 1000);
      status += `⚠️ **Last Error:** <t:${unixTimestamp}:R>\n\`\`\`${apiStats.lastError.substring(0, 150)}\`\`\`\n`;
    }
  }
  if (apiStats.fallbackPostsAvailable > 0) status += `🟢 **Fallback Content:** ${apiStats.fallbackPostsAvailable} posts ready\n`;
  else status += '🔴 **Fallback Content:** No posts available\n';
  if (apiStats.fallbackPostsWithImages) status += `🖼️ **Image Assets:** ${apiStats.fallbackPostsWithImages} posts have images`;
  return status;
}

// ============================================
// MENU & ACTION FUNCTIONS
// ============================================

async function showDetailedStats(interaction) {
  const autoPostStats = getAutoPostStats();
  const apiStats = getApiStats();
  const statsEmbed = new EmbedBuilder().setTitle('📊 Detailed System Statistics').setColor('#00BFFF').setTimestamp();

  if (autoPostStats) {
    let v = '```yaml\n';
    v += `Uptime: ${autoPostStats.uptime}\nTotal Posts: ${autoPostStats.totalPosts}\nSuccessful: ${autoPostStats.successfulPosts}\nFailed: ${autoPostStats.failedPosts}\nSuccess Rate: ${autoPostStats.successRate}\nAPI Posts: ${autoPostStats.apiPosts || 0}\nFallback Posts: ${autoPostStats.fallbackPosts || 0}\nCurrent Type: ${autoPostStats.currentType || 'N/A'}\nSchedule: ${autoPostStats.nextPostSchedule}\n`;
    if (autoPostStats.lastPostTime) v += `Last Post: ${new Date(autoPostStats.lastPostTime).toLocaleString()}\n`;
    v += '```';
    statsEmbed.addFields({ name: '🤖 Auto Poster', value: v, inline: false });
  }

  if (apiStats) {
    let v = '```yaml\n';
    v += `Total Requests: ${apiStats.totalRequests}\nSuccessful: ${apiStats.successfulRequests}\nFailed: ${apiStats.failedRequests}\nAPI Success Rate: ${apiStats.successRate}\nFallback Used: ${apiStats.fallbackUsed || 0} times\nFallback Posts: ${apiStats.fallbackPostsAvailable || 0} available\nPosts with Images: ${apiStats.fallbackPostsWithImages || 0}\nAvg Response Time: ${apiStats.averageResponseTime?.toFixed(0) || 'N/A'}ms\n`;
    v += '```';
    statsEmbed.addFields({ name: '🔌 API Usage', value: v, inline: false });

    if (apiStats.models && apiStats.models.length > 0) {
      let m = '';
      for (const model of apiStats.models) {
        const sr = model.requests > 0 ? ((model.successes / model.requests) * 100).toFixed(0) : 0;
        const emoji = sr >= 80 ? '🟢' : sr >= 50 ? '🟡' : '🔴';
        m += `${emoji} ${model.model}\n   Requests: ${model.successes}/${model.requests} (${sr}%)\n   Avg Time: ${model.averageTime}\n\n`;
      }
      statsEmbed.addFields({ name: '🤖 Model Performance', value: m || 'No data', inline: false });
    }
  }

  if (autoPostStats?.contentTypes) {
    let t = '';
    const names = { 'model_spotlight': '🚗 Model Spotlight', 'ev_fact': '🔋 EV Fact', 'byd_news': '📰 BYD News', 'ev_tip': '🚀 EV Tip' };
    for (const [type, ts] of Object.entries(autoPostStats.contentTypes)) {
      const sr = ts.attempts > 0 ? ((ts.successes / ts.attempts) * 100).toFixed(0) : 0;
      t += `${names[type] || type}: ${ts.successes}/${ts.attempts} (${sr}%)\n`;
      if (ts.api !== undefined || ts.fallback !== undefined) t += `  └ API: ${ts.api || 0} | Fallback: ${ts.fallback || 0}\n`;
    }
    statsEmbed.addFields({ name: '📝 Content Types', value: t || 'No data', inline: false });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_stats_detail').setLabel('🔄 Refresh').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_refresh').setLabel('↩️ Back').setStyle(ButtonStyle.Secondary)
  );

  if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [statsEmbed], components: [row] });
  else await interaction.reply({ embeds: [statsEmbed], components: [row], ...EPHEMERAL });
}

async function testAutoPost(interaction) {
  await interaction.deferReply(EPHEMERAL);
  const { postAutoContent } = require('../schedulers/autoPost');
  try {
    const success = await postAutoContent(interaction.client);
    const stats = getAutoPostStats();
    if (success) await interaction.editReply({ content: `✅ **Test post sent!**\n\n📊 Total Posts: ${stats.totalPosts}\nSuccess Rate: ${stats.successRate}` });
    else await interaction.editReply({ content: '❌ Failed to send test post. Check logs.' });
  } catch (err) {
    await interaction.editReply({ content: `❌ Error: ${err.message}` });
  }
}

async function showAutoPostMenu(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  const stats = getAutoPostStats();
  const embed = new EmbedBuilder().setTitle('🤖 Auto Poster').setDescription(`**Enabled:** ${config.auto_post_enabled ? '🟢 Yes' : '🔴 No'}\n**Channels:** ${config.auto_post_channels?.length ? config.auto_post_channels.map(id => `<#${id}>`).join(', ') : 'None'}\n**Interval:** Every ${config.auto_post_interval_hours || 2}h\n\n**Total Posts:** ${stats?.totalPosts || 0}\n**Success Rate:** ${stats?.successRate || 'N/A'}`).setColor('#9B59B6');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_autopost_toggle').setLabel(config.auto_post_enabled ? '🔴 Disable' : '🟢 Enable').setStyle(config.auto_post_enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('admin_test_autopost').setLabel('🧪 Test').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_refresh').setLabel('↩️ Back').setStyle(ButtonStyle.Secondary)
  );
  if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [embed], components: [row] });
  else await interaction.reply({ embeds: [embed], components: [row], ...EPHEMERAL });
}

async function toggleAutoPost(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  config.auto_post_enabled = !config.auto_post_enabled;
  await setGuildConfig(interaction.guildId, config);
  await interaction.reply({ content: `✅ Auto poster ${config.auto_post_enabled ? 'enabled' : 'disabled'}.`, ...EPHEMERAL });
  setTimeout(() => showAutoPostMenu(interaction), 500);
}

async function showVerifyMenu(interaction) {
  const embed = new EmbedBuilder().setTitle('✅ Verification').setDescription('Configure verification system.').setColor('#2ECC71');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_set_verify_role').setLabel('📌 Set Role').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_toggle_verify').setLabel('⏻ Toggle').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_post_verify_panel').setLabel('📢 Post Panel').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('admin_refresh').setLabel('◀ Back').setStyle(ButtonStyle.Secondary)
  );
  if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [embed], components: [row] });
  else await interaction.reply({ embeds: [embed], components: [row], ...EPHEMERAL });
}

async function showTicketMenu(interaction) {
  const embed = new EmbedBuilder().setTitle('🎫 Ticket System').setDescription('Configure support tickets.').setColor('#3498DB');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_set_ticket_category').setLabel('📂 Category').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_set_ticket_staff').setLabel('👥 Staff Role').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_set_ticket_logs').setLabel('📝 Logs').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_post_ticket_panel').setLabel('📢 Post Panel').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('admin_refresh').setLabel('◀ Back').setStyle(ButtonStyle.Secondary)
  );
  if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [embed], components: [row] });
  else await interaction.reply({ embeds: [embed], components: [row], ...EPHEMERAL });
}

async function showLobbyMenu(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  const embed = new EmbedBuilder().setTitle('💬 Lobby Chatter').setDescription(`**Status:** ${config.lobby_chatter_enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Webhook:** ${config.lobby_webhook_url ? '✅ Set' : '❌ Not set'}\n**Personas:** ${config.lobby_chatter_personas?.length || 9} active`).setColor('#9B59B6');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_lobby_toggle').setLabel('⏻ Toggle').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_lobby_set_webhook').setLabel('🔗 Webhook').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_lobby_set_personas').setLabel('👥 Personas').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_refresh').setLabel('◀ Back').setStyle(ButtonStyle.Secondary)
  );
  if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [embed], components: [row] });
  else await interaction.reply({ embeds: [embed], components: [row], ...EPHEMERAL });
}

async function showGiveawayMenu(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  const embed = new EmbedBuilder()
    .setTitle('🎁 Giveaway Settings')
    .setDescription(
      `**Ping Role:** ${config.giveaway_ping_role_id ? `<@&${config.giveaway_ping_role_id}>` : '❌ Not set'}\n\n` +
      `**Commands:**\n` +
      `• \`/cargiveaway start\` \`/cargiveaway select\` \`/cargiveaway paid\`\n` +
      `• \`/cargiveaway end\` \`/cargiveaway list\` \`/cargiveaway leads\`\n\n` +
      `**Quick Actions:**`
    )
    .setColor('#FFD700');
  
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_giveaway_set_pingrole').setLabel('📌 Ping Role').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_pull_all_leads').setLabel('📋 All Leads').setStyle(ButtonStyle.Success)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_pull_active_leads').setLabel('📋 Active Giveaway Leads').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('admin_refresh').setLabel('◀ Back').setStyle(ButtonStyle.Secondary)
  );
  
  if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [embed], components: [row1, row2] });
  else await interaction.reply({ embeds: [embed], components: [row1, row2], ...EPHEMERAL });
}

module.exports.handleLeadSelect = handleLeadSelect;