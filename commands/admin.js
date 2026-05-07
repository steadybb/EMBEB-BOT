// commands/admin.js
const { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  MessageFlags, 
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { getGuildConfig, setGuildConfig, pool } = require('../utils/database');
const { isAdmin } = require('../utils/permissions');
const { getAutoPostStats, postAutoContent } = require('../schedulers/autoPost');
const { getApiStats } = require('../utils/openai');
const logger = require('../utils/logger');

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

// ============================================
// SAFE INTERACTION HELPERS
// ============================================
function isAlive(interaction) {
  try { return !interaction.replied && !interaction.deferred; } catch { return false; }
}

async function safeReply(interaction, options) {
  try {
    if (interaction.replied) return await interaction.followUp({ ...options, flags: MessageFlags.Ephemeral });
    if (interaction.deferred) return await interaction.editReply(options);
    return await interaction.reply({ ...options, flags: MessageFlags.Ephemeral });
  } catch (err) {
    if (err.code === 40060) {
      try { return await interaction.followUp({ ...options, flags: MessageFlags.Ephemeral }); }
      catch (e) { logger.warn('Follow-up failed:', e.message); return null; }
    }
    if (err.code === 10062) { logger.warn('Interaction expired'); return null; }
    throw err;
  }
}

async function safeDefer(interaction, ephemeral = true) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      return await interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined });
    }
    return true;
  } catch (err) {
    if (err.code === 10062) { logger.warn('Interaction expired, cannot defer'); return false; }
    throw err;
  }
}

// ============================================
// EMBED BUILDERS
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
    .setFooter({ text: '⚡ Blade Battery Technology • Trusted by 15,000+ drivers', iconURL: 'https://cdn.byd.com/bot/byd-logo.png' })
    .setTimestamp();
}

function createTicketPanelEmbed() {
  return new EmbedBuilder()
    .setTitle('🎫 BYD Concierge – Priority Support')
    .setDescription(
      `Need help with your BYD? Whether it's a test drive, paperwork, or technical question, our team is here for you.\n\n` +
      `**Available Support Categories:**\nℹ️ General Support\n🚗 Test Drive Booking\n💰 Sales Inquiry\n🔧 Technical Support\n📄 Paperwork / Documentation\n⚠️ Complaint / Issue\n\n` +
      `**How it works:**\n1️⃣ Click below\n2️⃣ Pick your category\n3️⃣ Set priority\n4️⃣ Describe your issue\n5️⃣ Staff helps you shortly\n\n` +
      `⏰ **Response:** Within 1 hour (business days)\n🔒 Private – only you and staff see it.`
    )
    .setColor('#00BFFF')
    .setThumbnail('https://cdn.byd.com/bot/byd-logo.png')
    .setFooter({ text: '⚡ BYD Blade Battery | Trusted by 15,000+ EV drivers', iconURL: 'https://cdn.byd.com/bot/byd-logo.png' })
    .setTimestamp();
}

// ============================================
// COMMAND & HANDLERS
// ============================================
module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('🎛️ BYD Bot Admin Dashboard'),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: '❌ Only admins can use this dashboard.', ...EPHEMERAL });
    }

    // Defer immediately to prevent 3‑second timeout
    const deferred = await safeDefer(interaction);
    if (!deferred) return;

    const guildId = interaction.guildId;
    const config = await getGuildConfig(guildId);

    let autoPostStats = null, apiStats = null, activeGiveaways = 0;
    try {
      autoPostStats = getAutoPostStats();
      apiStats = getApiStats();
      const gwRes = await pool.query('SELECT COUNT(*) as count FROM car_giveaways WHERE guild_id = $1 AND ended = false', [guildId]);
      activeGiveaways = parseInt(gwRes.rows[0]?.count || 0);
    } catch (err) { logger.debug('Stats unavailable:', err.message); }

    const verifyRole = config.verify_role_id ? `<@&${config.verify_role_id}>` : '❌ Not set';
    const ticketCategory = config.ticket_category_id ? `<#${config.ticket_category_id}>` : '❌ Not set';
    const staffRole = config.staff_role_id ? `<@&${config.staff_role_id}>` : '❌ Not set';
    const logsChannel = config.ticket_logs_channel_id ? `<#${config.ticket_logs_channel_id}>` : '❌ Not set';
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
        { name: '🎫 Ticket System', value: `**Category:** ${ticketCategory}\n**Staff Role:** ${staffRole}\n**Logs:** ${logsChannel}`, inline: true },
        { name: '🤖 Auto Poster', value: getAutoPostFieldValue(config, autoPostChannels, autoPostStats), inline: true },
        { name: '💬 Lobby Chatter', value: `**Status:** ${lobbyStatus}\n**Webhook:** ${lobbyWebhook}`, inline: true },
        { name: '🎁 Giveaways', value: `**Ping Role:** ${giveawayPingRole}\n**Active:** ${activeGiveaways}`, inline: true }
      )
      .setFooter({ text: 'Use the buttons below to configure each system.' })
      .setTimestamp();

    if (autoPostStats?.totalPosts > 0) embed.addFields({ name: '📊 Auto Poster Stats', value: getStatsFieldValue(autoPostStats, apiStats), inline: false });
    if (apiStats) embed.addFields({ name: '🏥 System Health', value: getHealthStatus(apiStats), inline: false });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_verify_menu').setLabel('✅ Verification').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_ticket_menu').setLabel('🎫 Ticket System').setStyle(ButtonStyle.Primary)
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_autopost_menu').setLabel('🤖 Auto Poster').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_lobby_menu').setLabel('💬 Lobby Chatter').setStyle(ButtonStyle.Primary)
    );
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_giveaway_menu').setLabel('🎁 Giveaways').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary)
    );
    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_stats_detail').setLabel('📊 Detailed Stats').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_test_autopost').setLabel('🧪 Test Auto Post').setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({ embeds: [embed], components: [row1, row2, row3, row4] });
  },

  // ============================================
  // BUTTON HANDLER
  // ============================================
  async handleButton(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith('admin_')) return false;

    if (!isAdmin(interaction.member)) {
      if (isAlive(interaction)) await interaction.reply({ content: '❌ Only admins can use these controls.', ...EPHEMERAL });
      return true;
    }

    try {
      switch (interaction.customId) {
        case 'admin_refresh':
          if (isAlive(interaction)) await interaction.deferUpdate();
          await this.execute(interaction); break;
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
        case 'admin_toggle_verify': await toggleVerify(interaction); break;
        case 'admin_set_verify_role': await setVerifyRole(interaction); break;
        case 'admin_post_verify_panel': await postVerifyPanel(interaction); break;
        case 'admin_set_ticket_category': await setTicketCategory(interaction); break;
        case 'admin_set_ticket_staff': await setTicketStaffRole(interaction); break;
        case 'admin_set_ticket_logs': await setTicketLogsChannel(interaction); break;
        case 'admin_post_ticket_panel': await postTicketPanel(interaction); break;
        case 'admin_lobby_toggle': await toggleLobby(interaction); break;
        case 'admin_lobby_set_webhook': await setLobbyWebhook(interaction); break;
        case 'admin_giveaway_set_pingrole': await setGiveawayPingRole(interaction); break;
        default: return false;
      }
    } catch (error) {
      logger.error(`Button handler error for ${interaction.customId}:`, error.message);
      if (isAlive(interaction)) await interaction.reply({ content: '❌ An error occurred.', ...EPHEMERAL });
    }
    return true;
  },

  // ============================================
  // SELECT MENU HANDLER
  // ============================================
  async handleSelect(interaction) {
    if (interaction.customId === 'admin_select_giveaway_leads') { await handleLeadSelect(interaction); return true; }
    return false;
  },

  // ============================================
  // MODAL HANDLER
  // ============================================
  async handleModal(interaction) {
    try {
      const gid = interaction.guildId;
      let cfg;
      switch (interaction.customId) {
        case 'admin_set_verify_role_modal': {
          const rid = interaction.fields.getTextInputValue('role_id');
          const role = interaction.guild.roles.cache.get(rid);
          if (!role) return safeReply(interaction, { content: '❌ Invalid role ID.' });
          cfg = await getGuildConfig(gid); cfg.verify_role_id = role.id; await setGuildConfig(gid, cfg);
          return safeReply(interaction, { content: `✅ Verification role → ${role.name}` });
        }
        case 'admin_set_ticket_category_modal': {
          const cid = interaction.fields.getTextInputValue('category_id');
          const cat = interaction.guild.channels.cache.get(cid);
          if (!cat || cat.type !== 4) return safeReply(interaction, { content: '❌ Invalid category ID.' });
          cfg = await getGuildConfig(gid); cfg.ticket_category_id = cat.id; await setGuildConfig(gid, cfg);
          return safeReply(interaction, { content: `✅ Ticket category → ${cat.name}` });
        }
        case 'admin_set_ticket_staff_modal': {
          const rid = interaction.fields.getTextInputValue('role_id');
          const role = interaction.guild.roles.cache.get(rid);
          if (!role) return safeReply(interaction, { content: '❌ Invalid role ID.' });
          cfg = await getGuildConfig(gid); cfg.staff_role_id = role.id; await setGuildConfig(gid, cfg);
          return safeReply(interaction, { content: `✅ Staff role → ${role.name}` });
        }
        case 'admin_set_ticket_logs_modal': {
          const cid = interaction.fields.getTextInputValue('channel_id');
          const ch = interaction.guild.channels.cache.get(cid);
          if (!ch || ch.type !== 0) return safeReply(interaction, { content: '❌ Invalid text channel ID.' });
          cfg = await getGuildConfig(gid); cfg.ticket_logs_channel_id = ch.id; await setGuildConfig(gid, cfg);
          return safeReply(interaction, { content: `✅ Logs channel → ${ch.name}` });
        }
        case 'admin_lobby_set_webhook_modal': {
          const url = interaction.fields.getTextInputValue('webhook_url');
          if (!url.startsWith('https://discord.com/api/webhooks/')) return safeReply(interaction, { content: '❌ Invalid webhook URL.' });
          cfg = await getGuildConfig(gid); cfg.lobby_webhook_url = url; await setGuildConfig(gid, cfg);
          return safeReply(interaction, { content: '✅ Lobby webhook URL set.' });
        }
        case 'admin_giveaway_set_pingrole_modal': {
          const rid = interaction.fields.getTextInputValue('role_id');
          const role = interaction.guild.roles.cache.get(rid);
          if (!role) return safeReply(interaction, { content: '❌ Invalid role ID.' });
          cfg = await getGuildConfig(gid); cfg.giveaway_ping_role_id = role.id; await setGuildConfig(gid, cfg);
          return safeReply(interaction, { content: `✅ Giveaway ping role → ${role.name}` });
        }
      }
    } catch (error) {
      logger.error(`Modal handler error for ${interaction.customId}:`, error.message);
      if (isAlive(interaction)) await interaction.reply({ content: '❌ An error occurred.', ...EPHEMERAL });
    }
    return false;
  }
};

// ============================================
// LEAD FUNCTIONS
// ============================================
async function pullAllLeads(interaction) {
  if (!await safeDefer(interaction)) return;
  const res = await pool.query(
    `SELECT cge.*, cg.car_model, cg.car_year, cg.msrp, cg.message_id, cg.ended
     FROM car_giveaway_entries cge JOIN car_giveaways cg ON cge.giveaway_id = cg.id
     WHERE cg.guild_id = $1 ORDER BY cge.entered_at DESC LIMIT 100`, [interaction.guildId]);
  const entries = res.rows;
  if (entries.length === 0) return interaction.editReply({ content: '📭 No giveaway leads found.' });

  const embed = new EmbedBuilder().setTitle('📋 All Giveaway Leads').setDescription(`Total: **${entries.length}**`).setColor('#FFD700').setTimestamp();
  const grp = {};
  for (const e of entries) { const k = `${e.car_year} BYD ${e.car_model}`; if (!grp[k]) grp[k] = []; grp[k].push(e); }
  for (const [name, leads] of Object.entries(grp)) {
    embed.addFields({ name: `${name} (${leads.length})`, value: leads.slice(0, 10).map((l, i) => `**${i+1}.** <@${l.user_id}> | 📧 ${l.user_email || 'N/A'} | 📱 ${l.user_phone || 'N/A'}`).join('\n') + (leads.length > 10 ? `\n*...${leads.length-10} more*` : ''), inline: false });
  }
  let csv = 'Giveaway,User ID,Email,Phone,Entered At\n';
  for (const e of entries) csv += `"${e.car_year} BYD ${e.car_model}",${e.user_id},${e.user_email || ''},${e.user_phone || ''},${e.entered_at}\n`;
  await interaction.editReply({ embeds: [embed] });
  await interaction.followUp({ content: '📎 CSV:', files: [{ name: `all-leads-${Date.now()}.csv`, attachment: Buffer.from(csv) }], ...EPHEMERAL });
}

async function pullActiveGiveawayLeads(interaction) {
  if (!await safeDefer(interaction)) return;
  const gwRes = await pool.query('SELECT * FROM car_giveaways WHERE guild_id = $1 AND ended = false ORDER BY end_time ASC', [interaction.guildId]);
  const giveaways = gwRes.rows;
  if (giveaways.length === 0) return interaction.editReply({ content: '📭 No active giveaways.' });
  const sel = new StringSelectMenuBuilder().setCustomId('admin_select_giveaway_leads').setPlaceholder('Select a giveaway').addOptions(giveaways.slice(0, 25).map(g => ({ label: `${g.car_year} BYD ${g.car_model}`, description: `Ends: ${new Date(g.end_time).toLocaleDateString()}`, value: g.id.toString() })));
  await interaction.editReply({ content: '📋 Select a giveaway:', components: [new ActionRowBuilder().addComponents(sel)] });
}

async function handleLeadSelect(interaction) {
  const gid = parseInt(interaction.values[0]);
  const [er, gr] = await Promise.all([
    pool.query('SELECT * FROM car_giveaway_entries WHERE giveaway_id = $1 ORDER BY entered_at ASC', [gid]),
    pool.query('SELECT * FROM car_giveaways WHERE id = $1', [gid])
  ]);
  const gw = gr.rows[0], entries = er.rows;
  if (!gw || entries.length === 0) return interaction.update({ content: '❌ No leads.', components: [] });
  const embed = new EmbedBuilder().setTitle(`📋 Leads: ${gw.car_year} BYD ${gw.car_model}`).setDescription(`Total: **${entries.length}**\n\n${entries.slice(0, 20).map((e, i) => `**${i+1}.** <@${e.user_id}>\n📧 ${e.user_email || 'N/A'}\n📱 ${e.user_phone || 'N/A'}\n🕐 <t:${Math.floor(new Date(e.entered_at).getTime()/1000)}:R>`).join('\n\n')}${entries.length>20?`\n\n...${entries.length-20} more`:''}`).setColor('#FFD700').setTimestamp();
  let csv = 'User ID,Email,Phone,Entered At\n';
  for (const e of entries) csv += `${e.user_id},${e.user_email || ''},${e.user_phone || ''},${e.entered_at}\n`;
  await interaction.update({ embeds: [embed], components: [] });
  await interaction.followUp({ content: '📎 CSV:', files: [{ name: `leads-${gw.car_model}-${Date.now()}.csv`, attachment: Buffer.from(csv) }], ...EPHEMERAL });
}

// ============================================
// HELPER VALUES
// ============================================
function getAutoPostFieldValue(config, channels, stats) {
  let v = `**Status:** ${config.auto_post_enabled ? '🟢 Enabled' : '🔴 Disabled'}\n`;
  v += `**Channels:** ${channels}\n**Interval:** Every ${config.auto_post_interval_hours || 2}h\n`;
  v += `**Mode:** ${process.env.AUTO_POST_ALL_CHANNELS === 'true' ? 'All channels' : 'Round-robin'}\n`;
  if (stats?.totalPosts > 0) v += `**Total Posts:** ${stats.totalPosts}\n**Success Rate:** ${stats.successRate}\n**API/Fallback:** ${stats.apiPosts || 0}/${stats.fallbackPosts || 0}`;
  return v;
}
function getStatsFieldValue(aStats, apiStats) {
  let v = '';
  if (aStats) { v += `**Uptime:** ${aStats.uptime}\n**Total Posts:** ${aStats.totalPosts}\n**Successful:** ${aStats.successfulPosts} | **Failed:** ${aStats.failedPosts}\n**Success Rate:** ${aStats.successRate}\n`; if (aStats.lastPostTime) v += `**Last Post:** <t:${Math.floor(new Date(aStats.lastPostTime).getTime()/1000)}:R>\n`; }
  if (apiStats) v += `\n**API Calls:** ${apiStats.totalRequests}\n**API Success:** ${apiStats.successfulRequests} | **Failed:** ${apiStats.failedRequests}\n**Fallback Used:** ${apiStats.fallbackUsed || 0} times\n**Fallback Available:** ${apiStats.fallbackPostsAvailable || 0}`;
  return v || 'No stats yet';
}
function getHealthStatus(apiStats) {
  let s = '';
  if (!process.env.OPENROUTER_API_KEY) s += '⚠️ **API Key:** Not set\n';
  else { const sr = apiStats.totalRequests > 0 ? (apiStats.successfulRequests/apiStats.totalRequests)*100 : 100; s += apiStats.totalRequests === 0 ? '⚪ **API:** No requests yet\n' : sr >= 90 ? '🟢 **API:** Healthy\n' : sr >= 50 ? '🟡 **API:** Degraded\n' : '🔴 **API:** Failing\n'; }
  s += apiStats.fallbackPostsAvailable > 0 ? `🟢 **Fallback:** ${apiStats.fallbackPostsAvailable} posts ready` : '🔴 **Fallback:** No posts';
  return s;
}

// ============================================
// MENU & ACTION FUNCTIONS
// ============================================
async function showDetailedStats(interaction) {
  if (isAlive(interaction)) await interaction.deferReply(EPHEMERAL);
  const a = getAutoPostStats(), p = getApiStats();
  const emb = new EmbedBuilder().setTitle('📊 Detailed Stats').setColor('#00BFFF').setTimestamp();
  if (a) emb.addFields({ name: '🤖 Auto Poster', value: `\`\`\`yaml\nUptime: ${a.uptime}\nTotal: ${a.totalPosts}\nSuccess: ${a.successfulPosts}\nFailed: ${a.failedPosts}\nRate: ${a.successRate}\n\`\`\``, inline: false });
  if (p) emb.addFields({ name: '🔌 API', value: `\`\`\`yaml\nRequests: ${p.totalRequests}\nSuccess: ${p.successfulRequests}\nFailed: ${p.failedRequests}\nRate: ${p.successRate}\nFallback Used: ${p.fallbackUsed || 0}\n\`\`\``, inline: false });
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('admin_stats_detail').setLabel('🔄 Refresh').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('admin_refresh').setLabel('↩️ Back').setStyle(ButtonStyle.Secondary));
  await interaction.editReply({ embeds: [emb], components: [row], ...EPHEMERAL });
}
async function testAutoPost(interaction) {
  if (isAlive(interaction)) await interaction.deferReply(EPHEMERAL);
  try { const ok = await postAutoContent(interaction.client); await interaction.editReply({ content: ok ? '✅ Test post sent!' : '❌ Failed.' }); }
  catch (err) { await interaction.editReply({ content: `❌ Error: ${err.message}` }); }
}
async function showAutoPostMenu(interaction) {
  if (isAlive(interaction)) await interaction.deferReply(EPHEMERAL);
  const c = await getGuildConfig(interaction.guildId), s = getAutoPostStats();
  const emb = new EmbedBuilder().setTitle('🤖 Auto Poster').setDescription(`**Enabled:** ${c.auto_post_enabled ? '🟢 Yes' : '🔴 No'}\n**Channels:** ${c.auto_post_channels?.length ? c.auto_post_channels.map(id => `<#${id}>`).join(', ') : 'None'}\n**Interval:** Every ${c.auto_post_interval_hours || 2}h\n\n**Posts:** ${s?.totalPosts || 0}\n**Rate:** ${s?.successRate || 'N/A'}`).setColor('#9B59B6');
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('admin_autopost_toggle').setLabel(c.auto_post_enabled ? '🔴 Disable' : '🟢 Enable').setStyle(c.auto_post_enabled ? ButtonStyle.Danger : ButtonStyle.Success), new ButtonBuilder().setCustomId('admin_test_autopost').setLabel('🧪 Test').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('admin_refresh').setLabel('↩️ Back').setStyle(ButtonStyle.Secondary));
  await interaction.editReply({ embeds: [emb], components: [row], ...EPHEMERAL });
}
async function toggleAutoPost(interaction) {
  const c = await getGuildConfig(interaction.guildId); c.auto_post_enabled = !c.auto_post_enabled; await setGuildConfig(interaction.guildId, c);
  await safeReply(interaction, { content: `✅ Auto poster ${c.auto_post_enabled ? 'enabled' : 'disabled'}.` });
  setTimeout(() => showAutoPostMenu(interaction), 500);
}
async function showVerifyMenu(interaction) {
  if (isAlive(interaction)) await interaction.deferReply(EPHEMERAL);
  const c = await getGuildConfig(interaction.guildId);
  const emb = new EmbedBuilder().setTitle('✅ Verification').setDescription(`**Status:** ${c.verify_enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Role:** ${c.verify_role_id ? `<@&${c.verify_role_id}>` : '❌'}`).setColor('#2ECC71');
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('admin_toggle_verify').setLabel(c.verify_enabled ? '🔴 Disable' : '🟢 Enable').setStyle(c.verify_enabled ? ButtonStyle.Danger : ButtonStyle.Success), new ButtonBuilder().setCustomId('admin_set_verify_role').setLabel('📌 Set Role').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('admin_post_verify_panel').setLabel('📢 Post Panel').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('admin_refresh').setLabel('◀ Back').setStyle(ButtonStyle.Secondary));
  await interaction.editReply({ embeds: [emb], components: [row], ...EPHEMERAL });
}
async function toggleVerify(interaction) {
  const c = await getGuildConfig(interaction.guildId); c.verify_enabled = !c.verify_enabled; await setGuildConfig(interaction.guildId, c);
  await safeReply(interaction, { content: `✅ Verification ${c.verify_enabled ? 'enabled' : 'disabled'}.` });
  setTimeout(() => showVerifyMenu(interaction), 500);
}
async function setVerifyRole(interaction) { if (!isAlive(interaction)) return; const m = new ModalBuilder().setCustomId('admin_set_verify_role_modal').setTitle('Set Verification Role'); m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_id').setLabel('Role ID').setPlaceholder('Enter the role ID').setStyle(TextInputStyle.Short).setRequired(true))); await interaction.showModal(m); }
async function postVerifyPanel(interaction) { const emb = getVerificationEmbed(); const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verify_button').setLabel('✅ Verify Me – It\'s Free').setStyle(ButtonStyle.Success).setEmoji('🔑')); await interaction.channel.send({ embeds: [emb], components: [row] }); await safeReply(interaction, { content: '✅ Verification panel posted.' }); }
async function showTicketMenu(interaction) {
  if (isAlive(interaction)) await interaction.deferReply(EPHEMERAL);
  const c = await getGuildConfig(interaction.guildId);
  const emb = new EmbedBuilder().setTitle('🎫 Ticket System').setDescription(`**Category:** ${c.ticket_category_id ? `<#${c.ticket_category_id}>` : '❌'}\n**Staff:** ${c.staff_role_id ? `<@&${c.staff_role_id}>` : '❌'}\n**Logs:** ${c.ticket_logs_channel_id ? `<#${c.ticket_logs_channel_id}>` : '❌'}`).setColor('#3498DB');
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('admin_set_ticket_category').setLabel('📂 Category').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('admin_set_ticket_staff').setLabel('👥 Staff').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('admin_set_ticket_logs').setLabel('📝 Logs').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('admin_post_ticket_panel').setLabel('📢 Post').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('admin_refresh').setLabel('◀ Back').setStyle(ButtonStyle.Secondary));
  await interaction.editReply({ embeds: [emb], components: [row], ...EPHEMERAL });
}
async function setTicketCategory(interaction) { if (!isAlive(interaction)) return; const m = new ModalBuilder().setCustomId('admin_set_ticket_category_modal').setTitle('Set Ticket Category'); m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('category_id').setLabel('Category ID').setPlaceholder('Enter the category ID').setStyle(TextInputStyle.Short).setRequired(true))); await interaction.showModal(m); }
async function setTicketStaffRole(interaction) { if (!isAlive(interaction)) return; const m = new ModalBuilder().setCustomId('admin_set_ticket_staff_modal').setTitle('Set Staff Role'); m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_id').setLabel('Role ID').setPlaceholder('Enter the role ID').setStyle(TextInputStyle.Short).setRequired(true))); await interaction.showModal(m); }
async function setTicketLogsChannel(interaction) { if (!isAlive(interaction)) return; const m = new ModalBuilder().setCustomId('admin_set_ticket_logs_modal').setTitle('Set Logs Channel'); m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channel_id').setLabel('Channel ID').setPlaceholder('Enter the channel ID').setStyle(TextInputStyle.Short).setRequired(true))); await interaction.showModal(m); }
async function postTicketPanel(interaction) { const emb = createTicketPanelEmbed(); const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('create_ticket').setLabel('📩 Create Support Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫')); await interaction.channel.send({ embeds: [emb], components: [row] }); await safeReply(interaction, { content: '✅ Ticket panel posted.' }); }
async function showLobbyMenu(interaction) {
  if (isAlive(interaction)) await interaction.deferReply(EPHEMERAL);
  const c = await getGuildConfig(interaction.guildId);
  const emb = new EmbedBuilder().setTitle('💬 Lobby Chatter').setDescription(`**Status:** ${c.lobby_chatter_enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Webhook:** ${c.lobby_webhook_url ? '✅ Set' : '❌ Not set'}`).setColor('#9B59B6');
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('admin_lobby_toggle').setLabel('⏻ Toggle').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('admin_lobby_set_webhook').setLabel('🔗 Webhook').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('admin_refresh').setLabel('◀ Back').setStyle(ButtonStyle.Secondary));
  await interaction.editReply({ embeds: [emb], components: [row], ...EPHEMERAL });
}
async function toggleLobby(interaction) {
  const c = await getGuildConfig(interaction.guildId); c.lobby_chatter_enabled = !c.lobby_chatter_enabled; await setGuildConfig(interaction.guildId, c);
  await safeReply(interaction, { content: `✅ Lobby chatter ${c.lobby_chatter_enabled ? 'enabled' : 'disabled'}.` });
  setTimeout(() => showLobbyMenu(interaction), 500);
}
async function setLobbyWebhook(interaction) { if (!isAlive(interaction)) return; const m = new ModalBuilder().setCustomId('admin_lobby_set_webhook_modal').setTitle('Set Lobby Webhook'); m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('webhook_url').setLabel('Discord Webhook URL').setPlaceholder('https://discord.com/api/webhooks/...').setStyle(TextInputStyle.Short).setRequired(true))); await interaction.showModal(m); }
async function showGiveawayMenu(interaction) {
  if (isAlive(interaction)) await interaction.deferReply(EPHEMERAL);
  const c = await getGuildConfig(interaction.guildId);
  const emb = new EmbedBuilder().setTitle('🎁 Giveaway Settings').setDescription(`**Ping Role:** ${c.giveaway_ping_role_id ? `<@&${c.giveaway_ping_role_id}>` : '❌'}\n\n**Commands:** \`/cargiveaway\``).setColor('#FFD700');
  const r1 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('admin_giveaway_set_pingrole').setLabel('📌 Ping Role').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('admin_pull_all_leads').setLabel('📋 All Leads').setStyle(ButtonStyle.Success));
  const r2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('admin_pull_active_leads').setLabel('📋 Active Leads').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('admin_refresh').setLabel('◀ Back').setStyle(ButtonStyle.Secondary));
  await interaction.editReply({ embeds: [emb], components: [r1, r2], ...EPHEMERAL });
}
async function setGiveawayPingRole(interaction) { if (!isAlive(interaction)) return; const m = new ModalBuilder().setCustomId('admin_giveaway_set_pingrole_modal').setTitle('Set Giveaway Ping Role'); m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_id').setLabel('Role ID').setPlaceholder('Enter the role ID').setStyle(TextInputStyle.Short).setRequired(true))); await interaction.showModal(m); }