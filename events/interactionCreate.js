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

// Import your BYD embeds module (rename path as needed)
const bydEmbeds = require('../modules/bydEmbeds');
// Import state manager and data helpers
const { getUserState, updateUserState } = require('../utils/stateManager');
const { generateQuote, models, regionIncentives } = require('../utils/bydData');

module.exports = (client) => {
  // Listen for ALL interactions (commands + buttons + selects + modals)
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
      await handleButton(interaction);
      return;
    }

    // ─── Select Menus ───────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction);
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
async function handleButton(interaction) {
  const { customId, user } = interaction;
  const userId = user.id;
  let state = getUserState(userId);

  // ---- Welcome / Model selection (from @Lead role trigger) ----
  if (customId === 'welcome_model_dolphin') return selectModel(interaction, 'Dolphin');
  if (customId === 'welcome_model_seal') return selectModel(interaction, 'Seal');
  if (customId === 'welcome_model_atto3') return selectModel(interaction, 'ATTO 3');
  if (customId === 'welcome_model_han') return selectModel(interaction, 'Han');
  if (customId === 'welcome_model_commercial') return selectModel(interaction, 'Commercial');
  if (customId === 'welcome_model_notsure') return handleNotSure(interaction);

  // ---- Model-specific actions (after model selected) ----
  if (customId === 'action_brochure') return sendBrochure(interaction, state.selectedModel);
  if (customId === 'action_quote') return startQuoteFlow(interaction, state.selectedModel);
  if (customId === 'action_testdrive') return startTestDriveFlow(interaction, state.selectedModel);
  if (customId === 'action_tradein') return startTradeInFlow(interaction, state.selectedModel);

  // ---- Quote result buttons ----
  if (customId === 'quote_book_testdrive') return startTestDriveFlow(interaction, state.selectedModel);
  if (customId === 'quote_chat_advisors') return transferToAdvisor(interaction);

  // ---- Test drive location buttons ----
  if (customId === 'td_showroom') return askForDateTime(interaction, 'showroom');
  if (customId === 'td_home') return askForDateTime(interaction, 'home');

  // ---- Trade‑in condition buttons ----
  if (customId === 'tradein_condition_excellent') return setTradeCondition(interaction, 'Excellent');
  if (customId === 'tradein_condition_good') return setTradeCondition(interaction, 'Good');
  if (customId === 'tradein_condition_fair') return setTradeCondition(interaction, 'Fair');
  if (customId === 'tradein_condition_needs_repair') return setTradeCondition(interaction, 'Needs Repair');

  // ---- Follow‑up buttons (from dormant message) ----
  if (customId === 'followup_brochure') return sendBrochure(interaction, state.selectedModel);
  if (customId === 'followup_quote') return startQuoteFlow(interaction, state.selectedModel);
  if (customId === 'followup_testdrive') return startTestDriveFlow(interaction, state.selectedModel);

  // ---- Need‑based recommendations (from "Not Sure") ----
  if (customId === 'need_affordability') return recommendAffordability(interaction);
  if (customId === 'need_range') return recommendRange(interaction);
  if (customId === 'need_family') return recommendFamily(interaction);
  if (customId === 'need_city') return recommendCity(interaction);
  if (customId === 'need_fleet') return handleFleet(interaction);

  await interaction.reply({ content: '❓ Unknown option. Please use the buttons provided.', ephemeral: true });
}

// ------------------------- Select Menu Handlers -------------------------
async function handleSelectMenu(interaction) {
  const { customId, values, user } = interaction;
  const userId = user.id;
  const state = getUserState(userId);

  if (customId === 'region_select') {
    const region = values[0];
    const model = state.selectedModel;
    if (!model) {
      await interaction.reply({ content: 'Please select a model first.', ephemeral: true });
      return;
    }

    // Generate quote data
    const quoteData = generateQuote(model, region);
    const embedTemplate = bydEmbeds.quote_display.embed;

    // Build the embed – replace placeholders with real values
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
    updateUserState(userId, { step: null });
    return;
  }

  // Add other select menus (e.g., calendar date picker) here
  await interaction.reply({ content: '❓ Unknown selection.', ephemeral: true });
}

// ------------------------- Modal Handlers (Trade‑in) -------------------------
async function handleModal(interaction) {
  const { customId, fields, user } = interaction;
  const userId = user.id;
  const state = getUserState(userId);

  if (customId === 'tradein_make_model') {
    const makeModel = fields.getTextInputValue('make_model');
    updateUserState(userId, { tempData: { ...state.tempData, makeModel }, step: 'awaiting_odometer' });

    // Second modal for odometer
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
    updateUserState(userId, {
      tempData: { ...state.tempData, odometer },
      step: 'awaiting_condition',
    });

    // Ask for condition via buttons
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

// ------------------------- Helper Functions (simplified) -------------------------
async function selectModel(interaction, model) {
  const userId = interaction.user.id;
  updateUserState(userId, { selectedModel: model, step: 'model_selected' });

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
  updateUserState(userId, { step: 'awaiting_region' });

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

// Stubs for other required functions (add real logic as needed)
async function sendBrochure(interaction, model) { await interaction.reply({ content: `📄 Here's the brochure for the BYD ${model}: https://byd.com/brochure/${model.toLowerCase()}`, ephemeral: false }); }
async function transferToAdvisor(interaction) { await interaction.reply({ content: '💬 A sales advisor will be with you shortly. Please wait while we create a private thread.', ephemeral: false }); }
async function askForDateTime(interaction, locationType) { await interaction.reply({ content: `📅 You chose ${locationType}. Please select a date from the calendar (coming soon).`, ephemeral: false }); }
async function setTradeCondition(interaction, condition) {
  const userId = interaction.user.id;
  const state = getUserState(userId);
  const { makeModel, odometer } = state.tempData;
  // Here you would generate the trade‑in estimate embed from `bydEmbeds.trade_in_estimate`
  await interaction.reply({ content: `✅ Your ${makeModel} with ${odometer} km is rated **${condition}**. Our estimated trade‑in value is R$ ${Math.floor(Math.random() * 50000 + 50000)}. A formal offer will be sent shortly.`, ephemeral: false });
  updateUserState(userId, { step: null, tempData: {} });
}
async function recommendAffordability(interaction) { await interaction.reply({ content: '💸 Based on affordability, I recommend the **BYD Dolphin** – great value and low running costs. Want a quote?' }); }
async function recommendRange(interaction) { await interaction.reply({ content: '⚡ For max range, the **BYD Seal** is your best choice. Would you like highway or rural driving tips?' }); }
async function recommendFamily(interaction) { await interaction.reply({ content: '👨‍👩‍👧‍👦 For family space and safety, check out the **BYD ATTO 3** or the **Tang**. Shall I send you the safety brochure?' }); }
async function recommendCity(interaction) { await interaction.reply({ content: '🏙️ City parking? The **BYD Dolphin** or **Seagull** are compact and packed with parking assist features. Want to see city range figures?' }); }
async function handleFleet(interaction) { await interaction.reply({ content: '🚛 A commercial sales advisor will contact you soon. Please share your fleet size and use case in this thread.' }); }