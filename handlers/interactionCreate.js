// handlers/interactionCreate.js
const {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const { isAdmin } = require('../utils/permissions');
const logger = require('../utils/logger');
const bydEmbeds = require('../modules/bydEmbeds');
const { getUserState, updateUserState } = require('../utils/stateManager');
const { generateQuote, models, regionIncentives } = require('../utils/bydData');
const { getCalendarPicker, getTimePicker } = require('../utils/calendar');
const { getAutoPostStats } = require('../schedulers/autoPost');
const { handleCarGiveawayButton, handleCarGiveawayModal } = require('../commands/cargiveaway');
const { getApiStats } = require('../utils/openai');
const {
  saveTestDriveBooking,
  upsertLead,
  getGuildConfig,
  setGuildConfig,
  saveTicket,
  closeTicket,
  getUserOpenTickets,
  setGiveawayPingRole,
  getGiveawayPingRole,
} = require('../utils/database');

// ========== SOCIAL PROOF & URGENCY LIBRARY ==========
const testimonials = [
  "“Saved $7,500 with federal credits – the Seal is a steal!” – Marina, CA",
  "“ATTO 3's Blade Battery gave my family real peace of mind.” – Carlos, TX",
  "“Free home charger? BYD really cares.” – Luisa, NY",
  "“0‑60 in 3.8s – the Han Performance is pure adrenaline.” – Felipe, FL",
  "“Best EV decision I ever made. And I saved thousands.” – Ahmed, CO"
];

const urgencyPhrases = [
  "⚡ Only 5 test drive slots left this week!",
  "🔥 Launch edition models – limited inventory!",
  "⏳ EV tax credits may phase out – lock yours now.",
  "🎁 Free charger installation ends June 30.",
  "📉 0.99% financing – last 10 cars at this rate."
];

const advisorNames = ["Carlos", "Marina", "Rafael", "Luciana", "Ahmed"];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getPersonalAdvisor() {
  return getRandomItem(advisorNames);
}

// ========== BOT INIT ==========
module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    // Slash Commands
    if (interaction.isCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
        logger.cmd(`/${interaction.commandName} executed by ${interaction.user.tag}`);
      } catch (error) {
        logger.error(`Command ${interaction.commandName} failed:`, error);
        const reply = { content: '❌ There was an error executing this command.', ephemeral: true };
        if (interaction.deferred || interaction.replied) await interaction.editReply(reply);
        else await interaction.reply(reply);
      }
      return;
    }

    // Buttons
    if (interaction.isButton()) {
      if (interaction.customId === 'cargiveaway_enter') {
        return handleCarGiveawayButton(interaction);
      }
      await handleButton(interaction, client);
      return;
    }

    // Select Menus
    if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction, client);
      return;
    }

    // Modals (Trade‑in + Admin + Car Giveaway)
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'cargiveaway_entry_modal') {
        return handleCarGiveawayModal(interaction);
      }
      await handleModal(interaction);
      return;
    }
  });
};

// ------------------------- BUTTON HANDLERS -------------------------
async function handleButton(interaction, client) {
  const { customId, user } = interaction;
  const userId = user.id;
  let state = await getUserState(userId, user.username);

  logger.debug(`Button pressed: ${customId} by ${user.tag}`);

  // BYD Lead Capture buttons
  if (customId === 'welcome_model_dolphin') return selectModel(interaction, 'Dolphin');
  if (customId === 'welcome_model_seal') return selectModel(interaction, 'Seal');
  if (customId === 'welcome_model_atto3') return selectModel(interaction, 'ATTO 3');
  if (customId === 'welcome_model_han') return selectModel(interaction, 'Han');
  if (customId === 'welcome_model_commercial') return selectModel(interaction, 'Commercial');
  if (customId === 'welcome_model_notsure') return handleNotSure(interaction);

  if (customId === 'action_brochure') return sendBrochure(interaction, state.selectedModel);
  if (customId === 'action_quote') return startQuoteFlow(interaction, state.selectedModel);
  if (customId === 'action_testdrive') return startTestDriveFlow(interaction, state.selectedModel);
  if (customId === 'action_tradein') return startTradeInFlow(interaction, state.selectedModel);

  if (customId === 'quote_book_testdrive') return startTestDriveFlow(interaction, state.selectedModel);
  if (customId === 'quote_chat_advisors') return transferToAdvisor(interaction);

  if (customId === 'td_showroom') return askForDateTime(interaction, 'showroom');
  if (customId === 'td_home') return askForDateTime(interaction, 'home');

  if (customId === 'tradein_condition_excellent') return setTradeCondition(interaction, 'Excellent');
  if (customId === 'tradein_condition_good') return setTradeCondition(interaction, 'Good');
  if (customId === 'tradein_condition_fair') return setTradeCondition(interaction, 'Fair');
  if (customId === 'tradein_condition_needs_repair') return setTradeCondition(interaction, 'Needs Repair');

  if (customId === 'followup_brochure') return sendBrochure(interaction, state.selectedModel);
  if (customId === 'followup_quote') return startQuoteFlow(interaction, state.selectedModel);
  if (customId === 'followup_testdrive') return startTestDriveFlow(interaction, state.selectedModel);

  if (customId === 'need_affordability') return recommendAffordability(interaction);
  if (customId === 'need_range') return recommendRange(interaction);
  if (customId === 'need_family') return recommendFamily(interaction);
  if (customId === 'need_city') return recommendCity(interaction);
  if (customId === 'need_fleet') return handleFleet(interaction);

  // Verification & Ticket System
  if (customId === 'verify_button') return handleVerify(interaction);
  if (customId === 'create_ticket') return createTicket(interaction, client);
  if (customId === 'close_ticket') return closeTicketHandler(interaction, client);

  // ============================================
  // ADMIN DASHBOARD BUTTONS (FULL INTEGRATION)
  // ============================================
  if (customId === 'admin_verify_menu') return adminVerifyMenu(interaction);
  if (customId === 'admin_ticket_menu') return adminTicketMenu(interaction);
  if (customId === 'admin_autopost_menu') return adminAutopostMenu(interaction);
  if (customId === 'admin_lobby_menu') return adminLobbyMenu(interaction);
  if (customId === 'admin_giveaway_menu') return adminGiveawayMenu(interaction);
  if (customId === 'admin_refresh') return adminRefresh(interaction);
  if (customId === 'admin_set_verify_role') return adminSetVerifyRole(interaction);
  if (customId === 'admin_toggle_verify') return adminToggleVerify(interaction);
  if (customId === 'admin_post_verify_panel') return adminPostVerifyPanel(interaction);
  if (customId === 'admin_set_ticket_category') return adminSetTicketCategory(interaction);
  if (customId === 'admin_set_ticket_staff') return adminSetTicketStaff(interaction);
  if (customId === 'admin_set_ticket_logs') return adminSetTicketLogs(interaction);
  if (customId === 'admin_post_ticket_panel') return adminPostTicketPanel(interaction);
  if (customId === 'admin_autopost_toggle') return adminAutopostToggle(interaction);
  if (customId === 'admin_autopost_set_channels') return adminAutopostSetChannels(interaction);
  if (customId === 'admin_autopost_set_interval') return adminAutopostSetInterval(interaction);
  if (customId === 'admin_lobby_toggle') return adminLobbyToggle(interaction);
  if (customId === 'admin_lobby_set_webhook') return adminLobbySetWebhook(interaction);
  if (customId === 'admin_lobby_set_personas') return adminLobbySetPersonas(interaction);
  if (customId === 'admin_giveaway_set_pingrole') return adminGiveawaySetPingRole(interaction);
  
  // New admin buttons for stats and test
  if (customId === 'admin_stats_detail') return adminStatsDetail(interaction);
  if (customId === 'admin_test_autopost') return adminTestAutoPost(interaction);

// Car giveaway entry management buttons
  if (customId.startsWith('verify_entry_')) return handleVerifyEntry(interaction);
  if (customId.startsWith('contact_entry_')) return handleContactEntry(interaction);
  if (customId.startsWith('disqualify_entry_')) return handleDisqualifyEntry(interaction);

  logger.warn(`Unknown button customId: ${customId}`);
  await interaction.reply({ content: '❓ Unknown option. Use the buttons provided.', ephemeral: true });
}

// ------------------------- SELECT MENU HANDLERS -------------------------
async function handleSelectMenu(interaction, client) {
  const { customId, values, user } = interaction;
  const userId = user.id;
  const state = await getUserState(userId, user.username);

  logger.debug(`Select menu used: ${customId} = ${values[0]} by ${user.tag}`);

  if (customId === 'region_select') {
    const region = values[0];
    const model = state.selectedModel;
    if (!model) {
      await interaction.reply({ content: 'Please select a model first.', ephemeral: true });
      return;
    }

    const quoteData = generateQuote(model, region);
    const embedTemplate = bydEmbeds.quote_display.embed;
    const subtotal = quoteData.breakdown.vehiclePrice +
                     quoteData.breakdown.registration +
                     quoteData.breakdown.delivery +
                     quoteData.breakdown.tax;

    const embed = new EmbedBuilder()
      .setTitle(embedTemplate.title.replace('{{model}}', model))
      .setDescription(
        embedTemplate.description
          .replace('{{model}}', model)
          .replace('{{variant}}', 'Premium Trim')
          .replace('{{color}}', 'Aurora White')
          .replace('{{vehicle_price}}', quoteData.breakdown.vehiclePrice.toLocaleString())
          .replace('{{reg_fee}}', quoteData.breakdown.registration.toLocaleString())
          .replace('{{delivery_fee}}', quoteData.breakdown.delivery.toLocaleString())
          .replace('{{tax}}', quoteData.breakdown.tax.toLocaleString())
          .replace('{{subtotal}}', subtotal.toLocaleString())
          .replace('{{incentives_value}}', quoteData.incentivesSavings.toLocaleString())
          .replace('{{total_price}}', quoteData.total.toLocaleString())
          .replace('{{incentives_list}}', quoteData.incentivesList)
          .replace('{{monthly_finance}}', quoteData.monthlyFinance.toLocaleString())
          .replace('{{monthly_lease}}', quoteData.monthlyLease.toLocaleString())
      )
      .setColor(embedTemplate.color || '#00BFFF')
      .setFooter({ text: `⭐ ${getRandomItem(testimonials)} • ${getRandomItem(urgencyPhrases)}`, iconURL: embedTemplate.footer?.iconURL })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('quote_book_testdrive').setLabel('🗓️ Book a Test Drive').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('quote_chat_advisors').setLabel('💬 Chat With an Advisor').setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({ embeds: [embed], components: [row] });
    await updateUserState(userId, { step: null });
    return;
  }

  // Calendar: date selected
  if (customId === 'calendar_date_select') {
    const date = values[0];
    const tempData = state.tempData || {};
    await updateUserState(userId, { tempData: { ...tempData, date } });
    const { embed, row } = getTimePicker(date);
    await interaction.update({ embeds: [embed], components: [row] });
    return;
  }

  // Calendar: time selected
  if (customId.startsWith('calendar_time_select_')) {
    const time = values[0];
    const date = customId.replace('calendar_time_select_', '');
    const state = await getUserState(userId, user.username);
    const { locationType } = state.tempData || {};
    await confirmTestDrive(interaction, client, date, time, locationType);
    return;
  }
  // Admin pull leads select menu
  if (customId === 'admin_select_giveaway_leads') {
    const { handleLeadSelect } = require('../commands/admin');
    return handleLeadSelect(interaction);
  }

  logger.warn(`Unknown select menu customId: ${customId}`);
  await interaction.reply({ content: '❓ Unknown selection.', ephemeral: true });
}

// ------------------------- MODAL HANDLERS (Trade‑in + Admin) -------------------------
async function handleModal(interaction) {
  const { customId, fields, user } = interaction;
  const userId = user.id;
  const state = await getUserState(userId, user.username);

  logger.debug(`Modal submitted: ${customId} by ${user.tag}`);

  // Trade-in modals
  if (customId === 'tradein_make_model') {
    const makeModel = fields.getTextInputValue('make_model');
    await updateUserState(userId, { tempData: { ...state.tempData, makeModel }, step: 'awaiting_odometer' });
    const modal = new ModalBuilder()
      .setCustomId('tradein_odometer')
      .setTitle('Trade-in: Odometer reading')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('odometer')
            .setLabel('Miles (e.g., 45000)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
    await interaction.showModal(modal);
    return;
  }

  if (customId === 'tradein_odometer') {
    const odometer = fields.getTextInputValue('odometer');
    const { makeModel } = state.tempData;
    await updateUserState(userId, {
      tempData: { ...state.tempData, odometer },
      step: 'awaiting_condition',
    });
    const embed = new EmbedBuilder()
      .setTitle('🔧 How would you rate its condition?')
      .setDescription('Select one option below.')
      .setColor('#FF8C00');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('tradein_condition_excellent').setLabel('🌟 Excellent').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('tradein_condition_good').setLabel('👍 Good').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('tradein_condition_fair').setLabel('🛠️ Fair').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('tradein_condition_needs_repair').setLabel('💥 Needs Repair').setStyle(ButtonStyle.Danger)
    );
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
    return;
  }

  // Admin Dashboard modals
  if (customId === 'admin_modal_verify_role') {
    const roleId = fields.getTextInputValue('role_id');
    const config = await getGuildConfig(interaction.guildId);
    config.verify_role_id = roleId;
    await setGuildConfig(interaction.guildId, config);
    await interaction.reply({ content: '✅ Verification role updated.', ephemeral: true });
    logger.success(`Verification role set to ${roleId} in guild ${interaction.guildId}`);
    return;
  }

  if (customId === 'admin_modal_ticket_category') {
    const categoryId = fields.getTextInputValue('category_id');
    const config = await getGuildConfig(interaction.guildId);
    config.ticket_category_id = categoryId;
    await setGuildConfig(interaction.guildId, config);
    await interaction.reply({ content: '✅ Ticket category updated.', ephemeral: true });
    return;
  }

  if (customId === 'admin_modal_ticket_staff') {
    const roleId = fields.getTextInputValue('role_id');
    const config = await getGuildConfig(interaction.guildId);
    config.staff_role_id = roleId;
    await setGuildConfig(interaction.guildId, config);
    await interaction.reply({ content: '✅ Staff role updated.', ephemeral: true });
    return;
  }

  if (customId === 'admin_modal_ticket_logs') {
    const channelId = fields.getTextInputValue('channel_id');
    const config = await getGuildConfig(interaction.guildId);
    config.ticket_logs_channel_id = channelId || null;
    await setGuildConfig(interaction.guildId, config);
    await interaction.reply({ content: channelId ? '✅ Logs channel set.' : '❌ Logs channel removed.', ephemeral: true });
    return;
  }

  // Auto poster modals
  if (customId === 'admin_modal_autopost_channels') {
    const channelIds = fields.getTextInputValue('channel_ids').split(',').map(id => id.trim());
    const config = await getGuildConfig(interaction.guildId);
    config.auto_post_channels = channelIds;
    await setGuildConfig(interaction.guildId, config);
    await interaction.reply({ content: `✅ Auto poster channels set: ${channelIds.map(id => `<#${id}>`).join(', ')}`, ephemeral: true });
    return;
  }

  if (customId === 'admin_modal_autopost_interval') {
    const interval = parseInt(fields.getTextInputValue('interval'), 10);
    if (isNaN(interval) || interval < 1) {
      return interaction.reply({ content: '❌ Please enter a valid number of hours (>= 1).', ephemeral: true });
    }
    const config = await getGuildConfig(interaction.guildId);
    config.auto_post_interval_hours = interval;
    await setGuildConfig(interaction.guildId, config);
    await interaction.reply({ content: `✅ Auto poster interval set to every ${interval} hour(s).`, ephemeral: true });
    return;
  }

  // Lobby chatter modals
  if (customId === 'admin_modal_lobby_webhook') {
    const url = fields.getTextInputValue('webhook_url');
    const config = await getGuildConfig(interaction.guildId);
    config.lobby_webhook_url = url;
    await setGuildConfig(interaction.guildId, config);
    await interaction.reply({ content: '✅ Lobby chatter webhook URL saved.', ephemeral: true });
    return;
  }

  if (customId === 'admin_modal_lobby_personas') {
    let personas = fields.getTextInputValue('personas_json');
    const config = await getGuildConfig(interaction.guildId);
    if (!personas.trim()) {
      config.lobby_chatter_personas = [];
    } else {
      try {
        const parsed = JSON.parse(personas);
        config.lobby_chatter_personas = parsed;
      } catch (err) {
        await interaction.reply({ content: '❌ Invalid JSON. Personas not updated.', ephemeral: true });
        return;
      }
    }
    await setGuildConfig(interaction.guildId, config);
    await interaction.reply({ content: '✅ Lobby chatter personas updated.', ephemeral: true });
    return;
  }

  // Giveaway ping role modal
  if (customId === 'admin_modal_giveaway_pingrole') {
    const roleId = fields.getTextInputValue('role_id');
    if (roleId.toLowerCase() === 'none') {
      await setGiveawayPingRole(interaction.guildId, null);
      await interaction.reply({ content: '✅ Giveaway ping role disabled.', ephemeral: true });
    } else {
      await setGiveawayPingRole(interaction.guildId, roleId);
      await interaction.reply({ content: `✅ Giveaway ping role set to <@&${roleId}>.`, ephemeral: true });
    }
    return;
  }

  logger.warn(`Unknown modal customId: ${customId}`);
  await interaction.reply({ content: '❓ Unknown form.', ephemeral: true });
}

// ============================================
// NEW ADMIN FUNCTIONS (Stats & Test Post)
// ============================================

async function adminStatsDetail(interaction) {
  const autoPostStats = getAutoPostStats();
  const apiStats = getApiStats();
  
  const statsEmbed = new EmbedBuilder()
    .setTitle('📊 Detailed System Statistics')
    .setColor('#00BFFF')
    .setTimestamp();

  // Auto Poster Stats
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

  // API Stats
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

    // Model breakdown
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

  // Content Type Stats
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

  // Check if interaction has been replied/deferred
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ embeds: [statsEmbed], components: [row] });
  } else {
    await interaction.reply({ embeds: [statsEmbed], components: [row], ephemeral: true });
  }
}

async function adminTestAutoPost(interaction) {
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

// ------------------------- VERIFICATION & TICKET FUNCTIONS -------------------------
async function handleVerify(interaction) {
  const guildId = interaction.guildId;
  const config = await getGuildConfig(guildId);

  if (!config.verify_enabled) {
    return interaction.reply({ content: '❌ Verification is disabled on this server.', ephemeral: true });
  }

  const roleId = config.verify_role_id;
  if (!roleId) {
    return interaction.reply({ content: '❌ Verification role not configured. Contact an admin.', ephemeral: true });
  }

  const member = interaction.member;
  if (member.roles.cache.has(roleId)) {
    return interaction.reply({ content: '✅ You are already verified!', ephemeral: true });
  }

  try {
    await member.roles.add(roleId);
    await interaction.reply({ content: '✅ You have been verified! Welcome to the server!', ephemeral: true });
    logger.success(`${member.user.tag} verified in guild ${interaction.guildId}`);

    if (config.ticket_logs_channel_id) {
      const logChannel = interaction.guild.channels.cache.get(config.ticket_logs_channel_id);
      if (logChannel) {
        logChannel.send(`✅ ${member.user.tag} was verified.`);
      }
    }
  } catch (err) {
    logger.error('Verification error:', err);
    await interaction.reply({ content: '❌ Failed to assign role. Please contact an admin.', ephemeral: true });
  }
}

async function createTicket(interaction, client) {
  const guild = interaction.guild;
  const config = await getGuildConfig(guild.id);

  if (!config.ticket_category_id || !config.staff_role_id) {
    return interaction.reply({ content: '❌ Ticket system not fully configured. Contact an admin.', ephemeral: true });
  }

  const openTickets = await getUserOpenTickets(interaction.user.id);
  if (openTickets.length >= 1) {
    return interaction.reply({ content: '❌ You already have an open ticket. Please close it before creating a new one.', ephemeral: true });
  }

  const category = guild.channels.cache.get(config.ticket_category_id);
  if (!category) {
    return interaction.reply({ content: '❌ Ticket category not found. Contact an admin.', ephemeral: true });
  }

  const ticketName = `ticket-${interaction.user.username}-${Date.now()}`;
  const ticketChannel = await guild.channels.create({
    name: ticketName,
    type: 0,
    parent: category.id,
    permissionOverwrites: [
      { id: guild.id, deny: ['ViewChannel'] },
      { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
      { id: config.staff_role_id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
      { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
    ],
  });

  await saveTicket(guild.id, interaction.user.id, ticketChannel.id);

  const embed = new EmbedBuilder()
    .setTitle('🎫 Support Ticket')
    .setDescription(`Hello ${interaction.user}, a staff member will assist you shortly.\nTo close this ticket, use the button below.`)
    .setColor('#3498DB');
  const closeButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
  );
  await ticketChannel.send({ content: `<@&${config.staff_role_id}>`, embeds: [embed], components: [closeButton] });
  await interaction.reply({ content: `✅ Ticket created: ${ticketChannel}`, ephemeral: true });
  logger.success(`Ticket created by ${interaction.user.tag}: ${ticketChannel.name}`);

  if (config.ticket_logs_channel_id) {
    const logChannel = guild.channels.cache.get(config.ticket_logs_channel_id);
    if (logChannel) {
      logChannel.send(`🎫 Ticket created by ${interaction.user.tag} -> ${ticketChannel}`);
    }
  }
}

async function closeTicketHandler(interaction, client) {
  const channel = interaction.channel;
  if (!channel.name.startsWith('ticket-')) {
    return interaction.reply({ content: '❌ This command can only be used inside a ticket channel.', ephemeral: true });
  }

  const config = await getGuildConfig(interaction.guildId);
  const staffRoleId = config.staff_role_id;
  const isStaff = staffRoleId && interaction.member.roles.cache.has(staffRoleId);
  const isAdmin = interaction.member.permissions.has('Administrator');

  if (!isStaff && !isAdmin) {
    return interaction.reply({ content: '❌ Only staff members or admins can close tickets.', ephemeral: true });
  }

  await interaction.reply('🔒 Closing ticket in 5 seconds...');
  logger.info(`Ticket ${channel.name} will be closed by ${interaction.user.tag}`);

  setTimeout(async () => {
    try {
      await closeTicket(channel.id);
      if (config.ticket_logs_channel_id) {
        const logChannel = interaction.guild.channels.cache.get(config.ticket_logs_channel_id);
        if (logChannel) logChannel.send(`🔒 Ticket closed: ${channel.name}`);
      }
      await channel.delete();
      logger.success(`Ticket ${channel.name} closed and deleted`);
    } catch (err) {
      logger.error('Error closing ticket:', err);
    }
  }, 5000);
}

// ------------------------- ADMIN DASHBOARD INTERFACE -------------------------
async function adminVerifyMenu(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('✅ Verification Configuration')
    .setDescription('What would you like to do?')
    .setColor('#2ECC71');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_set_verify_role').setLabel('📌 Set Role').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_toggle_verify').setLabel('⏻ Toggle Enable/Disable').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_post_verify_panel').setLabel('📢 Post Panel').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('admin_refresh').setLabel('◀ Back').setStyle(ButtonStyle.Secondary)
  );
  await interaction.update({ embeds: [embed], components: [row] });
}

async function adminTicketMenu(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🎫 Ticket System Configuration')
    .setDescription('What would you like to do?')
    .setColor('#3498DB');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_set_ticket_category').setLabel('📂 Set Category').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_set_ticket_staff').setLabel('👥 Set Staff Role').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_set_ticket_logs').setLabel('📝 Set Logs Channel').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_post_ticket_panel').setLabel('📢 Post Panel').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('admin_refresh').setLabel('◀ Back').setStyle(ButtonStyle.Secondary)
  );
  await interaction.update({ embeds: [embed], components: [row] });
}

async function adminRefresh(interaction) {
  const guildId = interaction.guildId;
  const config = await getGuildConfig(guildId);
  
  // Get stats
  let autoPostStats = null;
  let apiStats = null;
  try {
    autoPostStats = getAutoPostStats();
    apiStats = getApiStats();
  } catch (err) {
    logger.debug('Stats not available:', err.message);
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
    .setDescription('Configuration refreshed.')
    .setColor('#00BFFF')
    .addFields(
      { name: '✅ Verification', value: `**Status:** ${config.verify_enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Role:** ${verifyRole}`, inline: true },
      { name: '🎫 Ticket System', value: `**Category:** ${ticketCategory}\n**Staff Role:** ${staffRole}\n**Logs Channel:** ${logsChannel}`, inline: true },
      { name: '🤖 Auto Poster', value: getAutoPostFieldValue(config, autoPostChannels, autoPostStats), inline: true },
      { name: '💬 Lobby Chatter', value: `**Status:** ${lobbyStatus}\n**Webhook:** ${lobbyWebhook}`, inline: true },
      { name: '🎁 Giveaways', value: `**Ping Role:** ${giveawayPingRole}\n**Commands:** \`/giveaway\` \`/cargiveaway\``, inline: true }
    )
    .setTimestamp();

  // Add stats if available
  if (autoPostStats && autoPostStats.totalPosts > 0) {
    embed.addFields({
      name: '📊 Auto Poster Statistics',
      value: getStatsFieldValue(autoPostStats, apiStats),
      inline: false
    });
  }

  // Add health status
  if (apiStats) {
    embed.addFields({
      name: '🏥 System Health',
      value: getHealthStatus(apiStats),
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
  
  await interaction.update({ embeds: [embed], components: [row1, row2, row3, row4] });
}

// ============================================
// STATS HELPER FUNCTIONS
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
  }
  
  if (apiStats) {
    value += `\n**API Calls:** ${apiStats.totalRequests}\n`;
    value += `**Fallback Used:** ${apiStats.fallbackUsed || 0} times\n`;
    value += `**Fallback Available:** ${apiStats.fallbackPostsAvailable || 0} posts`;
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
  }
  
  if (apiStats.fallbackPostsAvailable > 0) {
    status += `🟢 **Fallback Content:** ${apiStats.fallbackPostsAvailable} posts ready\n`;
  }
  
  if (apiStats.fallbackPostsWithImages) {
    status += `🖼️ **Image Assets:** ${apiStats.fallbackPostsWithImages} posts have images`;
  }
  
  return status;
}

// ----- ADMIN SETTING FUNCTIONS -----
async function adminSetVerifyRole(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('admin_modal_verify_role')
    .setTitle('Set Verification Role')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('role_id')
          .setLabel('Role ID (right‑click role → Copy ID)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
  await interaction.showModal(modal);
}

async function adminToggleVerify(interaction) {
  const guildId = interaction.guildId;
  const config = await getGuildConfig(guildId);
  config.verify_enabled = !config.verify_enabled;
  await setGuildConfig(guildId, config);
  await interaction.reply({ content: `✅ Verification ${config.verify_enabled ? 'enabled' : 'disabled'}.`, ephemeral: true });
}

async function adminPostVerifyPanel(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  if (!config.verify_enabled) {
    return interaction.reply({ content: '❌ Verification system is disabled. Enable it first.', ephemeral: true });
  }
  if (!config.verify_role_id) {
    return interaction.reply({ content: '❌ No verification role set. Set one first.', ephemeral: true });
  }
  const embed = new EmbedBuilder()
    .setTitle('⚡ Welcome to the BYD Community')
    .setDescription(
      `Before you explore test drives, exclusive offers, and owner discussions, we need a quick verification — it helps keep our community safe and spam‑free.\n\n` +
      `**Click the button below** to get instant access. You'll also unlock:\n` +
      `• 🔒 Private test drive booking\n` +
      `• 💰 Real‑time EV incentives\n` +
      `• 🎫 Priority support tickets\n\n` +
      `✨ Verified members get early access to limited‑edition BYD drops.`
    )
    .setColor('#00BFFF')
    .setFooter({ text: '⚡ Blade Battery Technology • Trusted by 15,000+ drivers' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verify_button').setLabel('✅ Verify Me').setStyle(ButtonStyle.Success)
  );
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
}

async function adminSetTicketCategory(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('admin_modal_ticket_category')
    .setTitle('Set Ticket Category')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('category_id')
          .setLabel('Category ID (right‑click category → Copy ID)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
  await interaction.showModal(modal);
}

async function adminSetTicketStaff(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('admin_modal_ticket_staff')
    .setTitle('Set Staff Role')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('role_id')
          .setLabel('Role ID')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
  await interaction.showModal(modal);
}

async function adminSetTicketLogs(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('admin_modal_ticket_logs')
    .setTitle('Set Logs Channel')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('channel_id')
          .setLabel('Channel ID (leave empty to remove)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
      )
    );
  await interaction.showModal(modal);
}

async function adminPostTicketPanel(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  if (!config.ticket_category_id || !config.staff_role_id) {
    return interaction.reply({ content: '❌ Ticket category and staff role must be set first.', ephemeral: true });
  }
  const embed = new EmbedBuilder()
    .setTitle('🎫 BYD Concierge – Priority Support')
    .setDescription(
      `Need help? Click the button below to open a private ticket. A specialist will reply within 1 hour.\n\n` +
      `🔒 Your conversation is only visible to you and our staff.`
    )
    .setColor('#00BFFF')
    .setFooter({ text: '⚡ BYD Blade Battery • Trusted by 15,000+ drivers' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('create_ticket').setLabel('📩 Create Ticket').setStyle(ButtonStyle.Primary)
  );
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
}

// ----- AUTO POSTER ADMIN FUNCTIONS -----
async function adminAutopostMenu(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  const channels = config.auto_post_channels?.length ? config.auto_post_channels.map(id => `<#${id}>`).join(', ') : 'None';
  
  const autoPostStats = getAutoPostStats();
  const apiStats = getApiStats();
  
  const embed = new EmbedBuilder()
    .setTitle('🤖 Auto Poster Configuration')
    .setDescription(
      `**Status:** ${config.auto_post_enabled ? '🟢 Enabled' : '🔴 Disabled'}\n` +
      `**Channels:** ${channels}\n` +
      `**Interval:** Every ${config.auto_post_interval_hours || 2} hours\n` +
      `**Mode:** ${process.env.AUTO_POST_ALL_CHANNELS === 'true' ? 'All channels' : 'Round-robin'}\n\n` +
      `**Statistics:**\n` +
      `• Total Posts: ${autoPostStats?.totalPosts || 0}\n` +
      `• Success Rate: ${autoPostStats?.successRate || 'N/A'}\n` +
      `• API/Fallback: ${autoPostStats?.apiPosts || 0}/${autoPostStats?.fallbackPosts || 0}`
    )
    .setColor('#9B59B6');
  
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_autopost_toggle').setLabel('⏻ Toggle On/Off').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_autopost_set_channels').setLabel('📢 Set Channels').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_autopost_set_interval').setLabel('⏱️ Set Interval').setStyle(ButtonStyle.Primary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_test_autopost').setLabel('🧪 Test Post Now').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('admin_refresh').setLabel('◀ Back').setStyle(ButtonStyle.Secondary)
  );
  
  await interaction.update({ embeds: [embed], components: [row1, row2] });
}

async function adminAutopostToggle(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  config.auto_post_enabled = !config.auto_post_enabled;
  await setGuildConfig(interaction.guildId, config);
  await interaction.reply({ content: `✅ Auto poster ${config.auto_post_enabled ? 'enabled' : 'disabled'}.`, ephemeral: true });
}

async function adminAutopostSetChannels(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('admin_modal_autopost_channels')
    .setTitle('Set Auto Poster Channels')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('channel_ids')
          .setLabel('Channel IDs (comma‑separated)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setPlaceholder('123456789,987654321')
      )
    );
  await interaction.showModal(modal);
}

async function adminAutopostSetInterval(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('admin_modal_autopost_interval')
    .setTitle('Set Posting Interval (hours)')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('interval')
          .setLabel('Hours between posts (default 2)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('2')
      )
    );
  await interaction.showModal(modal);
}

// ----- LOBBY CHATTER ADMIN FUNCTIONS -----
async function adminLobbyMenu(interaction) {
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
  await interaction.update({ embeds: [embed], components: [row] });
}

async function adminLobbyToggle(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  config.lobby_chatter_enabled = !config.lobby_chatter_enabled;
  await setGuildConfig(interaction.guildId, config);
  await interaction.reply({ content: `✅ Lobby chatter ${config.lobby_chatter_enabled ? 'enabled' : 'disabled'}.`, ephemeral: true });
}

async function adminLobbySetWebhook(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('admin_modal_lobby_webhook')
    .setTitle('Set Webhook URL')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('webhook_url')
          .setLabel('Discord Webhook URL')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setPlaceholder('https://discord.com/api/webhooks/...')
      )
    );
  await interaction.showModal(modal);
}

async function adminLobbySetPersonas(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('admin_modal_lobby_personas')
    .setTitle('Set Personas (JSON array)')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('personas_json')
          .setLabel('JSON array of {name,avatar,role}')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setPlaceholder('Leave empty to reset to default 9 personas')
      )
    );
  await interaction.showModal(modal);
}

// ----- GIVEAWAY ADMIN FUNCTIONS -----
async function adminGiveawayMenu(interaction) {
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
  await interaction.update({ embeds: [embed], components: [row] });
}

async function adminGiveawaySetPingRole(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('admin_modal_giveaway_pingrole')
    .setTitle('Set Giveaway Ping Role')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('role_id')
          .setLabel('Role ID (right‑click role → Copy ID)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Enter role ID, or "none" to disable')
      )
    );
  await interaction.showModal(modal);
}

// ============================================
// CAR GIVEAWAY ENTRY MANAGEMENT BUTTONS
// ============================================

async function handleVerifyEntry(interaction) {
  const parts = interaction.customId.split('_');
  const giveawayId = parts[2];
  const userId = parts[3];
  
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ Only admins can verify entries.', flags: 64 });
  }
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`verified_${giveawayId}_${userId}`).setLabel('✅ Verified').setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId(`contact_entry_${giveawayId}_${userId}`).setLabel('📩 Contact').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`disqualify_entry_${giveawayId}_${userId}`).setLabel('❌ Disqualify').setStyle(ButtonStyle.Danger)
  );
  
  await interaction.update({ content: `✅ **Entry verified** by ${interaction.user.tag}`, components: [row] });
  logger.info(`Entry verified for user ${userId} in giveaway ${giveawayId} by ${interaction.user.tag}`);
}

async function handleContactEntry(interaction) {
  const parts = interaction.customId.split('_');
  const userId = parts[3];
  
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ Only admins can contact entrants.', flags: 64 });
  }
  
  await interaction.reply({ content: `📩 **Contact <@${userId}>:** Use this channel to communicate with them directly.`, flags: 64 });
}

async function handleDisqualifyEntry(interaction) {
  const parts = interaction.customId.split('_');
  const giveawayId = parts[2];
  const userId = parts[3];
  
  if (!isAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ Only admins can disqualify entries.', flags: 64 });
  }
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`disqualified_${giveawayId}_${userId}`).setLabel('❌ Disqualified').setStyle(ButtonStyle.Danger).setDisabled(true)
  );
  
  try {
    const { pool } = require('../utils/database');
    await pool.query('DELETE FROM car_giveaway_entries WHERE giveaway_id = $1 AND user_id = $2', [giveawayId, userId]);
  } catch {}
  
  await interaction.update({ content: `❌ **Entry disqualified** by ${interaction.user.tag}`, components: [row] });
  
  try {
    const user = await interaction.client.users.fetch(userId);
    await user.send({ content: `❌ Your entry for giveaway #${giveawayId} has been disqualified. Contact an admin if you believe this is an error.` });
  } catch {}
  
  logger.info(`Entry disqualified for user ${userId} in giveaway ${giveawayId} by ${interaction.user.tag}`);
}
// ------------------------- CORE BUSINESS FUNCTIONS -------------------------
async function selectModel(interaction, model) {
  const userId = interaction.user.id;
  await updateUserState(userId, { selectedModel: model, step: 'model_selected' });

  const advisor = getPersonalAdvisor();
  const testimonial = getRandomItem(testimonials);
  const urgency = getRandomItem(urgencyPhrases);

  const embed = new EmbedBuilder()
    .setTitle(`✨ Excellent choice — the BYD ${model}! ✨`)
    .setDescription(
      `${testimonial}\n\n` +
      `**Your personal BYD expert, ${advisor}, is ready to help.**\n\n` +
      `${urgency}\n\n` +
      `👉 What would you like to do first?`
    )
    .setColor('#00BFFF')
    .setFooter({ text: `⚡ BYD Blade Battery • ${advisor} will reply within 1 hour`, iconURL: process.env.STATIC_URL ? `${process.env.STATIC_URL}/byd-logo.png` : 'https://cdn.byd.com/bot/byd-logo.png' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('action_brochure').setLabel('📄 Brochure & Specs').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('action_quote').setLabel('💰 Get My Quote').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('action_testdrive').setLabel('🗓️ Book a Test Drive').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('action_tradein').setLabel('🔄 Value My Trade-In').setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({ embeds: [embed], components: [row] });
  logger.debug(`Model selected: ${model} by ${interaction.user.tag}`);
}

async function handleNotSure(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('❓ Let\'s find your perfect BYD – together')
    .setDescription(
      `Tell me what matters most, and I\'ll match you with the ideal EV.\n\n` +
      `_"${getRandomItem(testimonials)}"_\n\n` +
      `👉 Choose your priority below:`
    )
    .setColor('#2ECC71');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('need_affordability').setLabel('💸 Affordability & Value').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('need_range').setLabel('⚡ Max Range').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('need_family').setLabel('👨‍👩‍👧‍👦 Family Space').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('need_city').setLabel('🏙️ City Parking').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('need_fleet').setLabel('💼 Fleet/Commercial').setStyle(ButtonStyle.Secondary)
  );
  await interaction.update({ embeds: [embed], components: [row] });
}

async function startQuoteFlow(interaction, model) {
  if (!model) {
    return interaction.reply({ content: '❓ Please select a BYD model first.', ephemeral: true });
  }
  const userId = interaction.user.id;
  await updateUserState(userId, { step: 'awaiting_region' });
  const embed = new EmbedBuilder()
    .setTitle('📍 One last step – where do you drive?')
    .setDescription(`I\'ll apply your **local EV incentives** to give you the most accurate on‑road price.\n\n_"${getRandomItem(testimonials)}"_\n\nSelect your region below – it takes 10 seconds.`)
    .setColor('#3498DB');
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('region_select')
    .setPlaceholder('Choose your region')
    .addOptions([
      { label: 'California', value: 'California' }, { label: 'Texas', value: 'Texas' },
      { label: 'New York', value: 'New York' }, { label: 'Florida', value: 'Florida' },
      { label: 'Colorado', value: 'Colorado' }, { label: 'New Jersey', value: 'New Jersey' },
      { label: 'Washington', value: 'Washington' },
    ]);
  const row = new ActionRowBuilder().addComponents(selectMenu);
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function startTestDriveFlow(interaction, model) {
  if (!model) {
    return interaction.reply({ content: '❓ Please select a BYD model first.', ephemeral: true });
  }
  const embed = new EmbedBuilder()
    .setTitle('🚗 Let\'s get you behind the wheel – no pressure.')
    .setDescription(
      `Choose how you\'d like to experience the BYD ${model}:\n\n` +
      `🏢 **Showroom visit** – full tour, coffee, and expert talk.\n` +
      `🏠 **Home test drive** – we bring the car to your door.\n\n` +
      `_"${getRandomItem(testimonials)}"_\n\n` +
      `${getRandomItem(urgencyPhrases)}`
    )
    .setColor('#2ECC71');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('td_showroom').setLabel('🏢 Visit Showroom').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('td_home').setLabel('🏠 Home Test Drive').setStyle(ButtonStyle.Success)
  );
  await interaction.update({ embeds: [embed], components: [row] });
}

async function startTradeInFlow(interaction, model) {
  const modal = new ModalBuilder()
    .setCustomId('tradein_make_model')
    .setTitle('Trade-in: Your current car')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('make_model')
          .setLabel('Make and model (e.g., Honda CR-V 2021)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
  await interaction.showModal(modal);
}

async function askForDateTime(interaction, locationType) {
  await interaction.deferUpdate();
  const userId = interaction.user.id;
  await updateUserState(userId, { tempData: { locationType } });
  const { embed, row } = getCalendarPicker();
  await interaction.editReply({ embeds: [embed], components: [row] });
}

async function confirmTestDrive(interaction, client, date, time, locationType) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  let threadChannel = null;

  if (interaction.guild) {
    const guild = interaction.guild;
    const member = await guild.members.fetch(userId);
    let category = guild.channels.cache.find(c => c.name === 'Sales Threads' && c.type === 4);
    if (!category) category = await guild.channels.create({ name: 'Sales Threads', type: 4 });
    const channelName = `testdrive-${username}-${Date.now()}`;
    const advisorRole = guild.roles.cache.find(r => r.name === 'Sales Advisor');
    threadChannel = await guild.channels.create({
      name: channelName, type: 0, parent: category.id,
      permissionOverwrites: [
        { id: guild.id, deny: ['ViewChannel'] },
        { id: member.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
        { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
        ...(advisorRole ? [{ id: advisorRole.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }] : []),
      ],
    });
    await threadChannel.send({ content: `<@${member.id}>, your test drive has been booked!` });
    if (advisorRole) await threadChannel.send(`🔔 <@&${advisorRole.id}> New test drive request from ${member.user.tag}.`);
  }

  const embed = new EmbedBuilder()
    .setTitle('🚗 Test Drive Confirmed!')
    .setDescription(`Your test drive has been booked:\n\n📅 **Date:** ${date}\n⏰ **Time:** ${time}\n📍 **Location:** ${locationType === 'showroom' ? 'BYD Showroom' : 'Your Home Address'}`)
    .setColor('#2ECC71')
    .setFooter({ text: `✨ ${getRandomItem(testimonials)} • Your advisor will reach out shortly` })
    .setTimestamp();

  await interaction.update({ embeds: [embed], components: [] });
  if (threadChannel) await threadChannel.send({ embeds: [embed] });
  await saveTestDriveBooking(userId, username, date, time, locationType, threadChannel?.id || 'DM_BOOKING');
  await updateUserState(userId, { step: 'test_drive_booked', tempData: {} });
  logger.success(`🚗 Test drive booked: ${username} on ${date} at ${time} (${locationType})`);
}

async function sendBrochure(interaction, model) {
  if (!model) return interaction.reply({ content: '❓ Please select a BYD model first.', ephemeral: true });
  await interaction.reply({ content: `📄 Brochure for BYD ${model}: https://byd.com/brochure/${model.toLowerCase()}`, ephemeral: true });
}

async function transferToAdvisor(interaction) {
  await interaction.reply({ content: '💬 A sales advisor will be with you shortly. Creating a private thread...', ephemeral: true });
}

async function setTradeCondition(interaction, condition) {
  const userId = interaction.user.id;
  const state = await getUserState(userId, interaction.user.username);
  const { makeModel, odometer } = state.tempData || {};
  await interaction.reply({ content: `✅ Your ${makeModel || 'vehicle'} with ${odometer || 'N/A'} miles is rated **${condition}**. Estimated trade‑in: $${Math.floor(Math.random() * 50000 + 50000).toLocaleString()}. A formal offer will be sent shortly.`, ephemeral: true });
  await updateUserState(userId, { step: null, tempData: {} });
}

async function recommendAffordability(interaction) {
  await interaction.reply({ content: '💸 **Best value picks:**\n• **Seagull** – $19,990 (city EV)\n• **Dolphin** – $29,990 (hatch)\n• **Yuan Plus** – $37,990 (crossover)\n\nWant a quote on any of these?' });
}
async function recommendRange(interaction) {
  await interaction.reply({ content: '⚡ **Longest range:**\n• **Seal** – 350+ miles\n• **Tang** – 320 miles (3‑row SUV)\n• **Han Performance** – 310 miles\n\nWhich one catches your eye?' });
}
async function recommendFamily(interaction) {
  await interaction.reply({ content: '👨‍👩‍👧‍👦 **Family‑friendly BYDs:**\n• **ATTO 3** – compact SUV, $34,990*\n• **Tang** – 3‑row midsize, $49,990*\n• **Song Plus** – spacious family SUV, $42,990*\n\n_*Before EV credits._ Would you like a safety brochure or a test drive?' });
}
async function recommendCity(interaction) {
  await interaction.reply({ content: '🏙️ **Perfect for city driving:**\n• **Seagull** – ultra‑compact, $19,990\n• **Dolphin** – nimble hatch, $29,990\n• **Yuan Plus** – crossover with parking assist, $37,990\n\nAll come with parking sensors and 360° camera. Want to see city range figures?' });
}
async function handleFleet(interaction) {
  await interaction.reply({ content: '🚛 A commercial sales advisor will contact you soon. Please share your fleet size and use case in the thread.' });
}
