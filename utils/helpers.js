// utils/helpers.js
const crypto = require('crypto');

// ============================================
// ARRAY & RANDOM HELPERS
// ============================================

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
 * Get multiple random items from an array (no duplicates).
 * @param {Array} arr - The array to pick from
 * @param {number} count - Number of items to pick
 * @returns {Array} - Array of random items
 */
function getRandomItems(arr, count = 1) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return [];
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, arr.length));
}

/**
 * Shuffle an array (Fisher-Yates algorithm).
 * @param {Array} arr - The array to shuffle
 * @returns {Array} - New shuffled array
 */
function shuffle(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Pick a weighted random item from an array of objects with 'weight' property.
 * @param {Array} items - Array of objects with weight property
 * @param {string} weightKey - Key name for weight (default: 'weight')
 * @returns {*} - Selected item
 */
function weightedRandom(items, weightKey = 'weight') {
  if (!items?.length) return null;
  
  const totalWeight = items.reduce((sum, item) => sum + (item[weightKey] || 1), 0);
  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    random -= (item[weightKey] || 1);
    if (random <= 0) return item;
  }
  
  return items[items.length - 1];
}

/**
 * Split an array into chunks.
 * @param {Array} arr - The array to chunk
 * @param {number} size - Chunk size
 * @returns {Array} - Array of chunks
 */
function chunk(arr, size = 10) {
  if (!arr?.length) return [];
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Remove duplicates from an array.
 * @param {Array} arr - The array
 * @returns {Array} - Array with unique values
 */
function unique(arr) {
  return [...new Set(arr)];
}

// ============================================
// ASYNC HELPERS
// ============================================

/**
 * Sleep/delay for a specified number of milliseconds.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after the delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic.
 * @param {Function} fn - Async function to execute
 * @param {number} retries - Number of retries
 * @param {number} delay - Base delay in ms
 * @returns {Promise} - Result of the function
 */
async function retry(fn, retries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(delay * attempt);
    }
  }
}

/**
 * Execute a function with timeout.
 * @param {Function} fn - Async function
 * @param {number} timeoutMs - Timeout in ms
 * @returns {Promise} - Result or throws timeout error
 */
async function withTimeout(fn, timeoutMs = 30000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
  );
  return Promise.race([fn(), timeout]);
}

/**
 * Run tasks in parallel with a concurrency limit.
 * @param {Array} tasks - Array of async functions
 * @param {number} concurrency - Max concurrent tasks
 * @returns {Promise<Array>} - Array of results
 */
async function parallelLimit(tasks, concurrency = 5) {
  const results = [];
  const executing = new Set();
  
  for (const task of tasks) {
    const promise = task().then(result => {
      executing.delete(promise);
      return result;
    });
    executing.add(promise);
    results.push(promise);
    
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
}

// ============================================
// FORMATTING HELPERS
// ============================================

/**
 * Format a number as USD currency.
 * @param {number} amount - The amount to format
 * @param {boolean} showCents - Show cents
 * @returns {string} - Formatted USD string
 */
function formatUSD(amount, showCents = false) {
  if (amount === null || amount === undefined) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(amount);
}

/**
 * Format a number with commas.
 * @param {number} num - Number to format
 * @returns {string} - Formatted number string
 */
function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Format a date to a readable string.
 * @param {Date|string} date - Date to format
 * @param {string} format - 'short', 'long', 'relative', 'full'
 * @returns {string} - Formatted date string
 */
function formatDate(date, format = 'short') {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid date';
  
  switch (format) {
    case 'short':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    case 'long':
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    case 'full':
      return d.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    case 'relative':
      return getRelativeTime(d);
    case 'time':
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    default:
      return d.toLocaleDateString();
  }
}

/**
 * Get relative time string (e.g., "2 hours ago").
 * @param {Date|string} date - Date to compare
 * @returns {string} - Relative time string
 */
function getRelativeTime(date) {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date, 'short');
}

/**
 * Format a duration in milliseconds to human readable string.
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - Formatted duration
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ============================================
// STRING HELPERS
// ============================================

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
 * Capitalize the first letter of a string.
 * @param {string} str - Input string
 * @returns {string} - Capitalized string
 */
function capitalize(str) {
  if (!str || typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert a string to title case.
 * @param {string} str - Input string
 * @returns {string} - Title case string
 */
function titleCase(str) {
  if (!str) return '';
  return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

/**
 * Generate a random ID.
 * @param {number} length - Length of the ID
 * @returns {string} - Random ID
 */
function generateId(length = 8) {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * Slugify a string (for URLs).
 * @param {string} str - Input string
 * @returns {string} - Slugified string
 */
function slugify(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Strip emojis from a string.
 * @param {string} str - Input string
 * @returns {string} - String without emojis
 */
function stripEmojis(str) {
  if (!str) return '';
  return str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Check if a string is a valid Discord webhook URL.
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid webhook URL
 */
function isValidWebhookUrl(url) {
  if (!url) return false;
  return /\/webhooks\/(\d+)\/(.+)$/.test(url);
}

/**
 * Parse a Discord webhook URL into id and token.
 * @param {string} url - Webhook URL
 * @returns {Object|null} - Object with id and token
 */
function parseWebhookUrl(url) {
  const match = url.match(/\/webhooks\/(\d+)\/(.+)$/);
  if (!match) return null;
  return { id: match[1], token: match[2] };
}

/**
 * Validate an email address.
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate a Discord snowflake ID.
 * @param {string} id - ID to validate
 * @returns {boolean} - True if valid snowflake
 */
function isValidSnowflake(id) {
  return /^\d{17,20}$/.test(id);
}

/**
 * Check if a value is a valid number.
 * @param {*} value - Value to check
 * @returns {boolean} - True if valid number
 */
function isNumeric(value) {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

// ============================================
// OBJECT HELPERS
// ============================================

/**
 * Deep clone an object.
 * @param {Object} obj - Object to clone
 * @returns {Object} - Cloned object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Pick specific keys from an object.
 * @param {Object} obj - Source object
 * @param {Array} keys - Keys to pick
 * @returns {Object} - New object with only picked keys
 */
function pick(obj, keys) {
  return keys.reduce((result, key) => {
    if (obj.hasOwnProperty(key)) result[key] = obj[key];
    return result;
  }, {});
}

/**
 * Omit specific keys from an object.
 * @param {Object} obj - Source object
 * @param {Array} keys - Keys to omit
 * @returns {Object} - New object without omitted keys
 */
function omit(obj, keys) {
  const result = { ...obj };
  keys.forEach(key => delete result[key]);
  return result;
}

// ============================================
// MISC HELPERS
// ============================================

/**
 * Clamp a number between min and max.
 * @param {number} num - Number to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Clamped number
 */
function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

/**
 * Calculate percentage.
 * @param {number} value - Current value
 * @param {number} total - Total value
 * @returns {number} - Percentage (0-100)
 */
function percentage(value, total) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Convert bytes to human readable size.
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Debounce a function.
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} - Debounced function
 */
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle a function.
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Time limit in ms
 * @returns {Function} - Throttled function
 */
function throttle(fn, limit = 300) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Array & Random
  getRandomItem,
  getRandomItems,
  shuffle,
  weightedRandom,
  chunk,
  unique,
  
  // Async
  sleep,
  retry,
  withTimeout,
  parallelLimit,
  
  // Formatting
  formatUSD,
  formatNumber,
  formatDate,
  getRelativeTime,
  formatDuration,
  
  // String
  truncate,
  capitalize,
  titleCase,
  generateId,
  slugify,
  stripEmojis,
  
  // Validation
  isValidWebhookUrl,
  parseWebhookUrl,
  isValidEmail,
  isValidSnowflake,
  isNumeric,
  
  // Object
  deepClone,
  pick,
  omit,
  
  // Misc
  clamp,
  percentage,
  formatBytes,
  debounce,
  throttle,
};