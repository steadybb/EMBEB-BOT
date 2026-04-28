// utils/stateManager.js
const userStates = new Map();

/**
 * Get the current state object for a user.
 * If none exists, creates a default one.
 * @param {string} userId - Discord user ID
 * @returns {object} user state
 */
function getUserState(userId) {
  if (!userStates.has(userId)) {
    userStates.set(userId, {
      step: null,               // current flow step: 'awaiting_region', 'awaiting_odometer', etc.
      selectedModel: null,      // 'Dolphin', 'Seal', 'ATTO 3', etc.
      tempData: {},             // temporary storage (e.g., { makeModel, odometer })
      lastInteraction: Date.now(),
    });
  }
  return userStates.get(userId);
}

/**
 * Update a user's state with new values.
 * @param {string} userId - Discord user ID
 * @param {object} updates - partial state object
 * @returns {object} updated state
 */
function updateUserState(userId, updates) {
  const state = getUserState(userId);
  Object.assign(state, updates);
  state.lastInteraction = Date.now();
  userStates.set(userId, state);
  return state;
}

/**
 * Delete a user's state (e.g., after completing a flow or leaving).
 * @param {string} userId - Discord user ID
 */
function clearUserState(userId) {
  userStates.delete(userId);
}

/**
 * Get all states (for cleanup or analytics).
 * @returns {Map} full state map
 */
function getAllStates() {
  return userStates;
}

module.exports = {
  getUserState,
  updateUserState,
  clearUserState,
  getAllStates,
};