// utils/stateManager.js
const { upsertLead, getLead, pool } = require('./database');
const logger = require('./logger');
const crypto = require('crypto');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  cacheTTL: parseInt(process.env.STATE_CACHE_TTL, 10) || 60000, // 1 minute
  maxCacheSize: parseInt(process.env.STATE_MAX_CACHE, 10) || 1000,
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 30 * 60 * 1000, // 30 minutes
  leadScoreDecay: parseFloat(process.env.LEAD_SCORE_DECAY) || 0.95,
  cleanupInterval: parseInt(process.env.STATE_CLEANUP_INTERVAL, 10) || 5 * 60 * 1000, // 5 minutes
  enableAnalytics: process.env.ENABLE_ANALYTICS !== 'false',
  enableScoreDecay: process.env.ENABLE_SCORE_DECAY !== 'false',
};

// ============================================
// CACHE MANAGEMENT
// ============================================
const cache = new Map();
let cacheHits = 0;
let cacheMisses = 0;

function evictCache() {
  if (cache.size <= CONFIG.maxCacheSize) return;
  
  const entries = [...cache.entries()]
    .sort((a, b) => a[1].timestamp - b[1].timestamp);
  const toRemove = Math.ceil(CONFIG.maxCacheSize * 0.2); // Remove 20% of old entries
  
  for (let i = 0; i < toRemove && i < entries.length; i++) {
    cache.delete(entries[i][0]);
  }
  logger.debug(`Cache evicted: removed ${toRemove} entries (size: ${cache.size})`);
}

function getFromCache(userId) {
  const cached = cache.get(userId);
  if (!cached) {
    cacheMisses++;
    return null;
  }
  
  if (Date.now() - cached.timestamp < CONFIG.cacheTTL) {
    cached.hitCount = (cached.hitCount || 0) + 1;
    cached.lastAccess = Date.now();
    cacheHits++;
    return { ...cached.data }; // Return copy to prevent mutation
  }
  
  cache.delete(userId);
  cacheMisses++;
  return null;
}

function setCache(userId, data) {
  // Don't cache if data is invalid
  if (!data || typeof data !== 'object') {
    logger.warn(`Attempted to cache invalid data for ${userId}`);
    return;
  }
  
  cache.set(userId, { 
    data: { ...data }, // Store copy
    timestamp: Date.now(), 
    hitCount: 0,
    lastAccess: Date.now()
  });
  evictCache();
}

function getCacheStats() {
  const totalRequests = cacheHits + cacheMisses;
  return {
    size: cache.size,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: totalRequests > 0 ? `${((cacheHits / totalRequests) * 100).toFixed(1)}%` : 'N/A',
    maxSize: CONFIG.maxCacheSize,
    ttl: CONFIG.cacheTTL,
  };
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
  'state_update': 1,
  'interaction': 1,
};

function calculateLeadScore(currentScore, action) {
  const points = leadScoreActions[action] || 0;
  const newScore = (currentScore || 0) + points;
  
  // Cap at 999 to prevent overflow
  return Math.min(999, newScore);
}

function applyScoreDecay(lastInteraction, currentScore) {
  if (!CONFIG.enableScoreDecay) return currentScore;
  if (!lastInteraction) return currentScore;
  
  const daysSinceLastInteraction = (Date.now() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSinceLastInteraction > 1) {
    const decayFactor = Math.pow(CONFIG.leadScoreDecay, daysSinceLastInteraction);
    const newScore = Math.floor(currentScore * decayFactor);
    
    if (newScore !== currentScore) {
      logger.debug(`Score decay applied: ${currentScore} -> ${newScore} (${daysSinceLastInteraction.toFixed(1)} days inactive)`);
    }
    
    return Math.max(0, newScore); // Never go below 0
  }
  
  return currentScore;
}

function getLeadStage(score) {
  if (score >= 100) return 'HOT';
  if (score >= 50) return 'WARM';
  if (score >= 20) return 'INTERESTED';
  if (score >= 5) return 'AWARE';
  return 'COLD';
}

function getLeadStagePriority(stage) {
  const priorities = {
    'HOT': 4,
    'WARM': 3,
    'INTERESTED': 2,
    'AWARE': 1,
    'COLD': 0
  };
  return priorities[stage] || 0;
}

// ============================================
// ANALYTICS & TRACKING (PostgreSQL)
// ============================================

async function trackInteraction(userId, event, metadata = {}) {
  if (!CONFIG.enableAnalytics) return;
  
  try {
    // Sanitize metadata to prevent JSON overflow
    const safeMetadata = { ...metadata };
    if (safeMetadata.largeField) delete safeMetadata.largeField;
    
    await pool.query(
      `INSERT INTO interactions (user_id, event, metadata, timestamp) 
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT DO NOTHING`,
      [userId, event, JSON.stringify(safeMetadata)]
    );
    logger.debug(`📊 Tracked: ${event} for ${userId}`);
  } catch (err) {
    // Non-critical error - don't throw
    logger.debug('Analytics tracking failed (non-critical):', err.message);
  }
}

async function getInteractionHistory(userId, limit = 10) {
  try {
    const res = await pool.query(
      `SELECT event, metadata, timestamp 
       FROM interactions 
       WHERE user_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [userId, limit]
    );
    return res.rows;
  } catch (err) {
    logger.error('Failed to get interaction history:', err);
    return [];
  }
}

async function getInteractionStats(guildId = null, days = 7) {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    let query = `SELECT event, COUNT(*) as count 
                 FROM interactions 
                 WHERE timestamp > $1`;
    const params = [cutoff];
    
    if (guildId) { 
      query += ' AND metadata->>\'guildId\' = $2'; 
      params.push(guildId); 
    }
    
    query += ' GROUP BY event ORDER BY count DESC LIMIT 50'; // Limit to top 50 events
    
    const res = await pool.query(query, params);
    return res.rows;
  } catch (err) {
    logger.error('Failed to get interaction stats:', err);
    return [];
  }
}

async function getDailyInteractionStats(days = 7) {
  try {
    const res = await pool.query(
      `SELECT DATE(timestamp) as date, COUNT(*) as count
       FROM interactions
       WHERE timestamp > NOW() - INTERVAL '${days} days'
       GROUP BY DATE(timestamp)
       ORDER BY date DESC`
    );
    return res.rows;
  } catch (err) {
    logger.error('Failed to get daily stats:', err);
    return [];
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

function isSessionActive(state) {
  if (!state?.session?.startedAt) return false;
  const sessionAge = Date.now() - new Date(state.session.startedAt).getTime();
  return sessionAge < CONFIG.sessionTimeout;
}

function updateSession(state) {
  if (!state.session) {
    state.session = {
      id: generateSessionId(),
      startedAt: new Date().toISOString(),
      pageViews: 0,
      actions: [],
      lastActive: new Date().toISOString(),
    };
  } else {
    state.session.lastActive = new Date().toISOString();
  }
  
  state.session.pageViews = (state.session.pageViews || 0) + 1;
  
  // Limit actions array size
  if (state.session.actions && state.session.actions.length > 100) {
    state.session.actions = state.session.actions.slice(-50);
  }
  
  return state;
}

function getSessionDuration(state) {
  if (!state?.session?.startedAt) return 0;
  return Date.now() - new Date(state.session.startedAt).getTime();
}

// ============================================
// CORE STATE FUNCTIONS
// ============================================

async function getUserState(userId, username = null) {
  if (!userId) {
    logger.error('getUserState called without userId');
    return null;
  }
  
  const cached = getFromCache(userId);
  if (cached) return cached;

  let dbState = await getLead(userId);
  
  if (!dbState) {
    // Initialize new state
    dbState = {
      selectedModel: null,
      step: null,
      tempData: {},
      leadScore: 0,
      leadStage: 'COLD',
      session: null,
      interactions: 0,
      lastInteraction: new Date().toISOString(),
      createdAt: new Date().toISOString(),
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
        // Continue without DB persistence
      }
    }
  } else {
    // Ensure all required fields exist
    if (!dbState.tempData) dbState.tempData = {};
    if (typeof dbState.leadScore !== 'number') dbState.leadScore = 0;
    if (!dbState.leadStage) dbState.leadStage = getLeadStage(dbState.leadScore);
    if (typeof dbState.interactions !== 'number') dbState.interactions = 0;
    if (!dbState.lastInteraction) dbState.lastInteraction = new Date().toISOString();
    if (!dbState.createdAt) dbState.createdAt = new Date().toISOString();
    
    // Apply score decay
    dbState.leadScore = applyScoreDecay(dbState.lastInteraction, dbState.leadScore);
    dbState.leadStage = getLeadStage(dbState.leadScore);
  }

  const state = { ...dbState };
  setCache(userId, state);
  return state;
}

async function updateUserState(userId, updates, username = null) {
  if (!userId) {
    logger.error('updateUserState called without userId');
    return null;
  }
  
  const current = await getUserState(userId, username);
  if (!current) return null;
  
  const newState = {
    selectedModel: updates.selectedModel !== undefined ? updates.selectedModel : current.selectedModel,
    step: updates.step !== undefined ? updates.step : current.step,
    tempData: updates.tempData !== undefined ? { ...current.tempData, ...updates.tempData } : { ...current.tempData },
    leadScore: updates.leadScore !== undefined ? updates.leadScore : current.leadScore,
    leadStage: updates.leadStage !== undefined ? updates.leadStage : current.leadStage,
    session: updates.session !== undefined ? updates.session : current.session,
    interactions: (current.interactions || 0) + 1,
    lastInteraction: new Date().toISOString(),
    createdAt: current.createdAt,
  };

  // Update session
  updateSession(newState);

  // Apply score changes based on step
  if (updates.step && updates.step !== current.step) {
    newState.leadScore = calculateLeadScore(newState.leadScore, updates.step);
    newState.leadStage = getLeadStage(newState.leadScore);
  }

  // Update database
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
      sessionStartedAt: newState.session?.startedAt,
    });
  } catch (err) {
    logger.error('Failed to update lead in database:', err);
    // Continue without DB persistence - cache still updated
  }

  // Track interaction (non-blocking)
  await trackInteraction(userId, updates.step || 'state_update', {
    model: newState.selectedModel,
    leadScore: newState.leadScore,
    leadStage: newState.leadStage,
    previousStep: current.step,
  });

  // Update cache
  setCache(userId, newState);
  return newState;
}

async function addLeadScore(userId, action, username = null) {
  if (!userId || !action) {
    logger.warn('addLeadScore called with invalid parameters');
    return null;
  }
  
  const current = await getUserState(userId, username);
  if (!current) return null;
  
  const newScore = calculateLeadScore(current.leadScore || 0, action);
  const newStage = getLeadStage(newScore);
  
  logger.debug(`Lead score updated: ${userId} +${leadScoreActions[action] || 0} (${current.leadScore} -> ${newScore})`);
  
  return updateUserState(userId, { leadScore: newScore, leadStage: newStage }, username);
}

async function recordInteraction(userId, event, metadata = {}, username = null) {
  await trackInteraction(userId, event, metadata);
  const current = await getUserState(userId, username);
  if (!current) return null;
  
  return updateUserState(userId, { interactions: (current.interactions || 0) + 1 }, username);
}

async function clearUserState(userId, deleteFromDb = false) {
  if (!userId) return;
  
  cache.delete(userId);
  
  if (deleteFromDb) {
    try {
      await pool.query('DELETE FROM leads WHERE user_id = $1', [userId]);
      if (CONFIG.enableAnalytics) {
        await pool.query('DELETE FROM interactions WHERE user_id = $1', [userId]);
      }
      logger.info(`Lead record deleted for ${userId}`);
    } catch (err) {
      logger.error('Failed to delete lead from database:', err);
    }
  }
}

async function bulkClearInactiveStates(daysInactive = 30) {
  const cutoff = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);
  
  try {
    const res = await pool.query(
      'DELETE FROM leads WHERE last_interaction < $1 RETURNING user_id',
      [cutoff]
    );
    
    logger.info(`Cleared ${res.rowCount} inactive leads (inactive for ${daysInactive} days)`);
    return res.rowCount;
  } catch (err) {
    logger.error('Failed to clear inactive states:', err);
    return 0;
  }
}

// ============================================
// BULK OPERATIONS (PostgreSQL)
// ============================================

function getAllStates() {
  const states = {};
  const now = Date.now();
  
  for (const [userId, cached] of cache) {
    if (now - cached.timestamp < CONFIG.cacheTTL) {
      states[userId] = { ...cached.data };
    }
  }
  
  return states;
}

async function getLeadsByStage(leadStage, limit = 50) {
  try {
    const res = await pool.query(
      `SELECT user_id, username, selected_model, lead_score, 
              last_interaction, interactions
       FROM leads 
       WHERE lead_stage = $1 
       ORDER BY lead_score DESC, last_interaction DESC
       LIMIT $2`,
      [leadStage, limit]
    );
    return res.rows;
  } catch (err) {
    logger.error('Failed to get leads by stage:', err);
    return [];
  }
}

async function getTopLeads(limit = 10, minScore = 0) {
  try {
    const res = await pool.query(
      `SELECT user_id, username, selected_model, lead_score, 
              lead_stage, last_interaction, interactions
       FROM leads 
       WHERE lead_score >= $1
       ORDER BY lead_score DESC, last_interaction DESC
       LIMIT $2`,
      [minScore, limit]
    );
    return res.rows;
  } catch (err) {
    logger.error('Failed to get top leads:', err);
    return [];
  }
}

async function getLeadStats() {
  try {
    const res = await pool.query(
      `SELECT lead_stage, COUNT(*) as count, 
              AVG(lead_score)::int as avg_score,
              MIN(lead_score) as min_score,
              MAX(lead_score) as max_score
       FROM leads 
       GROUP BY lead_stage 
       ORDER BY 
         CASE lead_stage 
           WHEN 'HOT' THEN 1 
           WHEN 'WARM' THEN 2 
           WHEN 'INTERESTED' THEN 3 
           WHEN 'AWARE' THEN 4 
           WHEN 'COLD' THEN 5 
         END`
    );
    
    const total = res.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
    const topLeads = await getTopLeads(5);
    
    return { total, byStage: res.rows, topLeads };
  } catch (err) {
    logger.error('Failed to get lead stats:', err);
    return { total: 0, byStage: [], topLeads: [] };
  }
}

async function getLeadsByModel(model, limit = 20) {
  try {
    const res = await pool.query(
      `SELECT user_id, username, lead_score, lead_stage, last_interaction
       FROM leads 
       WHERE selected_model = $1 
       ORDER BY lead_score DESC
       LIMIT $2`,
      [model, limit]
    );
    return res.rows;
  } catch (err) {
    logger.error('Failed to get leads by model:', err);
    return [];
  }
}

// ============================================
// CLEANUP & MAINTENANCE
// ============================================

let cleanupInterval = null;

function startCleanup() {
  if (cleanupInterval) clearInterval(cleanupInterval);
  
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [userId, cached] of cache) {
      if (now - cached.timestamp > CONFIG.cacheTTL * 2) {
        cache.delete(userId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Cache cleanup: removed ${cleaned} expired entries (size: ${cache.size})`);
    }
  }, CONFIG.cleanupInterval);
}

function stopCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Start cleanup on module load
startCleanup();

// Graceful shutdown
process.on('beforeExit', () => {
  stopCleanup();
});

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Core state management
  getUserState,
  updateUserState,
  clearUserState,
  getAllStates,
  
  // Lead scoring
  addLeadScore,
  getLeadStage,
  getLeadStagePriority,
  leadScoreActions,
  calculateLeadScore,
  applyScoreDecay,
  
  // Analytics
  trackInteraction,
  recordInteraction,
  getInteractionHistory,
  getInteractionStats,
  getDailyInteractionStats,
  
  // Lead queries
  getLeadsByStage,
  getTopLeads,
  getLeadStats,
  getLeadsByModel,
  
  // Session management
  generateSessionId,
  isSessionActive,
  getSessionDuration,
  
  // Cache management
  getCacheStats,
  
  // Bulk operations
  bulkClearInactiveStates,
  
  // Cleanup
  startCleanup,
  stopCleanup,
};