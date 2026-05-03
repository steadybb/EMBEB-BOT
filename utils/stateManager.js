// utils/stateManager.js
const { upsertLead, getLead, getCollection } = require('./database');
const logger = require('./logger');
const crypto = require('crypto');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  cacheTTL: parseInt(process.env.STATE_CACHE_TTL, 10) || 60000, // 1 minute default
  maxCacheSize: parseInt(process.env.STATE_MAX_CACHE, 10) || 1000, // Max cached users
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 30 * 60 * 1000, // 30 min session
  leadScoreDecay: 0.95, // Score decay factor per day (5% decay)
};

// ============================================
// CACHE MANAGEMENT
// ============================================
const cache = new Map();

/**
 * LRU-like cache eviction
 */
function evictCache() {
  if (cache.size > CONFIG.maxCacheSize) {
    // Remove oldest 10% of entries
    const entries = [...cache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = Math.ceil(CONFIG.maxCacheSize * 0.1);
    
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      cache.delete(entries[i][0]);
    }
    logger.debug(`Cache evicted: removed ${toRemove} entries`);
  }
}

/**
 * Get from cache if valid
 */
function getFromCache(userId) {
  const cached = cache.get(userId);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp < CONFIG.cacheTTL) {
    cached.hitCount = (cached.hitCount || 0) + 1;
    return cached.data;
  }
  
  // Expired
  cache.delete(userId);
  return null;
}

/**
 * Set cache entry
 */
function setCache(userId, data) {
  cache.set(userId, {
    data,
    timestamp: Date.now(),
    hitCount: 0,
  });
  evictCache();
}

// ============================================
// LEAD SCORING
// ============================================

const leadScoreActions = {
  'model_selected': 15,
  'quote_viewed': 25,
  'test_drive_booked': 50,
  'trade_in_started': 20,
  'trade_in_completed': 30,
  'brochure_requested': 10,
  'region_selected': 5,
  'return_visit': 3,
  'button_click': 2,
  'dm_received': 5,
  'follow_up_responded': 15,
};

/**
 * Calculate lead score based on actions
 */
function calculateLeadScore(currentScore, action) {
  const points = leadScoreActions[action] || 0;
  return currentScore + points;
}

/**
 * Apply score decay for inactivity
 */
function applyScoreDecay(lastInteraction, currentScore) {
  if (!lastInteraction) return currentScore;
  
  const daysSinceLastInteraction = (Date.now() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceLastInteraction > 1) {
    const decayFactor = Math.pow(CONFIG.leadScoreDecay, daysSinceLastInteraction);
    return Math.floor(currentScore * decayFactor);
  }
  return currentScore;
}

/**
 * Get lead stage based on score
 */
function getLeadStage(score) {
  if (score >= 100) return 'HOT';
  if (score >= 50) return 'WARM';
  if (score >= 20) return 'INTERESTED';
  if (score >= 5) return 'AWARE';
  return 'COLD';
}

// ============================================
// ANALYTICS & TRACKING
// ============================================

/**
 * Track an interaction event for analytics
 */
async function trackInteraction(userId, event, metadata = {}) {
  try {
    const collection = await getCollection('interactions');
    await collection.insertOne({
      userId,
      event,
      metadata,
      timestamp: new Date(),
    });
    logger.debug(`📊 Tracked: ${event} for ${userId}`);
  } catch (err) {
    logger.debug('Analytics tracking failed (non-critical):', err.message);
  }
}

/**
 * Get user interaction history
 */
async function getInteractionHistory(userId, limit = 10) {
  try {
    const collection = await getCollection('interactions');
    return await collection
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  } catch (err) {
    logger.error('Failed to get interaction history:', err);
    return [];
  }
}

/**
 * Get interaction statistics
 */
async function getInteractionStats(guildId = null) {
  try {
    const collection = await getCollection('interactions');
    const match = guildId ? { 'metadata.guildId': guildId } : {};
    
    const stats = await collection.aggregate([
      { $match: match },
      { $group: {
        _id: '$event',
        count: { $sum: 1 },
        lastOccurrence: { $max: '$timestamp' }
      }},
      { $sort: { count: -1 } }
    ]).toArray();
    
    return stats;
  } catch (err) {
    logger.error('Failed to get interaction stats:', err);
    return [];
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Check if user has an active session
 */
function isSessionActive(state) {
  if (!state?.session?.startedAt) return false;
  const sessionAge = Date.now() - new Date(state.session.startedAt).getTime();
  return sessionAge < CONFIG.sessionTimeout;
}

/**
 * Start or resume a session
 */
function updateSession(state) {
  if (!state.session) {
    state.session = {
      id: generateSessionId(),
      startedAt: new Date(),
      pageViews: 0,
      actions: [],
    };
  }
  
  state.session.lastActive = new Date();
  state.session.pageViews = (state.session.pageViews || 0) + 1;
  
  return state;
}

// ============================================
// CORE STATE FUNCTIONS
// ============================================

/**
 * Get the current state object for a user
 */
async function getUserState(userId, username = null) {
  // Check cache first
  const cached = getFromCache(userId);
  if (cached) return cached;

  let dbState = await getLead(userId);
  
  if (!dbState) {
    // Create default state
    dbState = {
      selectedModel: null,
      step: null,
      tempData: {},
      leadScore: 0,
      leadStage: 'COLD',
      session: null,
      interactions: 0,
      lastInteraction: new Date(),
      createdAt: new Date(),
    };
    
    if (username) {
      try {
        await upsertLead(userId, username, {
          selectedModel: dbState.selectedModel,
          step: dbState.step,
          tempData: dbState.tempData,
          leadScore: dbState.leadScore,
          leadStage: dbState.leadStage,
          lastInteraction: dbState.lastInteraction,
          interactions: dbState.interactions,
        });
        logger.debug(`Created new lead record for ${username} (${userId})`);
      } catch (err) {
        logger.error('Failed to create lead record:', err);
      }
    }
  } else {
    // Normalize state
    if (!dbState.tempData) dbState.tempData = {};
    if (!dbState.leadScore) dbState.leadScore = 0;
    if (!dbState.leadStage) dbState.leadStage = 'COLD';
    if (!dbState.interactions) dbState.interactions = 0;
    
    // Apply score decay
    dbState.leadScore = applyScoreDecay(dbState.lastInteraction, dbState.leadScore);
    dbState.leadStage = getLeadStage(dbState.leadScore);
  }

  const state = { ...dbState };
  setCache(userId, state);
  return state;
}

/**
 * Update a user's state
 */
async function updateUserState(userId, updates, username = null) {
  const current = await getUserState(userId, username);
  
  const newState = {
    selectedModel: updates.selectedModel !== undefined ? updates.selectedModel : current.selectedModel,
    step: updates.step !== undefined ? updates.step : current.step,
    tempData: updates.tempData !== undefined ? updates.tempData : current.tempData,
    leadScore: updates.leadScore !== undefined ? updates.leadScore : current.leadScore,
    leadStage: updates.leadStage !== undefined ? updates.leadStage : current.leadStage,
    session: updates.session !== undefined ? updates.session : current.session,
    interactions: (current.interactions || 0) + 1,
    lastInteraction: new Date(),
  };

  // Update session
  updateSession(newState);

  // Calculate lead score based on step change
  if (updates.step && updates.step !== current.step) {
    newState.leadScore = calculateLeadScore(newState.leadScore, updates.step);
    newState.leadStage = getLeadStage(newState.leadScore);
  }

  // Save to database
  try {
    await upsertLead(userId, username || 'unknown', {
      selectedModel: newState.selectedModel,
      step: newState.step,
      tempData: newState.tempData,
      leadScore: newState.leadScore,
      leadStage: newState.leadStage,
      lastInteraction: newState.lastInteraction,
      interactions: newState.interactions,
      sessionId: newState.session?.id,
    });
  } catch (err) {
    logger.error('Failed to update lead in database:', err);
  }

  // Track interaction
  await trackInteraction(userId, updates.step || 'state_update', {
    model: newState.selectedModel,
    leadScore: newState.leadScore,
    leadStage: newState.leadStage,
  });

  // Update cache
  setCache(userId, newState);
  return newState;
}

/**
 * Add lead score points for an action
 */
async function addLeadScore(userId, action, username = null) {
  const current = await getUserState(userId, username);
  const newScore = calculateLeadScore(current.leadScore || 0, action);
  const newStage = getLeadStage(newScore);
  
  return updateUserState(userId, {
    leadScore: newScore,
    leadStage: newStage,
  }, username);
}

/**
 * Record a specific interaction event
 */
async function recordInteraction(userId, event, metadata = {}, username = null) {
  await trackInteraction(userId, event, metadata);
  
  // Also update the state interaction count
  const current = await getUserState(userId, username);
  return updateUserState(userId, {
    interactions: (current.interactions || 0) + 1,
  }, username);
}

/**
 * Delete a user's state
 */
async function clearUserState(userId, deleteFromDb = false) {
  cache.delete(userId);
  
  if (deleteFromDb) {
    try {
      const collection = await getCollection('leads');
      await collection.deleteOne({ userId });
      logger.info(`Lead record deleted for ${userId}`);
    } catch (err) {
      logger.error('Failed to delete lead from database:', err);
    }
  }
}

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Get all active states from cache
 */
function getAllStates() {
  const states = {};
  for (const [userId, cached] of cache) {
    if (Date.now() - cached.timestamp < CONFIG.cacheTTL) {
      states[userId] = cached.data;
    }
  }
  return states;
}

/**
 * Get all leads by stage
 */
async function getLeadsByStage(guildId = null, stage = null) {
  try {
    const collection = await getCollection('leads');
    const query = {};
    if (guildId) query.guildId = guildId;
    if (stage) query.leadStage = stage;
    
    return await collection.find(query).sort({ leadScore: -1 }).toArray();
  } catch (err) {
    logger.error('Failed to get leads by stage:', err);
    return [];
  }
}

/**
 * Get top leads (highest scores)
 */
async function getTopLeads(guildId = null, limit = 10) {
  try {
    const collection = await getCollection('leads');
    const query = guildId ? { guildId } : {};
    
    return await collection
      .find(query)
      .sort({ leadScore: -1 })
      .limit(limit)
      .toArray();
  } catch (err) {
    logger.error('Failed to get top leads:', err);
    return [];
  }
}

/**
 * Get lead statistics for a guild
 */
async function getLeadStats(guildId = null) {
  try {
    const collection = await getCollection('leads');
    const match = guildId ? { guildId } : {};
    
    const stats = await collection.aggregate([
      { $match: match },
      { $group: {
        _id: '$leadStage',
        count: { $sum: 1 },
        avgScore: { $avg: '$leadScore' },
      }}
    ]).toArray();
    
    const total = stats.reduce((sum, s) => sum + s.count, 0);
    
    return {
      total,
      byStage: stats,
      topLeads: await getTopLeads(guildId, 5),
    };
  } catch (err) {
    logger.error('Failed to get lead stats:', err);
    return { total: 0, byStage: [], topLeads: [] };
  }
}

// ============================================
// CLEANUP
// ============================================

// Periodic cache cleanup (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [userId, cached] of cache) {
    if (now - cached.timestamp > CONFIG.cacheTTL * 2) {
      cache.delete(userId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug(`Cache cleanup: removed ${cleaned} expired entries`);
  }
}, 5 * 60 * 1000);

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Core functions
  getUserState,
  updateUserState,
  clearUserState,
  getAllStates,
  
  // Lead scoring
  addLeadScore,
  getLeadStage,
  leadScoreActions,
  
  // Analytics
  trackInteraction,
  recordInteraction,
  getInteractionHistory,
  getInteractionStats,
  
  // Bulk operations
  getLeadsByStage,
  getTopLeads,
  getLeadStats,
  
  // Session
  generateSessionId,
  isSessionActive,
};