// utils/helpers.js
/**
 * Get a random item from an array.
 * @param {Array} arr - The array to pick from
 * @returns {*} - Random item from the array, or null if array is empty
 */
function getRandomItem(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Sleep/delay for a specified number of milliseconds.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after the delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format a number as USD currency.
 * @param {number} amount - The amount to format
 * @returns {string} - Formatted USD string (e.g., "$1,234.56")
 */
function formatUSD(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Truncate a string to a maximum length, adding ellipsis if needed.
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated string
 */
function truncate(str, maxLength = 100) {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Check if a string is a valid Discord webhook URL.
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid webhook URL
 */
function isValidWebhookUrl(url) {
  const pattern = /\/webhooks\/(\d+)\/(.+)$/;
  return pattern.test(url);
}

/**
 * Parse a Discord webhook URL into id and token.
 * @param {string} url - Webhook URL
 * @returns {Object|null} - Object with id and token, or null if invalid
 */
function parseWebhookUrl(url) {
  const match = url.match(/\/webhooks\/(\d+)\/(.+)$/);
  if (!match) return null;
  return { id: match[1], token: match[2] };
}

/**
 * Capitalize the first letter of a string.
 * @param {string} str - Input string
 * @returns {string} - Capitalized string
 */
function capitalize(str) {
  if (!str || typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

module.exports = {
  getRandomItem,
  sleep,
  formatUSD,
  truncate,
  isValidWebhookUrl,
  parseWebhookUrl,
  capitalize,
};