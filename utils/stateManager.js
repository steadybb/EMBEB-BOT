// utils/stateManager.js
const { upsertLead, getLead } = require('./database');
const logger = require('./logger');

// Optional: in‑memory cache to reduce DB calls (TTL 1 minute)
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

/**
 * Get the current state object for a user.
 * If none exists, creates a default one in the database.
 * @param {string} userId - Discord user ID
 * @param {string} username - Discord username (required for new records)
 * @returns {Promise<object>} user state
 */
async function getUserState(userId, username = null) {
  // Check cache first
  const cached = cache.get(userId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  let dbState = await getLead(userId);
  if (!dbState) {
    // Create default state
    dbState = {
      selectedModel: null,
      step: null,
      tempData: {},
      lastInteraction: new Date(),
    };
    if (username) {
      await upsertLead(userId, username, {
        selectedModel: dbState.selectedModel,
        step: dbState.step,
        tempData: dbState.tempData,
        lastInteraction: dbState.lastInteraction,
      });
      logger.debug(`Created new lead record for ${username} (${userId})`);
    }
  } else {
    // Ensure tempData is an object
    if (!dbState.tempData) dbState.tempData = {};
  }

  const state = { ...dbState };
  cache.set(userId, { data: state, timestamp: Date.now() });
  return state;
}

/**
 * Update a user's state with new values.
 * @param {string} userId - Discord user ID
 * @param {object} updates - partial state object
 * @param {string} username - Discord username (required if lead might not exist)
 * @returns {Promise<object>} updated state
 */
async function updateUserState(userId, updates, username = null) {
  const current = await getUserState(userId, username);
  const newState = {
    selectedModel: updates.selectedModel !== undefined ? updates.selectedModel : current.selectedModel,
    step: updates.step !== undefined ? updates.step : current.step,
    tempData: updates.tempData !== undefined ? updates.tempData : current.tempData,
    lastInteraction: new Date(),
  };

  await upsertLead(userId, username || 'unknown', {
    selectedModel: newState.selectedModel,
    step: newState.step,
    tempData: newState.tempData,
    lastInteraction: newState.lastInteraction,
  });

  // Update cache
  cache.set(userId, { data: newState, timestamp: Date.now() });
  return newState;
}

/**
 * Delete a user's state (optionally from DB as well).
 * @param {string} userId - Discord user ID
 * @param {boolean} deleteFromDb - If true, removes the lead record (default false)
 */
async function clearUserState(userId, deleteFromDb = false) {
  cache.delete(userId);
  if (deleteFromDb) {
    // Optional: you could implement a deleteLead function in database.js
    logger.warn(`clearUserState called with deleteFromDb=true for ${userId} – no deletion implemented`);
  }
}

/**
 * Get all states (from cache only, not DB – for performance).
 * @returns {Map} full state map (cache)
 */
function getAllStates() {
  return cache;
}

module.exports = {
  getUserState,
  updateUserState,
  clearUserState,
  getAllStates,
};