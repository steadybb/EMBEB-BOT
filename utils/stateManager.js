// utils/stateManager.js
const { upsertLead, getLead, pool } = require('./database');
const logger = require('./logger');
const crypto = require('crypto');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  cacheTTL: parseInt(process.env.STATE_CACHE_TTL, 10) || 60000,
  maxCacheSize: parseInt(process.env.STATE_MAX_CACHE, 10) || 1000,
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 30 * 60 * 1000,
  leadScoreDecay: 0.95,
};

// ============================================
// CACHE MANAGEMENT
// ============================================
const cache = new Map();

function evictCache() {
  if (cache.size > CONFIG.maxCacheSize) {
    const entries = [...cache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = Math.ceil(CONFIG.maxCacheSize * 0.1);
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      cache.delete(entries[i][0]);
    }
    logger.debug(`Cache evicted: removed ${toRemove} entries`);
  }
}

function getFromCache(userId) {
  const cached = cache.get(userId);
  if (!cached) return null;
  if (Date.now() - cached.timestamp < CONFIG.cacheTTL) {
    cached.hitCount = (cached.hitCount || 0) + 1;
    return cached.data;
  }
  cache.delete(userId);
  return null;
}

function setCache(userId, data) {
  cache.set(userId, { data, timestamp: Date.now(), hitCount: 0 });
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

function calculateLeadScore(currentScore, action) {
  const points = leadScoreActions[action] || 0;
  return currentScore + points;
}

function applyScoreDecay(lastInteraction, currentScore) {
  if (!lastInteraction) return currentScore;
  const daysSinceLastInteraction = (Date.now() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceLastInteraction > 1) {
    const decayFactor = Math.pow(CONFIG.leadScoreDecay, daysSinceLastInteraction);
    return Math.floor(currentScore * decayFactor);
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

// ============================================
// ANALYTICS & TRACKING (PostgreSQL)
// ============================================

async function trackInteraction(userId, event, metadata = {}) {
  try {
    await pool.query(
      'INSERT INTO interactions (user_id, event, metadata) VALUES ($1, $2, $3)',
      [userId, event, JSON.stringify(metadata)]
    );
    logger.debug(`📊 Tracked: ${event} for ${userId}`);
  } catch (err) {
    logger.debug('Analytics tracking failed (non-critical):', err.message);
  }
}

async function getInteractionHistory(userId, limit = 10) {
  try {
    const res = await pool.query(
      'SELECT * FROM interactions WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2',
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
    let query = 'SELECT event, COUNT(*) as count FROM interactions WHERE timestamp > $1';
    const params = [cutoff];
    if (guildId) { query += ' AND metadata->>\'guildId\' = $2'; params.push(guildId); }
    query += ' GROUP BY event ORDER BY count DESC';
    const res = await pool.query(query, params);
    return res.rows;
  } catch (err) {
    logger.error('Failed to get interaction stats:', err);
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

async function getUserState(userId, username = null) {
  const cached = getFromCache(userId);
  if (cached) return cached;

  let dbState = await getLead(userId);
  
  if (!dbState) {
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
    if (!dbState.tempData) dbState.tempData = {};
    if (!dbState.leadScore) dbState.leadScore = 0;
    if (!dbState.leadStage) dbState.leadStage = 'COLD';
    if (!dbState.interactions) dbState.interactions = 0;
    dbState.leadScore = applyScoreDecay(dbState.lastInteraction, dbState.leadScore);
    dbState.leadStage = getLeadStage(dbState.leadScore);
  }

  const state = { ...dbState };
  setCache(userId, state);
  return state;
}

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

  updateSession(newState);

  if (updates.step && updates.step !== current.step) {
    newState.leadScore = calculateLeadScore(newState.leadScore, updates.step);
    newState.leadStage = getLeadStage(newState.leadScore);
  }

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

  await trackInteraction(userId, updates.step || 'state_update', {
    model: newState.selectedModel,
    leadScore: newState.leadScore,
    leadStage: newState.leadStage,
  });

  setCache(userId, newState);
  return newState;
}

async function addLeadScore(userId, action, username = null) {
  const current = await getUserState(userId, username);
  const newScore = calculateLeadScore(current.leadScore || 0, action);
  const newStage = getLeadStage(newScore);
  return updateUserState(userId, { leadScore: newScore, leadStage: newStage }, username);
}

async function recordInteraction(userId, event, metadata = {}, username = null) {
  await trackInteraction(userId, event, metadata);
  const current = await getUserState(userId, username);
  return updateUserState(userId, { interactions: (current.interactions || 0) + 1 }, username);
}

async function clearUserState(userId, deleteFromDb = false) {
  cache.delete(userId);
  if (deleteFromDb) {
    try {
      await pool.query('DELETE FROM leads WHERE user_id = $1', [userId]);
      logger.info(`Lead record deleted for ${userId}`);
    } catch (err) {
      logger.error('Failed to delete lead from database:', err);
    }
  }
}

// ============================================
// BULK OPERATIONS (PostgreSQL)
// ============================================

function getAllStates() {
  const states = {};
  for (const [userId, cached] of cache) {
    if (Date.now() - cached.timestamp < CONFIG.cacheTTL) {
      states[userId] = cached.data;
    }
  }
  return states;
}

async function getLeadsByStage(leadStage, limit = 50) {
  try {
    const res = await pool.query(
      'SELECT * FROM leads WHERE lead_stage = $1 ORDER BY lead_score DESC LIMIT $2',
      [leadStage, limit]
    );
    return res.rows;
  } catch (err) {
    logger.error('Failed to get leads by stage:', err);
    return [];
  }
}

async function getTopLeads(limit = 10) {
  try {
    const res = await pool.query(
      'SELECT * FROM leads ORDER BY lead_score DESC LIMIT $1',
      [limit]
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
      `SELECT lead_stage, COUNT(*) as count, AVG(lead_score)::int as avg_score 
       FROM leads GROUP BY lead_stage ORDER BY count DESC`
    );
    const total = res.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
    return { total, byStage: res.rows, topLeads: await getTopLeads(5) };
  } catch (err) {
    logger.error('Failed to get lead stats:', err);
    return { total: 0, byStage: [], topLeads: [] };
  }
}

// ============================================
// CLEANUP
// ============================================

setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [userId, cached] of cache) {
    if (now - cached.timestamp > CONFIG.cacheTTL * 2) {
      cache.delete(userId);
      cleaned++;
    }
  }
  if (cleaned > 0) logger.debug(`Cache cleanup: removed ${cleaned} expired entries`);
}, 5 * 60 * 1000);

// ============================================
// EXPORTS
// ============================================

module.exports = {
  getUserState,
  updateUserState,
  clearUserState,
  getAllStates,
  addLeadScore,
  getLeadStage,
  leadScoreActions,
  trackInteraction,
  recordInteraction,
  getInteractionHistory,
  getInteractionStats,
  getLeadsByStage,
  getTopLeads,
  getLeadStats,
  generateSessionId,
  isSessionActive,
};