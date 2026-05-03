
// utils/database.js
const { Pool } = require('pg');
const logger = require('./logger');

// ============================================
// DATABASE CONNECTION
// ============================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT, 10) || 10000,
});

// Test connection
pool.connect()
  .then(() => logger.db('PostgreSQL connected successfully'))
  .catch(err => logger.error('PostgreSQL connection failed:', err.message));

// ============================================
// DATABASE INITIALIZATION
// ============================================
async function initDatabase() {
  const queries = `
    -- Lead Management
    CREATE TABLE IF NOT EXISTS leads (
      user_id TEXT PRIMARY KEY,
      username TEXT,
      selected_model TEXT,
      current_step TEXT,
      temp_data JSONB DEFAULT '{}',
      lead_score INTEGER DEFAULT 0,
      lead_stage TEXT DEFAULT 'COLD',
      interactions INTEGER DEFAULT 0,
      session_id TEXT,
      last_interaction TIMESTAMP DEFAULT NOW(),
      last_followup_sent TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS test_drive_bookings (
      id SERIAL PRIMARY KEY,
      user_id TEXT REFERENCES leads(user_id) ON DELETE CASCADE,
      username TEXT,
      date DATE NOT NULL,
      time TIME NOT NULL,
      location_type TEXT NOT NULL,
      thread_channel_id TEXT,
      status TEXT DEFAULT 'confirmed',
      notes TEXT,
      booked_at TIMESTAMP DEFAULT NOW()
    );

    -- Guild Configuration
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      verify_role_id TEXT,
      verify_enabled BOOLEAN DEFAULT false,
      ticket_category_id TEXT,
      ticket_logs_channel_id TEXT,
      staff_role_id TEXT,
      lead_role_id TEXT,
      auto_post_enabled BOOLEAN DEFAULT false,
      auto_post_channels TEXT[] DEFAULT '{}',
      auto_post_interval_hours INTEGER DEFAULT 2,
      lobby_webhook_url TEXT,
      lobby_chatter_enabled BOOLEAN DEFAULT false,
      lobby_chatter_personas JSONB DEFAULT '[]',
      giveaway_ping_role_id TEXT,
      welcome_channel_id TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Ticket System
    CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'normal',
      category TEXT DEFAULT 'general',
      assigned_to TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      closed_at TIMESTAMP,
      resolution TEXT
    );

    -- Regular Giveaways
    CREATE TABLE IF NOT EXISTS giveaways (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL UNIQUE,
      prize TEXT NOT NULL,
      winners_count INTEGER DEFAULT 1,
      end_time TIMESTAMP NOT NULL,
      hosted_by TEXT,
      entries JSONB DEFAULT '[]',
      winners TEXT[] DEFAULT '{}',
      ended BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS giveaway_entries (
      id SERIAL PRIMARY KEY,
      giveaway_id INTEGER REFERENCES giveaways(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      entered_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(giveaway_id, user_id)
    );

    -- Car Giveaways
    CREATE TABLE IF NOT EXISTS car_giveaways (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL UNIQUE,
      car_model TEXT NOT NULL,
      car_year INTEGER DEFAULT 2026,
      car_color TEXT DEFAULT 'Aurora White',
      msrp INTEGER NOT NULL,
      shipping_cost INTEGER DEFAULT 1999,
      documentation_fee INTEGER DEFAULT 499,
      winners_count INTEGER DEFAULT 1,
      entry_fee INTEGER DEFAULT 0,
      end_time TIMESTAMP NOT NULL,
      hosted_by TEXT,
      entries JSONB DEFAULT '[]',
      winners TEXT[] DEFAULT '{}',
      payment_status JSONB DEFAULT '{}',
      ended BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS car_giveaway_entries (
      id SERIAL PRIMARY KEY,
      giveaway_id INTEGER REFERENCES car_giveaways(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      user_email TEXT,
      user_phone TEXT,
      agreed_to_terms BOOLEAN DEFAULT false,
      payment_id TEXT,
      entered_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(giveaway_id, user_id)
    );

    -- Interaction Analytics
    CREATE TABLE IF NOT EXISTS interactions (
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      guild_id TEXT,
      event TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      timestamp TIMESTAMP DEFAULT NOW()
    );

    -- Auto Post Logs
    CREATE TABLE IF NOT EXISTS auto_post_logs (
      id SERIAL PRIMARY KEY,
      guild_id TEXT,
      channel_id TEXT,
      content_type TEXT,
      source TEXT,
      post_id TEXT,
      model TEXT,
      has_image BOOLEAN DEFAULT false,
      success BOOLEAN DEFAULT true,
      error TEXT,
      posted_at TIMESTAMP DEFAULT NOW()
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_leads_last_interaction ON leads(last_interaction);
    CREATE INDEX IF NOT EXISTS idx_leads_last_followup ON leads(last_followup_sent);
    CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score DESC);
    CREATE INDEX IF NOT EXISTS idx_leads_lead_stage ON leads(lead_stage);
    CREATE INDEX IF NOT EXISTS idx_tickets_guild_id ON tickets(guild_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_giveaways_message_id ON giveaways(message_id);
    CREATE INDEX IF NOT EXISTS idx_car_giveaways_message_id ON car_giveaways(message_id);
    CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_interactions_event ON interactions(event);
    CREATE INDEX IF NOT EXISTS idx_auto_post_logs_guild ON auto_post_logs(guild_id);
    CREATE INDEX IF NOT EXISTS idx_auto_post_logs_posted ON auto_post_logs(posted_at DESC);
  `;

  try {
    await pool.query(queries);
    logger.db('✅ All database tables initialized successfully');
  } catch (err) {
    logger.error('Database initialization failed:', err.message);
    throw err;
  }

  // For existing databases, ensure all new columns exist
  const alterQueries = `
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_stage TEXT DEFAULT 'COLD';
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS interactions INTEGER DEFAULT 0;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS session_id TEXT;
    ALTER TABLE test_drive_bookings ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE test_drive_bookings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';
    ALTER TABLE test_drive_bookings ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS lead_role_id TEXT;
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS auto_post_enabled BOOLEAN DEFAULT false;
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS auto_post_channels TEXT[] DEFAULT '{}';
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS auto_post_interval_hours INTEGER DEFAULT 2;
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS lobby_webhook_url TEXT;
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS lobby_chatter_enabled BOOLEAN DEFAULT false;
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS lobby_chatter_personas JSONB DEFAULT '[]';
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS giveaway_ping_role_id TEXT;
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS welcome_channel_id TEXT;
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_to TEXT;
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution TEXT;
  `;

  try {
    await pool.query(alterQueries);
  } catch (err) {
    logger.warn('Some column migrations may have been skipped:', err.message);
  }
}

// ============================================
// LEAD MANAGEMENT
// ============================================

async function upsertLead(userId, username, data) {
  const {
    selectedModel,
    step,
    tempData,
    leadScore,
    leadStage,
    interactions,
    sessionId,
    lastInteraction,
  } = data;

  const query = `
    INSERT INTO leads (
      user_id, username, selected_model, current_step, temp_data,
      lead_score, lead_stage, interactions, session_id, last_interaction
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (user_id) DO UPDATE SET
      username = EXCLUDED.username,
      selected_model = COALESCE(EXCLUDED.selected_model, leads.selected_model),
      current_step = COALESCE(EXCLUDED.current_step, leads.current_step),
      temp_data = COALESCE(EXCLUDED.temp_data, leads.temp_data),
      lead_score = COALESCE(EXCLUDED.lead_score, leads.lead_score),
      lead_stage = COALESCE(EXCLUDED.lead_stage, leads.lead_stage),
      interactions = leads.interactions + 1,
      session_id = COALESCE(EXCLUDED.session_id, leads.session_id),
      last_interaction = EXCLUDED.last_interaction
  `;

  await pool.query(query, [
    userId,
    username || 'unknown',
    selectedModel || null,
    step || null,
    tempData ? JSON.stringify(tempData) : '{}',
    leadScore || 0,
    leadStage || 'COLD',
    interactions || 0,
    sessionId || null,
    lastInteraction || new Date(),
  ]);
}

async function getLead(userId) {
  const res = await pool.query('SELECT * FROM leads WHERE user_id = $1', [userId]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    userId: row.user_id,
    username: row.username,
    selectedModel: row.selected_model,
    step: row.current_step,
    tempData: row.temp_data || {},
    leadScore: row.lead_score || 0,
    leadStage: row.lead_stage || 'COLD',
    interactions: row.interactions || 0,
    sessionId: row.session_id,
    lastInteraction: row.last_interaction,
    lastFollowupSent: row.last_followup_sent,
    createdAt: row.created_at,
  };
}

async function getStaleLeads(hours = 48) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const query = `
    SELECT user_id, username, selected_model, lead_score, lead_stage
    FROM leads
    WHERE last_interaction < $1
      AND (last_followup_sent IS NULL OR last_followup_sent < $1 - INTERVAL '24 hours')
    ORDER BY lead_score DESC
  `;
  const res = await pool.query(query, [cutoff]);
  return res.rows;
}

async function getLeadsByStage(leadStage, limit = 50) {
  const res = await pool.query(
    'SELECT * FROM leads WHERE lead_stage = $1 ORDER BY lead_score DESC LIMIT $2',
    [leadStage, limit]
  );
  return res.rows;
}

async function getTopLeads(limit = 10) {
  const res = await pool.query(
    'SELECT * FROM leads ORDER BY lead_score DESC LIMIT $1',
    [limit]
  );
  return res.rows;
}

async function updateLastFollowup(userId) {
  await pool.query(
    'UPDATE leads SET last_followup_sent = NOW() WHERE user_id = $1',
    [userId]
  );
}

async function saveTestDriveBooking(userId, username, date, time, locationType, threadChannelId) {
  await upsertLead(userId, username, {
    selectedModel: null,
    step: 'test_drive_booked',
    tempData: { date, time, locationType },
    leadScore: 50,
    leadStage: 'HOT',
    lastInteraction: new Date(),
  });

  const query = `
    INSERT INTO test_drive_bookings (user_id, username, date, time, location_type, thread_channel_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `;
  const res = await pool.query(query, [userId, username, date, time, locationType, threadChannelId]);
  return res.rows[0]?.id;
}

async function getUserBookings(userId) {
  const res = await pool.query(
    'SELECT * FROM test_drive_bookings WHERE user_id = $1 ORDER BY booked_at DESC',
    [userId]
  );
  return res.rows;
}

async function deleteOldLeads(days = 90) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const res = await pool.query(
    'DELETE FROM leads WHERE last_interaction < $1 AND lead_stage = $2',
    [cutoff, 'COLD']
  );
  logger.db(`Cleaned up ${res.rowCount} old cold leads`);
  return res.rowCount;
}

// ============================================
// GUILD CONFIGURATION
// ============================================

async function getGuildConfig(guildId) {
  const res = await pool.query('SELECT * FROM guild_config WHERE guild_id = $1', [guildId]);
  if (res.rows.length === 0) {
    return {
      guild_id: guildId,
      verify_enabled: false,
      verify_role_id: null,
      auto_post_enabled: false,
      auto_post_channels: [],
      auto_post_interval_hours: 2,
      lobby_chatter_enabled: false,
      lobby_webhook_url: null,
      lobby_chatter_personas: [],
      giveaway_ping_role_id: null,
      ticket_category_id: null,
      ticket_logs_channel_id: null,
      staff_role_id: null,
      lead_role_id: null,
      welcome_channel_id: null,
    };
  }
  const row = res.rows[0];
  
  // Parse array fields
  if (row.auto_post_channels && typeof row.auto_post_channels === 'string') {
    row.auto_post_channels = row.auto_post_channels.replace(/[{}]/g, '').split(',').map(s => s.trim()).filter(Boolean);
  }
  
  // Parse JSON fields
  if (row.lobby_chatter_personas && typeof row.lobby_chatter_personas === 'string') {
    try {
      row.lobby_chatter_personas = JSON.parse(row.lobby_chatter_personas);
    } catch {
      row.lobby_chatter_personas = [];
    }
  }
  
  return row;
}

async function setGuildConfig(guildId, config) {
  const {
    verify_role_id,
    verify_enabled,
    ticket_category_id,
    ticket_logs_channel_id,
    staff_role_id,
    lead_role_id,
    auto_post_enabled,
    auto_post_channels,
    auto_post_interval_hours,
    lobby_webhook_url,
    lobby_chatter_enabled,
    lobby_chatter_personas,
    giveaway_ping_role_id,
    welcome_channel_id,
  } = config;

  await pool.query(
    `INSERT INTO guild_config (
      guild_id, verify_role_id, verify_enabled, ticket_category_id,
      ticket_logs_channel_id, staff_role_id, lead_role_id,
      auto_post_enabled, auto_post_channels, auto_post_interval_hours,
      lobby_webhook_url, lobby_chatter_enabled, lobby_chatter_personas,
      giveaway_ping_role_id, welcome_channel_id, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
    ON CONFLICT (guild_id) DO UPDATE SET
      verify_role_id = EXCLUDED.verify_role_id,
      verify_enabled = EXCLUDED.verify_enabled,
      ticket_category_id = EXCLUDED.ticket_category_id,
      ticket_logs_channel_id = EXCLUDED.ticket_logs_channel_id,
      staff_role_id = EXCLUDED.staff_role_id,
      lead_role_id = EXCLUDED.lead_role_id,
      auto_post_enabled = EXCLUDED.auto_post_enabled,
      auto_post_channels = EXCLUDED.auto_post_channels,
      auto_post_interval_hours = EXCLUDED.auto_post_interval_hours,
      lobby_webhook_url = EXCLUDED.lobby_webhook_url,
      lobby_chatter_enabled = EXCLUDED.lobby_chatter_enabled,
      lobby_chatter_personas = EXCLUDED.lobby_chatter_personas,
      giveaway_ping_role_id = EXCLUDED.giveaway_ping_role_id,
      welcome_channel_id = EXCLUDED.welcome_channel_id,
      updated_at = NOW()`,
    [
      guildId,
      verify_role_id || null,
      verify_enabled !== undefined ? verify_enabled : false,
      ticket_category_id || null,
      ticket_logs_channel_id || null,
      staff_role_id || null,
      lead_role_id || null,
      auto_post_enabled !== undefined ? auto_post_enabled : false,
      auto_post_channels || [],
      auto_post_interval_hours !== undefined ? auto_post_interval_hours : 2,
      lobby_webhook_url || null,
      lobby_chatter_enabled !== undefined ? lobby_chatter_enabled : false,
      lobby_chatter_personas ? JSON.stringify(lobby_chatter_personas) : '[]',
      giveaway_ping_role_id || null,
      welcome_channel_id || null,
    ]
  );
}

// ============================================
// TICKET SYSTEM
// ============================================

async function saveTicket(guildId, userId, channelId) {
  await pool.query(
    'INSERT INTO tickets (guild_id, user_id, channel_id) VALUES ($1, $2, $3)',
    [guildId, userId, channelId]
  );
}

async function closeTicket(channelId, resolution = null) {
  await pool.query(
    'UPDATE tickets SET status = $1, closed_at = NOW(), resolution = $2 WHERE channel_id = $3 AND status = $4',
    ['closed', resolution, channelId, 'open']
  );
}

async function getUserOpenTickets(userId) {
  const res = await pool.query(
    'SELECT * FROM tickets WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
    [userId, 'open']
  );
  return res.rows;
}

async function getOpenTicketsByGuild(guildId) {
  const res = await pool.query(
    'SELECT * FROM tickets WHERE guild_id = $1 AND status = $2 ORDER BY created_at ASC',
    [guildId, 'open']
  );
  return res.rows;
}

async function assignTicket(ticketId, staffId) {
  await pool.query(
    'UPDATE tickets SET assigned_to = $1 WHERE id = $2',
    [staffId, ticketId]
  );
}

// ============================================
// INTERACTION ANALYTICS
// ============================================

async function logInteraction(userId, guildId, event, metadata = {}) {
  await pool.query(
    'INSERT INTO interactions (user_id, guild_id, event, metadata) VALUES ($1, $2, $3, $4)',
    [userId, guildId, event, JSON.stringify(metadata)]
  );
}

async function getInteractionStats(guildId = null, days = 7) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  let query = `
    SELECT event, COUNT(*) as count
    FROM interactions
    WHERE timestamp > $1
  `;
  const params = [cutoff];
  
  if (guildId) {
    query += ' AND guild_id = $2';
    params.push(guildId);
  }
  
  query += ' GROUP BY event ORDER BY count DESC';
  
  const res = await pool.query(query, params);
  return res.rows;
}

// ============================================
// AUTO POST LOGS
// ============================================

async function logAutoPost(guildId, channelId, contentType, source, postId = null, model = null, hasImage = false, success = true, error = null) {
  await pool.query(
    `INSERT INTO auto_post_logs (guild_id, channel_id, content_type, source, post_id, model, has_image, success, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [guildId, channelId, contentType, source, postId, model, hasImage, success, error]
  );
}

async function getAutoPostStats(guildId = null, days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  let query = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
      SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN source = 'api' THEN 1 ELSE 0 END) as api_posts,
      SUM(CASE WHEN source = 'fallback' THEN 1 ELSE 0 END) as fallback_posts,
      SUM(CASE WHEN has_image THEN 1 ELSE 0 END) as with_images
    FROM auto_post_logs
    WHERE posted_at > $1
  `;
  const params = [cutoff];
  
  if (guildId) {
    query += ' AND guild_id = $2';
    params.push(guildId);
  }
  
  const res = await pool.query(query, params);
  return res.rows[0];
}

// ============================================
// GIVEAWAY FUNCTIONS
// ============================================

async function createGiveaway(guildId, channelId, messageId, prize, winnersCount, endTime, hostedBy) {
  const query = `
    INSERT INTO giveaways (guild_id, channel_id, message_id, prize, winners_count, end_time, hosted_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `;
  const res = await pool.query(query, [guildId, channelId, messageId, prize, winnersCount, endTime, hostedBy]);
  return res.rows[0].id;
}

async function getGiveaway(messageId) {
  const res = await pool.query('SELECT * FROM giveaways WHERE message_id = $1 AND ended = false', [messageId]);
  return res.rows[0] || null;
}

async function addGiveawayEntry(giveawayId, userId) {
  const existing = await pool.query(
    'SELECT * FROM giveaway_entries WHERE giveaway_id = $1 AND user_id = $2',
    [giveawayId, userId]
  );
  if (existing.rows.length > 0) return false;
  
  await pool.query(
    'INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES ($1, $2)',
    [giveawayId, userId]
  );
  return true;
}

async function getGiveawayEntries(giveawayId) {
  const res = await pool.query(
    'SELECT user_id FROM giveaway_entries WHERE giveaway_id = $1',
    [giveawayId]
  );
  return res.rows.map(row => row.user_id);
}

async function endGiveaway(giveawayId, winners) {
  await pool.query(
    'UPDATE giveaways SET ended = true, winners = $2 WHERE id = $1',
    [giveawayId, winners]
  );
}

async function getGiveawaysByGuild(guildId) {
  const res = await pool.query(
    'SELECT * FROM giveaways WHERE guild_id = $1 AND ended = false ORDER BY end_time ASC',
    [guildId]
  );
  return res.rows;
}

async function getCompletedGiveawaysByGuild(guildId) {
  const res = await pool.query(
    'SELECT * FROM giveaways WHERE guild_id = $1 AND ended = true ORDER BY created_at DESC LIMIT 10',
    [guildId]
  );
  return res.rows;
}

async function setGiveawayPingRole(guildId, roleId) {
  const config = await getGuildConfig(guildId);
  config.giveaway_ping_role_id = roleId;
  await setGuildConfig(guildId, config);
}

async function getGiveawayPingRole(guildId) {
  const config = await getGuildConfig(guildId);
  return config.giveaway_ping_role_id;
}

// ============================================
// CAR GIVEAWAY FUNCTIONS
// ============================================

async function createCarGiveaway(guildId, channelId, messageId, carModel, msrp, shippingCost, docFee, winnersCount, endTime, hostedBy) {
  const query = `
    INSERT INTO car_giveaways (guild_id, channel_id, message_id, car_model, msrp, shipping_cost, documentation_fee, winners_count, end_time, hosted_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id
  `;
  const res = await pool.query(query, [guildId, channelId, messageId, carModel, msrp, shippingCost, docFee, winnersCount, endTime, hostedBy]);
  return res.rows[0].id;
}

async function getCarGiveaway(messageId) {
  const res = await pool.query('SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = false', [messageId]);
  return res.rows[0] || null;
}

async function addCarGiveawayEntry(giveawayId, userId, email, phone) {
  const existing = await pool.query(
    'SELECT * FROM car_giveaway_entries WHERE giveaway_id = $1 AND user_id = $2',
    [giveawayId, userId]
  );
  if (existing.rows.length > 0) return false;
  
  await pool.query(
    `INSERT INTO car_giveaway_entries (giveaway_id, user_id, user_email, user_phone, agreed_to_terms)
     VALUES ($1, $2, $3, $4, $5)`,
    [giveawayId, userId, email, phone || null, true]
  );
  return true;
}

async function getCarGiveawayEntries(giveawayId) {
  const res = await pool.query(
    'SELECT user_id, user_email, user_phone FROM car_giveaway_entries WHERE giveaway_id = $1',
    [giveawayId]
  );
  return res.rows;
}

async function endCarGiveaway(giveawayId, winners) {
  await pool.query(
    'UPDATE car_giveaways SET ended = true, winners = $2 WHERE id = $1',
    [giveawayId, winners]
  );
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Core
  initDatabase,
  pool,
  
  // Lead Management
  upsertLead,
  getLead,
  getStaleLeads,
  getLeadsByStage,
  getTopLeads,
  updateLastFollowup,
  saveTestDriveBooking,
  getUserBookings,
  deleteOldLeads,
  
  // Guild Configuration
  getGuildConfig,
  setGuildConfig,
  
  // Ticket System
  saveTicket,
  closeTicket,
  getUserOpenTickets,
  getOpenTicketsByGuild,
  assignTicket,
  
  // Interaction Analytics
  logInteraction,
  getInteractionStats,
  
  // Auto Post Logs
  logAutoPost,
  getAutoPostStats,
  
  // Regular Giveaways
  createGiveaway,
  getGiveaway,
  addGiveawayEntry,
  getGiveawayEntries,
  endGiveaway,
  getGiveawaysByGuild,
  getCompletedGiveawaysByGuild,
  setGiveawayPingRole,
  getGiveawayPingRole,
  
  // Car Giveaways
  createCarGiveaway,
  getCarGiveaway,
  addCarGiveawayEntry,
  getCarGiveawayEntries,
  endCarGiveaway,
};