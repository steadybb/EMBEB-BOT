// utils/calendar.js
const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const logger = require('./logger');

/**
 * Generate a select menu with dates for the next 7 days.
 * Skips Sundays (showroom closed) and highlights weekends.
 * @returns {Object} { embed, row }
 */
function getCalendarPicker() {
  logger.debug('Calendar picker generated');

  const dates = [];
  const today = new Date();
  let daysAdded = 0;
  let offset = 0;

  // Get next 7 available days (skip Sundays)
  while (daysAdded < 7) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    const dayOfWeek = date.getDay();
    
    // Skip Sundays (0 = Sunday)
    if (dayOfWeek !== 0) {
      const formatted = date.toLocaleDateString('en-CA'); // YYYY-MM-DD
      const isWeekend = dayOfWeek === 6; // Saturday
      const label = date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
      const emoji = isWeekend ? '🌟 ' : '';
      dates.push({ 
        label: `${emoji}${label}${isWeekend ? ' (Weekend)' : ''}`, 
        value: formatted 
      });
      daysAdded++;
    }
    offset++;
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('calendar_date_select')
    .setPlaceholder('Choose a date for your test drive')
    .addOptions(dates.map(d => ({ 
      label: d.label.substring(0, 25), // Discord limit
      value: d.value 
    })));

  const embed = new EmbedBuilder()
    .setTitle('📅 Select a Test Drive Date')
    .setDescription(
      'Choose a day for your BYD test drive.\n\n' +
      '🕐 **Showroom Hours:**\n' +
      '• Mon-Fri: 9 AM - 6 PM\n' +
      '• Saturday: 10 AM - 4 PM\n' +
      '• Sunday: Closed\n\n' +
      'After selecting a date, you\'ll pick a time slot.'
    )
    .setColor('#2ECC71')
    .setFooter({ text: '⚡ BYD Blade Battery • Flexible scheduling available' });

  const row = new ActionRowBuilder().addComponents(selectMenu);
  return { embed, row };
}

/**
 * Generate time slot select menu with appropriate slots for the day.
 * @param {string} date - YYYY-MM-DD
 * @returns {Object} { embed, row }
 */
function getTimePicker(date) {
  logger.debug(`Time picker generated for ${date}`);

  const dateObj = new Date(date + 'T00:00:00');
  const dayOfWeek = dateObj.getDay();
  const isWeekend = dayOfWeek === 6; // Saturday

  // Different time slots for weekdays vs weekends
  const weekdaySlots = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  const weekendSlots = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
  const slots = isWeekend ? weekendSlots : weekdaySlots;

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`calendar_time_select_${date}`)
    .setPlaceholder(`Choose a time slot for ${date}`)
    .addOptions(slots.map(t => ({ 
      label: formatTimeLabel(t), 
      value: t 
    })));

  const formattedDate = dateObj.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  const embed = new EmbedBuilder()
    .setTitle(`⏰ Select a Time for ${formattedDate}`)
    .setDescription(
      `Choose your preferred time slot.\n\n` +
      `📍 **Location:** BYD Showroom or Home Test Drive\n` +
      `⏱️ **Duration:** Approximately 45-60 minutes\n` +
      `👤 **Accompanied:** BYD specialist will guide you\n\n` +
      `*All times are in your local timezone.*`
    )
    .setColor('#3498DB')
    .setFooter({ text: '⚡ Flexible rescheduling available' });

  const row = new ActionRowBuilder().addComponents(selectMenu);
  return { embed, row };
}

/**
 * Format 24h time to 12h AM/PM format.
 * @param {string} time24 - Time in HH:MM format
 * @returns {string} Formatted time label
 */
function formatTimeLabel(time24) {
  const [hours, minutes] = time24.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Get available dates for a specific month.
 * @param {number} month - Month (0-11)
 * @param {number} year - Year
 * @returns {Array} Array of available dates
 */
function getAvailableDatesForMonth(month, year) {
  const dates = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    
    // Exclude Sundays
    if (dayOfWeek !== 0) {
      dates.push({
        date: date.toLocaleDateString('en-CA'),
        label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        isWeekend: dayOfWeek === 6,
      });
    }
  }
  
  return dates;
}

/**
 * Check if a specific date/time slot is available.
 * @param {string} date - YYYY-MM-DD
 * @param {string} time - HH:MM
 * @returns {boolean} Always returns true (placeholder for DB check)
 */
function isSlotAvailable(date, time) {
  // TODO: Check database for existing bookings
  // For now, all slots are available
  return true;
}

module.exports = { 
  getCalendarPicker, 
  getTimePicker, 
  formatTimeLabel,
  getAvailableDatesForMonth,
  isSlotAvailable,
};