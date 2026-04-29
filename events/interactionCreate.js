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

const bydEmbeds = require('../modules/bydEmbeds');
const { getUserState, updateUserState } = require('../utils/stateManager');
const { generateQuote, models, regionIncentives } = require('../utils/bydData');
const { getCalendarPicker, getTimePicker } = require('../utils/calendar');
const { 
  saveTestDriveBooking, 
  upsertLead,
  getGuildConfig,
  saveTicket,
  closeTicket,
  getUserOpenTickets 
} = require('../utils/database');

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    // ─── Slash Commands ─────────────────────────────────────────
    if (interaction.isCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`❌ Error executing ${interaction.commandName}:`, error);
        const reply = { content: '❌ There was an error executing this command.', ephemeral: true };
        if (interaction.deferred || interaction.replied) await interaction.editReply(reply);
        else await interaction.reply(reply);
      }
      return;
    }

    // ─── Buttons ────────────────────────────────────────────────
    if (interaction.isButton()) {
      await handleButton(interaction, client);
      return;
    }

    // ─── Select Menus ───────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction, client);
      return;
    }

    // ─── Modals (Trade‑in text inputs) ─────────────────────────
    if (interaction.isModalSubmit()) {
      await handleModal(interaction);
      return;
    }
  });
};

// ------------------------- Button Handlers -------------------------
async function handleButton(interaction, client) {
  const { customId, user } = interaction;
  const userId = user.id;
  let state = await getUserState(userId, user.username);

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

  // ─── Verification & Ticket System ─────────────────────────────
  if (customId === 'verify_button') return handleVerify(interaction);
  if (customId === 'create_ticket') return createTicket(interaction, client);
  if (customId === 'close_ticket') return closeTicketHandler(interaction, client);

  await interaction.reply({ content: '❓ Unknown option. Use the buttons provided.', ephemeral: true });
}

// ------------------------- Select Menu Handlers -------------------------
async function handleSelectMenu(interaction, client) {
  const { customId, values, user } = interaction;
  const userId = user.id;
  const state = await getUserState(userId, user.username);

  if (customId === 'region_select') {
    const region = values[0];
    const model = state.selectedModel;
    if (!model) {
      await interaction.reply({ content: 'Please select a model first.', ephemeral: true });
      return;
    }

    const quoteData = generateQuote(model, region);
    const embedTemplate = bydEmbeds.quote_display.embed;
    const embed = new EmbedBuilder()
      .setTitle(embedTemplate.title.replace('{{model}}', model))
      .setDescription(
        embedTemplate.description
          .replace('{{model}}', model)
          .replace('{{variant}}', 'Premium Trim')
          .replace('{{color}}', 'Aurora White')
          .replace('{{vehicle_price}}', `R$ ${(models[model]?.basePrice || 200000).toLocaleString()}`)
          .replace('{{reg_fee}}', 'R$ 4,800')
          .replace('{{delivery_fee}}', 'R$ 3,200')
          .replace('{{tax}}', `R$ ${Math.round((models[model]?.basePrice || 200000) * 0.04).toLocaleString()}`)
          .replace('{{total_price}}', `R$ ${quoteData.total.toLocaleString()}`)
          .replace('{{incentives_list}}', regionIncentives[region]?.ipvaExempt ? 'IPVA exemption (saves R$9,560/yr)' : 'No current incentives')
          .replace('{{monthly_finance}}', `R$ ${quoteData.monthlyFinance.toLocaleString()}`)
          .replace('{{monthly_lease}}', `R$ ${Math.round(quoteData.monthlyFinance * 0.91).toLocaleString()}`)
      )
      .setColor(embedTemplate.color || '#00BFFF')
      .setFooter({ text: embedTemplate.footer.text, iconURL: embedTemplate.footer.iconURL })
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

  await interaction.reply({ content: '❓ Unknown selection.', ephemeral: true });
}

// ------------------------- Modal Handlers (Trade‑in) -------------------------
async function handleModal(interaction) {
  const { customId, fields, user } = interaction;
  const userId = user.id;
  const state = await getUserState(userId, user.username);

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
            .setLabel('Kilometers (e.g., 85000)')
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

  await interaction.reply({ content: '❓ Unknown form.', ephemeral: true });
}

// ------------------------- Verification & Ticket Functions -------------------------
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
    
    // Optional: log to configured channel
    if (config.ticket_logs_channel_id) {
      const logChannel = interaction.guild.channels.cache.get(config.ticket_logs_channel_id);
      if (logChannel) {
        logChannel.send(`✅ ${member.user.tag} was verified.`);
      }
    }
  } catch (err) {
    console.error('Verification error:', err);
    await interaction.reply({ content: '❌ Failed to assign role. Please contact an admin.', ephemeral: true });
  }
}

async function createTicket(interaction, client) {
  const guild = interaction.guild;
  const config = await getGuildConfig(guild.id);
  
  if (!config.ticket_category_id || !config.staff_role_id) {
    return interaction.reply({ content: '❌ Ticket system not fully configured. Contact an admin.', ephemeral: true });
  }
  
  // Optional: prevent user from having multiple open tickets
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
  
  // Log to logs channel if set
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
  
  setTimeout(async () => {
    try {
      await closeTicket(channel.id);
      if (config.ticket_logs_channel_id) {
        const logChannel = interaction.guild.channels.cache.get(config.ticket_logs_channel_id);
        if (logChannel) logChannel.send(`🔒 Ticket closed: ${channel.name}`);
      }
      await channel.delete();
    } catch (err) {
      console.error('Error closing ticket:', err);
    }
  }, 5000);
}

// ------------------------- Core Business Functions (unchanged) -------------------------
async function selectModel(interaction, model) {
  const userId = interaction.user.id;
  await updateUserState(userId, { selectedModel: model, step: 'model_selected' });

  const embed = new EmbedBuilder()
    .setTitle(`🦭 Great choice — the BYD ${model}!`)
    .setDescription(`Sleek, powerful, and built on the Blade Battery for uncompromising safety.\n\nWhat would you like to do first?`)
    .setColor('#00BFFF');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('action_brochure').setLabel('📄 Brochure & Specs').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('action_quote').setLabel('💰 Get My Quote').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('action_testdrive').setLabel('🗓️ Book Test Drive').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('action_tradein').setLabel('🔄 Value My Trade-In').setStyle(ButtonStyle.Secondary)
  );
  await interaction.update({ embeds: [embed], components: [row] });
}

async function handleNotSure(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('❓ Let’s find your perfect BYD')
    .setDescription('What’s most important to you in your next vehicle?')
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
  const userId = interaction.user.id;
  await updateUserState(userId, { step: 'awaiting_region' });

  const embed = new EmbedBuilder()
    .setTitle('📍 Select your state or region')
    .setDescription('I’ll factor in local EV incentives and taxes to give you an accurate on-road price.')
    .setColor('#3498DB');

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('region_select')
    .setPlaceholder('Choose your region')
    .addOptions([
      { label: 'São Paulo', value: 'São Paulo' },
      { label: 'Rio de Janeiro', value: 'Rio de Janeiro' },
      { label: 'Dubai', value: 'Dubai' },
      { label: 'Abu Dhabi', value: 'Abu Dhabi' },
      { label: 'Bangkok', value: 'Bangkok' },
    ]);
  const row = new ActionRowBuilder().addComponents(selectMenu);
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
}

async function startTestDriveFlow(interaction, model) {
  const embed = new EmbedBuilder()
    .setTitle('🚗 Let’s get you behind the wheel!')
    .setDescription('Do you prefer to visit a showroom or have the car brought to your home?')
    .setColor('#2ECC71');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('td_showroom').setLabel('🏢 Visit Showroom').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('td_home').setLabel('🏠 Home Test Drive').setStyle(ButtonStyle.Success)
  );
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
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
  const userId = interaction.user.id;
  await updateUserState(userId, { tempData: { locationType } });
  const { embed, row } = getCalendarPicker();
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
}

async function confirmTestDrive(interaction, client, date, time, locationType) {
  const userId = interaction.user.id;
  const guild = interaction.guild;
  const member = await guild.members.fetch(userId);
  const username = member.user.username;

  let category = guild.channels.cache.find(c => c.name === 'Sales Threads' && c.type === 4);
  if (!category) {
    category = await guild.channels.create({
      name: 'Sales Threads',
      type: 4,
    });
  }

  const channelName = `testdrive-${username}-${Date.now()}`;
  const advisorRole = guild.roles.cache.find(r => r.name === 'Sales Advisor');

  const threadChannel = await guild.channels.create({
    name: channelName,
    type: 0,
    parent: category.id,
    permissionOverwrites: [
      { id: guild.id, deny: ['ViewChannel'] },
      { id: member.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
      { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
      ...(advisorRole ? [{ id: advisorRole.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }] : []),
    ],
  });

  const embedTemplate = bydEmbeds.test_drive_confirmed.embed;
  const embed = new EmbedBuilder()
    .setTitle(embedTemplate.title)
    .setDescription(
      embedTemplate.description
        .replace('{{date}}', date)
        .replace('{{time}}', time)
        .replace('{{location_type}}', locationType === 'showroom' ? 'Showroom' : 'Home')
        .replace('{{address}}', locationType === 'showroom' ? 'BYD Showroom, 123 EV Blvd' : 'Your home address (to confirm)')
    )
    .setColor(embedTemplate.color)
    .setFooter(embedTemplate.footer)
    .setTimestamp();

  await interaction.update({ embeds: [embed], components: [] });
  await threadChannel.send({ content: `<@${member.id}>, your test drive has been booked!`, embeds: [embed] });
  if (advisorRole) {
    await threadChannel.send(`🔔 <@&${advisorRole.id}> A new test drive request requires confirmation.`);
  }

  await saveTestDriveBooking(userId, username, date, time, locationType, threadChannel.id);
  await updateUserState(userId, { step: 'test_drive_booked', tempData: {} });
}

// ------------------------- Stubs (replace with real logic) -------------------------
async function sendBrochure(interaction, model) {
  await interaction.reply({ content: `📄 Brochure for BYD ${model}: https://byd.com/brochure/${model.toLowerCase()}`, ephemeral: false });
}
async function transferToAdvisor(interaction) {
  await interaction.reply({ content: '💬 A sales advisor will be with you shortly. Creating a private thread...', ephemeral: false });
}
async function setTradeCondition(interaction, condition) {
  const userId = interaction.user.id;
  const state = await getUserState(userId, interaction.user.username);
  const { makeModel, odometer } = state.tempData;
  await interaction.reply({ content: `✅ Your ${makeModel} with ${odometer} km is rated **${condition}**. Estimated trade‑in: R$ ${Math.floor(Math.random() * 50000 + 50000)}. A formal offer will be sent shortly.`, ephemeral: false });
  await updateUserState(userId, { step: null, tempData: {} });
}
async function recommendAffordability(interaction) { await interaction.reply({ content: '💸 I recommend the **BYD Dolphin** – great value and low running costs. Want a quote?' }); }
async function recommendRange(interaction) { await interaction.reply({ content: '⚡ For max range, the **BYD Seal** is best. Highway or rural driving?' }); }
async function recommendFamily(interaction) { await interaction.reply({ content: '👨‍👩‍👧‍👦 For family space, check out the **BYD ATTO 3** or **Tang**. Safety brochure?' }); }
async function recommendCity(interaction) { await interaction.reply({ content: '🏙️ City parking? **BYD Dolphin** or **Seagull** – compact with parking assist. Range figures?' }); }
async function handleFleet(interaction) { await interaction.reply({ content: '🚛 A commercial sales advisor will contact you soon.' }); }