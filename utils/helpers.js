// utils/helpers.js
const crypto = require('crypto');

// ============================================
// CONSTANTS
// ============================================
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
const SNOWFLAKE_REGEX = /^\d{17,20}$/;
const WEBHOOK_REGEX = /\/webhooks\/(\d+)\/(.+)$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  if (!arr || !Array.isArray(arr)) return [];
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
 * @returns {*} - Selected item or null if no items
 */
function weightedRandom(items, weightKey = 'weight') {
  if (!items?.length) return null;
  
  // Validate weights
  let totalWeight = 0;
  for (const item of items) {
    const weight = item[weightKey];
    if (typeof weight !== 'number' || weight < 0) {
      throw new Error(`Invalid weight for item: ${JSON.stringify(item)}`);
    }
    totalWeight += weight;
  }
  
  if (totalWeight === 0) return getRandomItem(items);
  
  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    random -= (item[weightKey] || 0);
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
  if (size < 1) throw new Error('Chunk size must be at least 1');
  
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
  if (!arr || !Array.isArray(arr)) return [];
  return [...new Set(arr)];
}

/**
 * Check if two arrays have common elements.
 * @param {Array} arr1 - First array
 * @param {Array} arr2 - Second array
 * @returns {boolean} - True if arrays intersect
 */
function hasIntersection(arr1, arr2) {
  if (!arr1?.length || !arr2?.length) return false;
  const set1 = new Set(arr1);
  return arr2.some(item => set1.has(item));
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
  if (ms < 0) ms = 0;
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic.
 * @param {Function} fn - Async function to execute
 * @param {number} retries - Number of retries (default: 3)
 * @param {number} delay - Base delay in ms (default: 1000)
 * @param {Function} shouldRetry - Optional function to determine if retry should happen
 * @returns {Promise} - Result of the function
 */
async function retry(fn, retries = 3, delay = 1000, shouldRetry = null) {
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      
      // Check if we should retry based on custom logic
      if (shouldRetry && !shouldRetry(err)) {
        throw err;
      }
      
      if (attempt === retries) throw err;
      
      // Exponential backoff with jitter
      const backoffDelay = delay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await sleep(backoffDelay);
    }
  }
  
  throw lastError;
}

/**
 * Execute a function with timeout.
 * @param {Function} fn - Async function
 * @param {number} timeoutMs - Timeout in ms (default: 30000)
 * @returns {Promise} - Result or throws timeout error
 */
async function withTimeout(fn, timeoutMs = 30000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
  );
  return Promise.race([fn(), timeout]);
}

/**
 * Run tasks in parallel with a concurrency limit.
 * @param {Array} tasks - Array of async functions
 * @param {number} concurrency - Max concurrent tasks (default: 5)
 * @returns {Promise<Array>} - Array of results
 */
async function parallelLimit(tasks, concurrency = 5) {
  if (!tasks?.length) return [];
  if (concurrency < 1) throw new Error('Concurrency must be at least 1');
  
  const results = [];
  const executing = new Set();
  
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const promise = (async () => {
      try {
        return await task();
      } catch (err) {
        return { error: err };
      }
    })().then(result => {
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

/**
 * Wait for a condition to become true.
 * @param {Function} condition - Function that returns boolean or Promise<boolean>
 * @param {number} timeout - Maximum time to wait in ms
 * @param {number} interval - Check interval in ms
 * @returns {Promise<boolean>} - True if condition met, false if timeout
 */
async function waitFor(condition, timeout = 30000, interval = 1000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) return true;
    await sleep(interval);
  }
  
  return false;
}

// ============================================
// FORMATTING HELPERS
// ============================================

/**
 * Format a number as USD currency.
 * @param {number} amount - The amount to format
 * @param {boolean} showCents - Show cents (default: false)
 * @returns {string} - Formatted USD string
 */
function formatUSD(amount, showCents = false) {
  if (amount === null || amount === undefined) return '$0';
  if (typeof amount !== 'number') amount = parseFloat(amount);
  if (isNaN(amount)) return '$0';
  
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
  if (typeof num !== 'number') num = parseFloat(num);
  if (isNaN(num)) return '0';
  
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Format a date to a readable string.
 * @param {Date|string|number} date - Date to format
 * @param {string} format - 'short', 'long', 'relative', 'full', 'time', 'iso'
 * @returns {string} - Formatted date string
 */
function formatDate(date, format = 'short') {
  if (!date) return 'Unknown date';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid date';
  
  const formats = {
    short: () => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    long: () => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    full: () => d.toLocaleString('en-US', { 
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', 
      hour: 'numeric', minute: '2-digit' 
    }),
    relative: () => getRelativeTime(d),
    time: () => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    iso: () => d.toISOString(),
    discord: () => `<t:${Math.floor(d.getTime() / 1000)}:F>`,
  };
  
  return formats[format] ? formats[format]() : formats.short();
}

/**
 * Get relative time string (e.g., "2 hours ago").
 * @param {Date|string|number} date - Date to compare
 * @returns {string} - Relative time string
 */
function getRelativeTime(date) {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  
  if (diff < 0) return 'in the future';
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
}

/**
 * Format a duration in milliseconds to human readable string.
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - Formatted duration
 */
function formatDuration(ms) {
  if (typeof ms !== 'number' || ms < 0) return '0ms';
  if (ms < 1000) return `${ms}ms`;
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (seconds % 60 > 0 && parts.length < 3) parts.push(`${seconds % 60}s`);
  
  return parts.join(' ');
}

// ============================================
// STRING HELPERS
// ============================================

/**
 * Truncate a string to a maximum length, adding ellipsis if needed.
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length (default: 100)
 * @returns {string} - Truncated string
 */
function truncate(str, maxLength = 100) {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= maxLength) return str;
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
  if (!str || typeof str !== 'string') return '';
  return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

/**
 * Generate a random ID.
 * @param {number} length - Length of the ID (default: 8)
 * @returns {string} - Random ID
 */
function generateId(length = 8) {
  if (length < 1) return '';
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * Generate a short UUID (cuid-like).
 * @returns {string} - Short unique ID
 */
function generateShortId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${random}`;
}

/**
 * Slugify a string (for URLs).
 * @param {string} str - Input string
 * @returns {string} - Slugified string
 */
function slugify(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Strip emojis from a string.
 * @param {string} str - Input string
 * @returns {string} - String without emojis
 */
function stripEmojis(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(EMOJI_REGEX, '').trim();
}

/**
 * Count emojis in a string.
 * @param {string} str - Input string
 * @returns {number} - Number of emojis
 */
function countEmojis(str) {
  if (!str || typeof str !== 'string') return 0;
  const matches = str.match(EMOJI_REGEX);
  return matches ? matches.length : 0;
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
  if (!url || typeof url !== 'string') return false;
  return WEBHOOK_REGEX.test(url);
}

/**
 * Parse a Discord webhook URL into id and token.
 * @param {string} url - Webhook URL
 * @returns {Object|null} - Object with id and token, or null if invalid
 */
function parseWebhookUrl(url) {
  if (!isValidWebhookUrl(url)) return null;
  const match = url.match(WEBHOOK_REGEX);
  return { id: match[1], token: match[2] };
}

/**
 * Validate an email address.
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email);
}

/**
 * Validate a Discord snowflake ID.
 * @param {string} id - ID to validate
 * @returns {boolean} - True if valid snowflake
 */
function isValidSnowflake(id) {
  if (!id || typeof id !== 'string') return false;
  return SNOWFLAKE_REGEX.test(id);
}

/**
 * Check if a value is a valid number.
 * @param {*} value - Value to check
 * @returns {boolean} - True if valid number
 */
function isNumeric(value) {
  if (value === null || value === undefined) return false;
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
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof RegExp) return new RegExp(obj);
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Pick specific keys from an object.
 * @param {Object} obj - Source object
 * @param {Array} keys - Keys to pick
 * @returns {Object} - New object with only picked keys
 */
function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return {};
  const result = {};
  for (const key of keys) {
    if (obj.hasOwnProperty(key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific keys from an object.
 * @param {Object} obj - Source object
 * @param {Array} keys - Keys to omit
 * @returns {Object} - New object without omitted keys
 */
function omit(obj, keys) {
  if (!obj || typeof obj !== 'object') return {};
  const result = { ...obj };
  const keySet = new Set(keys);
  for (const key of keySet) {
    delete result[key];
  }
  return result;
}

/**
 * Check if object is empty.
 * @param {Object} obj - Object to check
 * @returns {boolean} - True if empty
 */
function isEmpty(obj) {
  if (!obj) return true;
  if (typeof obj !== 'object') return false;
  return Object.keys(obj).length === 0;
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
  if (typeof num !== 'number') num = 0;
  if (typeof min !== 'number') min = 0;
  if (typeof max !== 'number') max = Infinity;
  return Math.min(Math.max(num, min), max);
}

/**
 * Calculate percentage.
 * @param {number} value - Current value
 * @param {number} total - Total value
 * @param {number} decimals - Decimal places (default: 0)
 * @returns {number} - Percentage (0-100)
 */
function percentage(value, total, decimals = 0) {
  if (total === 0) return 0;
  if (typeof value !== 'number') value = 0;
  const percent = (value / total) * 100;
  const factor = Math.pow(10, decimals);
  return Math.round(percent * factor) / factor;
}

/**
 * Convert bytes to human readable size.
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Decimal places (default: 1)
 * @returns {string} - Formatted size
 */
function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 B';
  if (typeof bytes !== 'number') bytes = 0;
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
}

/**
 * Debounce a function.
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms (default: 300)
 * @returns {Function} - Debounced function
 */
function debounce(fn, delay = 300) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle a function.
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Time limit in ms (default: 300)
 * @returns {Function} - Throttled function
 */
function throttle(fn, limit = 300) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
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
  hasIntersection,
  
  // Async
  sleep,
  retry,
  withTimeout,
  parallelLimit,
  waitFor,
  
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
  generateShortId,
  slugify,
  stripEmojis,
  countEmojis,
  
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
  isEmpty,
  
  // Misc
  clamp,
  percentage,
  formatBytes,
  debounce,
  throttle,
};