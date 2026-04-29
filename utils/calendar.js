// utils/calendar.js
const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const logger = require('./logger');

/**
 * Generate a select menu with dates for the next 7 days.
 * @returns {Object} { embed, row }
 */
function getCalendarPicker() {
  logger.debug('Calendar picker generated');

  const dates = [];
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const formatted = date.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const label = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    dates.push({ label, value: formatted });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('calendar_date_select')
    .setPlaceholder('Choose a date for your test drive')
    .addOptions(dates.map(d => ({ label: d.label, value: d.value })));

  const embed = new EmbedBuilder()
    .setTitle('📅 Select a date')
    .setDescription('Choose a day for your test drive. After selecting, you will pick a time slot.')
    .setColor('#2ECC71');

  const row = new ActionRowBuilder().addComponents(selectMenu);
  return { embed, row };
}

/**
 * Generate time slot select menu (hourly slots).
 * @param {string} date - YYYY-MM-DD
 * @returns {Object} { embed, row }
 */
function getTimePicker(date) {
  logger.debug(`Time picker generated for ${date}`);

  const slots = ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`calendar_time_select_${date}`)
    .setPlaceholder('Choose a time slot')
    .addOptions(slots.map(t => ({ label: t, value: t })));

  const embed = new EmbedBuilder()
    .setTitle(`⏰ Pick a time for ${date}`)
    .setDescription('All times are in your local timezone (showroom operating hours).')
    .setColor('#3498DB');

  const row = new ActionRowBuilder().addComponents(selectMenu);
  return { embed, row };
}

module.exports = { getCalendarPicker, getTimePicker };