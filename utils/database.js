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
  statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT, 10) || 30000,
});

// Connection pool error handling
pool.on('error', (err) => {
  logger.error('Unexpected database pool error:', err.message);
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

pool.on('remove', () => {
  logger.debug('Database connection closed');
});

// Test connection with retry
let connectionRetries = 0;
const maxConnectionRetries = 5;
let isConnected = false;

async function testConnection() {
  try {
    const client = await pool.connect();
    logger.db('PostgreSQL connected successfully');
    client.release();
    connectionRetries = 0;
    isConnected = true;
    return true;
  } catch (err) {
    connectionRetries++;
    logger.error(`PostgreSQL connection failed (attempt ${connectionRetries}/${maxConnectionRetries}):`, err.message);
    
    if (connectionRetries < maxConnectionRetries) {
      const delay = 5000 * connectionRetries;
      logger.info(`Retrying connection in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return testConnection();
    }
    
    logger.error('Failed to connect to database after multiple attempts');
    isConnected = false;
    return false;
  }
}

function isDatabaseConnected() {
  return isConnected;
}

// ============================================
// DATABASE INITIALIZATION
// ============================================
async function initDatabase() {
  const connected = await testConnection();
  if (!connected) {
    throw new Error('Unable to establish database connection');
  }

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
      session_started_at TIMESTAMP,
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
      confirmed_at TIMESTAMP,
      cancelled_at TIMESTAMP,
      booked_at TIMESTAMP DEFAULT NOW()
    );

    -- Guild Configuration
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      verify_role_id TEXT,
      verify_enabled BOOLEAN DEFAULT false,
      verify_channel_id TEXT,
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
      log_channel_id TEXT,
      mod_role_id TEXT,
      admin_role_id TEXT,
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
      transcript TEXT,
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
      response_time_ms INTEGER,
      posted_at TIMESTAMP DEFAULT NOW()
    );

    -- System Settings
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value JSONB,
      updated_at TIMESTAMP DEFAULT NOW(),
      updated_by TEXT
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_leads_last_interaction ON leads(last_interaction);
    CREATE INDEX IF NOT EXISTS idx_leads_last_followup ON leads(last_followup_sent);
    CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score DESC);
    CREATE INDEX IF NOT EXISTS idx_leads_lead_stage ON leads(lead_stage);
    CREATE INDEX IF NOT EXISTS idx_leads_selected_model ON leads(selected_model);
    
    CREATE INDEX IF NOT EXISTS idx_tickets_guild_id ON tickets(guild_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
    
    CREATE INDEX IF NOT EXISTS idx_giveaways_message_id ON giveaways(message_id);
    CREATE INDEX IF NOT EXISTS idx_giveaways_end_time ON giveaways(end_time);
    CREATE INDEX IF NOT EXISTS idx_giveaways_guild_id ON giveaways(guild_id);
    
    CREATE INDEX IF NOT EXISTS idx_car_giveaways_message_id ON car_giveaways(message_id);
    CREATE INDEX IF NOT EXISTS idx_car_giveaways_end_time ON car_giveaways(end_time);
    CREATE INDEX IF NOT EXISTS idx_car_giveaways_guild_id ON car_giveaways(guild_id);
    
    CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_interactions_event ON interactions(event);
    CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON interactions(user_id);
    
    CREATE INDEX IF NOT EXISTS idx_auto_post_logs_guild ON auto_post_logs(guild_id);
    CREATE INDEX IF NOT EXISTS idx_auto_post_logs_posted ON auto_post_logs(posted_at DESC);
    CREATE INDEX IF NOT EXISTS idx_auto_post_logs_success ON auto_post_logs(success);
    CREATE INDEX IF NOT EXISTS idx_auto_post_logs_content_type ON auto_post_logs(content_type);
    
    CREATE INDEX IF NOT EXISTS idx_test_drive_bookings_user ON test_drive_bookings(user_id);
    CREATE INDEX IF NOT EXISTS idx_test_drive_bookings_date ON test_drive_bookings(date);
    CREATE INDEX IF NOT EXISTS idx_test_drive_bookings_status ON test_drive_bookings(status);
  `;

  try {
    await pool.query(queries);
    logger.db('✅ All database tables initialized successfully');
  } catch (err) {
    logger.error('Database initialization failed:', err.message);
    throw err;
  }

  // ============================================
  // RUN ALTER STATEMENTS INDIVIDUALLY (Render compatible)
  // ============================================
  const alterStatements = [
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_stage TEXT DEFAULT 'COLD'`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS interactions INTEGER DEFAULT 0`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS session_id TEXT`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMP`,
    
    `ALTER TABLE test_drive_bookings ADD COLUMN IF NOT EXISTS username TEXT`,
    `ALTER TABLE test_drive_bookings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed'`,
    `ALTER TABLE test_drive_bookings ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE test_drive_bookings ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP`,
    `ALTER TABLE test_drive_bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP`,
    
    `ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS verify_channel_id TEXT`,
    `ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS lead_role_id TEXT`,
    `ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS auto_post_enabled BOOLEAN DEFAULT false`,
    `ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS auto_post_channels TEXT[] DEFAULT '{}'`,
    `ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS auto_post_interval_hours INTEGER DEFAULT 2`,
    `ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS lobby_webhook_url TEXT`,
    `ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS lobby_chatter_enabled BOOLEAN DEFAULT false`,
    `ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS lobby_chatter_personas JSONB DEFAULT '[]'`,
    `ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS giveaway_ping_role_id TEXT`,
    `ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS welcome_channel_id TEXT`,
    `ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS log_channel_id TEXT`,
    `ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS mod_role_id TEXT`,
    `ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS admin_role_id TEXT`,
    `ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
    
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal'`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general'`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_to TEXT`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution TEXT`,
    `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS transcript TEXT`,
    
    `ALTER TABLE auto_post_logs ADD COLUMN IF NOT EXISTS response_time_ms INTEGER`,
  ];

  let migrationsRun = 0;
  for (const stmt of alterStatements) {
    try {
      await pool.query(stmt);
      migrationsRun++;
    } catch (err) {
      // Silently skip - column likely already exists
      if (!err.message.includes('already exists')) {
        logger.debug(`Migration note: ${err.message}`);
      }
    }
  }
  
  if (migrationsRun > 0) {
    logger.db(`✅ ${migrationsRun} column migrations applied`);
  }
  
  // Initialize default system settings
  await initSystemSettings();
}

async function initSystemSettings() {
  const defaultSettings = [
    ['maintenance_mode', { enabled: false, reason: null }],
    ['global_auto_post_enabled', true],
    ['max_concurrent_giveaways', 5],
    ['default_ticket_category', 'general'],
    ['lead_score_decay_rate', 0.95],
    ['session_timeout_minutes', 30],
  ];
  
  for (const [key, value] of defaultSettings) {
    await pool.query(
      `INSERT INTO system_settings (key, value) VALUES ($1, $2) 
       ON CONFLICT (key) DO NOTHING`,
      [key, JSON.stringify(value)]
    );
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
    sessionStartedAt,
    lastInteraction,
  } = data;

  const query = `
    INSERT INTO leads (
      user_id, username, selected_model, current_step, temp_data,
      lead_score, lead_stage, interactions, session_id, session_started_at, last_interaction
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (user_id) DO UPDATE SET
      username = EXCLUDED.username,
      selected_model = COALESCE(EXCLUDED.selected_model, leads.selected_model),
      current_step = COALESCE(EXCLUDED.current_step, leads.current_step),
      temp_data = leads.temp_data || EXCLUDED.temp_data,
      lead_score = COALESCE(EXCLUDED.lead_score, leads.lead_score),
      lead_stage = COALESCE(EXCLUDED.lead_stage, leads.lead_stage),
      interactions = leads.interactions + 1,
      session_id = COALESCE(EXCLUDED.session_id, leads.session_id),
      session_started_at = COALESCE(EXCLUDED.session_started_at, leads.session_started_at),
      last_interaction = EXCLUDED.last_interaction
    RETURNING *
  `;

  const res = await pool.query(query, [
    userId,
    username || 'unknown',
    selectedModel || null,
    step || null,
    tempData ? JSON.stringify(tempData) : '{}',
    leadScore ?? 0,
    leadStage || 'COLD',
    interactions ?? 0,
    sessionId || null,
    sessionStartedAt || new Date(),
    lastInteraction || new Date(),
  ]);
  
  return res.rows[0];
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
    sessionStartedAt: row.session_started_at,
    lastInteraction: row.last_interaction,
    lastFollowupSent: row.last_followup_sent,
    createdAt: row.created_at,
  };
}

async function getStaleLeads(hours = 48, limit = 100) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const query = `
    SELECT user_id, username, selected_model, lead_score, lead_stage, last_interaction
    FROM leads
    WHERE last_interaction < $1
      AND (last_followup_sent IS NULL OR last_followup_sent < $1 - INTERVAL '24 hours')
      AND lead_stage != 'COLD'
    ORDER BY lead_score DESC
    LIMIT $2
  `;
  const res = await pool.query(query, [cutoff, limit]);
  return res.rows;
}

async function getLeadsByStage(leadStage, limit = 50) {
  const res = await pool.query(
    'SELECT * FROM leads WHERE lead_stage = $1 ORDER BY lead_score DESC, last_interaction DESC LIMIT $2',
    [leadStage, limit]
  );
  return res.rows;
}

async function getTopLeads(limit = 10, minScore = 0) {
  const res = await pool.query(
    'SELECT * FROM leads WHERE lead_score >= $1 ORDER BY lead_score DESC, last_interaction DESC LIMIT $2',
    [minScore, limit]
  );
  return res.rows;
}

async function getLeadsByModel(model, limit = 20) {
  const res = await pool.query(
    'SELECT * FROM leads WHERE selected_model = $1 ORDER BY lead_score DESC LIMIT $2',
    [model, limit]
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

async function getUserBookings(userId, limit = 10) {
  const res = await pool.query(
    'SELECT * FROM test_drive_bookings WHERE user_id = $1 ORDER BY booked_at DESC LIMIT $2',
    [userId, limit]
  );
  return res.rows;
}

async function confirmBooking(bookingId) {
  await pool.query(
    'UPDATE test_drive_bookings SET status = $1, confirmed_at = NOW() WHERE id = $2',
    ['confirmed', bookingId]
  );
}

async function cancelBooking(bookingId, reason = null) {
  await pool.query(
    'UPDATE test_drive_bookings SET status = $1, cancelled_at = NOW(), notes = COALESCE(notes, $2) WHERE id = $3',
    ['cancelled', reason, bookingId]
  );
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

async function getLeadStats() {
  const res = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN lead_stage = 'HOT' THEN 1 END) as hot,
      COUNT(CASE WHEN lead_stage = 'WARM' THEN 1 END) as warm,
      COUNT(CASE WHEN lead_stage = 'INTERESTED' THEN 1 END) as interested,
      COUNT(CASE WHEN lead_stage = 'AWARE' THEN 1 END) as aware,
      COUNT(CASE WHEN lead_stage = 'COLD' THEN 1 END) as cold,
      AVG(lead_score)::int as avg_score,
      MAX(lead_score) as max_score,
      COUNT(DISTINCT selected_model) as models_interest,
      COUNT(CASE WHEN selected_model IS NOT NULL THEN 1 END) as model_selected_count
    FROM leads
  `);
  return res.rows[0];
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
      verify_channel_id: null,
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
      log_channel_id: null,
      mod_role_id: null,
      admin_role_id: null,
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
    verify_role_id, verify_enabled, verify_channel_id,
    ticket_category_id, ticket_logs_channel_id,
    staff_role_id, lead_role_id, auto_post_enabled, auto_post_channels,
    auto_post_interval_hours, lobby_webhook_url, lobby_chatter_enabled,
    lobby_chatter_personas, giveaway_ping_role_id, welcome_channel_id,
    log_channel_id, mod_role_id, admin_role_id,
  } = config;

  await pool.query(
    `INSERT INTO guild_config (
      guild_id, verify_role_id, verify_enabled, verify_channel_id,
      ticket_category_id, ticket_logs_channel_id, staff_role_id, lead_role_id,
      auto_post_enabled, auto_post_channels, auto_post_interval_hours,
      lobby_webhook_url, lobby_chatter_enabled, lobby_chatter_personas,
      giveaway_ping_role_id, welcome_channel_id, log_channel_id,
      mod_role_id, admin_role_id, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW())
    ON CONFLICT (guild_id) DO UPDATE SET
      verify_role_id = EXCLUDED.verify_role_id,
      verify_enabled = EXCLUDED.verify_enabled,
      verify_channel_id = EXCLUDED.verify_channel_id,
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
      log_channel_id = EXCLUDED.log_channel_id,
      mod_role_id = EXCLUDED.mod_role_id,
      admin_role_id = EXCLUDED.admin_role_id,
      updated_at = NOW()`,
    [guildId, verify_role_id || null, verify_enabled || false, verify_channel_id || null,
     ticket_category_id || null, ticket_logs_channel_id || null, staff_role_id || null, lead_role_id || null,
     auto_post_enabled || false, auto_post_channels || [], auto_post_interval_hours || 2,
     lobby_webhook_url || null, lobby_chatter_enabled || false,
     lobby_chatter_personas ? JSON.stringify(lobby_chatter_personas) : '[]',
     giveaway_ping_role_id || null, welcome_channel_id || null, log_channel_id || null,
     mod_role_id || null, admin_role_id || null]
  );
}

// ============================================
// TICKET SYSTEM
// ============================================

async function saveTicket(guildId, userId, channelId, category = 'general') {
  const res = await pool.query(
    'INSERT INTO tickets (guild_id, user_id, channel_id, category) VALUES ($1,$2,$3,$4) RETURNING id',
    [guildId, userId, channelId, category]
  );
  return res.rows[0].id;
}

async function closeTicket(channelId, resolution = null) {
  const res = await pool.query(
    'UPDATE tickets SET status = $1, closed_at = NOW(), resolution = $2 WHERE channel_id = $3 AND status = $4 RETURNING id',
    ['closed', resolution, channelId, 'open']
  );
  return res.rows[0]?.id;
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
    'SELECT * FROM tickets WHERE guild_id = $1 AND status = $2 ORDER BY priority DESC, created_at ASC',
    [guildId, 'open']
  );
  return res.rows;
}

async function assignTicket(ticketId, staffId) {
  await pool.query('UPDATE tickets SET assigned_to = $1 WHERE id = $2', [staffId, ticketId]);
}

async function getTicketStats(guildId) {
  const res = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'open' THEN 1 END) as open,
      COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed,
      COUNT(CASE WHEN priority = 'high' AND status = 'open' THEN 1 END) as high_priority,
      AVG(EXTRACT(EPOCH FROM (closed_at - created_at))) as avg_resolution_time_seconds,
      COUNT(CASE WHEN assigned_to IS NOT NULL THEN 1 END) as assigned_count
    FROM tickets
    WHERE guild_id = $1
  `, [guildId]);
  return res.rows[0];
}

// ============================================
// INTERACTION ANALYTICS
// ============================================

async function logInteraction(userId, guildId, event, metadata = {}) {
  await pool.query(
    'INSERT INTO interactions (user_id, guild_id, event, metadata) VALUES ($1,$2,$3,$4)',
    [userId, guildId, event, JSON.stringify(metadata)]
  );
}

async function getInteractionStats(guildId = null, days = 7) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  let query = `SELECT event, COUNT(*) as count FROM interactions WHERE timestamp > $1`;
  const params = [cutoff];
  if (guildId) { query += ' AND guild_id = $2'; params.push(guildId); }
  query += ' GROUP BY event ORDER BY count DESC LIMIT 50';
  const res = await pool.query(query, params);
  return res.rows;
}

async function getUserInteractionCount(userId, days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const res = await pool.query(
    'SELECT COUNT(*) as count FROM interactions WHERE user_id = $1 AND timestamp > $2',
    [userId, cutoff]
  );
  return parseInt(res.rows[0].count);
}

// ============================================
// AUTO POST LOGS
// ============================================

async function logAutoPost(guildId, channelId, contentType, source, postId = null, model = null, hasImage = false, success = true, error = null, responseTimeMs = null) {
  await pool.query(
    `INSERT INTO auto_post_logs (guild_id, channel_id, content_type, source, post_id, model, has_image, success, error, response_time_ms, posted_at) 
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
    [guildId, channelId, contentType, source, postId, model, hasImage, success, error, responseTimeMs]
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
      SUM(CASE WHEN has_image THEN 1 ELSE 0 END) as with_images,
      AVG(response_time_ms)::int as avg_response_time
    FROM auto_post_logs 
    WHERE posted_at > $1
  `;
  const params = [cutoff];
  if (guildId) { query += ' AND guild_id = $2'; params.push(guildId); }
  const res = await pool.query(query, params);
  return res.rows[0];
}

// ============================================
// GIVEAWAY FUNCTIONS
// ============================================

async function createGiveaway(guildId, channelId, messageId, prize, winnersCount, endTime, hostedBy) {
  const res = await pool.query(
    `INSERT INTO giveaways (guild_id, channel_id, message_id, prize, winners_count, end_time, hosted_by) 
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [guildId, channelId, messageId, prize, winnersCount, endTime, hostedBy]
  );
  return res.rows[0].id;
}

async function getGiveaway(messageId) {
  const res = await pool.query(
    'SELECT * FROM giveaways WHERE message_id = $1 AND ended = false AND end_time > NOW()',
    [messageId]
  );
  return res.rows[0] || null;
}

async function addGiveawayEntry(giveawayId, userId) {
  const existing = await pool.query(
    'SELECT * FROM giveaway_entries WHERE giveaway_id = $1 AND user_id = $2',
    [giveawayId, userId]
  );
  if (existing.rows.length > 0) return false;
  await pool.query(
    'INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES ($1,$2)',
    [giveawayId, userId]
  );
  return true;
}

async function getGiveawayEntries(giveawayId) {
  const res = await pool.query('SELECT user_id FROM giveaway_entries WHERE giveaway_id = $1', [giveawayId]);
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
    'SELECT * FROM giveaways WHERE guild_id = $1 AND ended = false AND end_time > NOW() ORDER BY end_time ASC',
    [guildId]
  );
  return res.rows;
}

async function getCompletedGiveawaysByGuild(guildId, limit = 10) {
  const res = await pool.query(
    'SELECT * FROM giveaways WHERE guild_id = $1 AND ended = true ORDER BY created_at DESC LIMIT $2',
    [guildId, limit]
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
  const res = await pool.query(
    `INSERT INTO car_giveaways (guild_id, channel_id, message_id, car_model, msrp, shipping_cost, documentation_fee, winners_count, end_time, hosted_by) 
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [guildId, channelId, messageId, carModel, msrp, shippingCost, docFee, winnersCount, endTime, hostedBy]
  );
  return res.rows[0].id;
}

async function getCarGiveaway(messageId) {
  const res = await pool.query(
    'SELECT * FROM car_giveaways WHERE message_id = $1 AND ended = false AND end_time > NOW()',
    [messageId]
  );
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
     VALUES ($1,$2,$3,$4,$5)`,
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
// SYSTEM SETTINGS
// ============================================

async function getSystemSetting(key) {
  const res = await pool.query('SELECT value FROM system_settings WHERE key = $1', [key]);
  if (res.rows.length === 0) return null;
  return res.rows[0].value;
}

async function setSystemSetting(key, value, updatedBy = 'system') {
  await pool.query(
    `INSERT INTO system_settings (key, value, updated_by, updated_at) 
     VALUES ($1, $2, $3, NOW()) 
     ON CONFLICT (key) DO UPDATE SET 
      value = EXCLUDED.value, 
      updated_by = EXCLUDED.updated_by, 
      updated_at = NOW()`,
    [key, JSON.stringify(value), updatedBy]
  );
}

// ============================================
// HEALTH CHECK
// ============================================

async function healthCheck() {
  try {
    await pool.query('SELECT 1');
    return { status: 'healthy', timestamp: new Date().toISOString(), connected: isConnected };
  } catch (err) {
    return { status: 'unhealthy', error: err.message, timestamp: new Date().toISOString(), connected: false };
  }
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function closeDatabase() {
  try {
    await pool.end();
    logger.db('Database connection pool closed');
  } catch (err) {
    logger.error('Error closing database pool:', err.message);
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  initDatabase, pool, testConnection, healthCheck, closeDatabase, isDatabaseConnected,
  
  // Lead Management
  upsertLead, getLead, getStaleLeads, getLeadsByStage, getTopLeads, getLeadsByModel,
  updateLastFollowup, saveTestDriveBooking, getUserBookings, confirmBooking, cancelBooking,
  deleteOldLeads, getLeadStats,
  
  // Guild Configuration
  getGuildConfig, setGuildConfig,
  
  // Ticket System
  saveTicket, closeTicket, getUserOpenTickets, getOpenTicketsByGuild, assignTicket, getTicketStats,
  
  // Interaction Analytics
  logInteraction, getInteractionStats, getUserInteractionCount,
  
  // Auto Post Logs
  logAutoPost, getAutoPostStats,
  
  // Regular Giveaways
  createGiveaway, getGiveaway, addGiveawayEntry, getGiveawayEntries,
  endGiveaway, getGiveawaysByGuild, getCompletedGiveawaysByGuild,
  setGiveawayPingRole, getGiveawayPingRole,
  
  // Car Giveaways
  createCarGiveaway, getCarGiveaway, addCarGiveawayEntry, getCarGiveawayEntries, endCarGiveaway,
  
  // System Settings
  getSystemSetting, setSystemSetting,
};