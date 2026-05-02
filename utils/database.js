// utils/database.js
const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Create tables if they don't exist
async function initDatabase() {
  const queries = `
    -- Existing lead tables
    CREATE TABLE IF NOT EXISTS leads (
      user_id TEXT PRIMARY KEY,
      username TEXT,
      selected_model TEXT,
      current_step TEXT,
      temp_data JSONB,
      last_interaction TIMESTAMP,
      last_followup_sent TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS test_drive_bookings (
      id SERIAL PRIMARY KEY,
      user_id TEXT REFERENCES leads(user_id) ON DELETE CASCADE,
      date DATE,
      time TIME,
      location_type TEXT,
      thread_channel_id TEXT,
      booked_at TIMESTAMP DEFAULT NOW()
    );

    -- New tables for verification & ticket system
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      verify_role_id TEXT,
      verify_enabled BOOLEAN DEFAULT false,
      ticket_category_id TEXT,
      ticket_logs_channel_id TEXT,
      staff_role_id TEXT,
      auto_post_enabled BOOLEAN DEFAULT false,
      auto_post_channels TEXT[] DEFAULT '{}',
      auto_post_interval_hours INTEGER DEFAULT 2
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      guild_id TEXT,
      user_id TEXT,
      channel_id TEXT,
      status TEXT DEFAULT 'open',
      created_at TIMESTAMP DEFAULT NOW(),
      closed_at TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_leads_last_interaction ON leads(last_interaction);
    CREATE INDEX IF NOT EXISTS idx_leads_last_followup ON leads(last_followup_sent);
    CREATE INDEX IF NOT EXISTS idx_tickets_guild_id ON tickets(guild_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
  `;
  await pool.query(queries);
  
  // For existing databases, ensure the new columns exist (PostgreSQL 9.6+)
  const alterQueries = `
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS auto_post_enabled BOOLEAN DEFAULT false;
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS auto_post_channels TEXT[] DEFAULT '{}';
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS auto_post_interval_hours INTEGER DEFAULT 2;
  `;
  try {
    await pool.query(alterQueries);
  } catch (err) {
    // If ALTER COLUMN fails (e.g., older PostgreSQL), log and continue
    logger.warn('Could not add auto poster columns (they may already exist):', err.message);
  }
  
  logger.db('Tables ready (leads, test_drive_bookings, guild_config, tickets)');
}

// ------------------------- Lead Management -------------------------
async function upsertLead(userId, username, data) {
  const { selectedModel, step, tempData, lastInteraction } = data;
  const query = `
    INSERT INTO leads (user_id, username, selected_model, current_step, temp_data, last_interaction)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (user_id) DO UPDATE SET
      username = EXCLUDED.username,
      selected_model = EXCLUDED.selected_model,
      current_step = EXCLUDED.current_step,
      temp_data = EXCLUDED.temp_data,
      last_interaction = EXCLUDED.last_interaction
  `;
  await pool.query(query, [
    userId,
    username,
    selectedModel || null,
    step || null,
    tempData ? JSON.stringify(tempData) : '{}',
    lastInteraction || new Date()
  ]);
}

async function getLead(userId) {
  const res = await pool.query('SELECT * FROM leads WHERE user_id = $1', [userId]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    selectedModel: row.selected_model,
    step: row.current_step,
    tempData: row.temp_data || {},
    lastInteraction: row.last_interaction,
  };
}

async function getStaleLeads(hours = 48) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const query = `
    SELECT user_id, selected_model
    FROM leads
    WHERE last_interaction < $1
      AND (last_followup_sent IS NULL OR last_followup_sent < $1 - INTERVAL '24 hours')
  `;
  const res = await pool.query(query, [cutoff]);
  return res.rows;
}

async function updateLastFollowup(userId) {
  await pool.query('UPDATE leads SET last_followup_sent = NOW() WHERE user_id = $1', [userId]);
}

async function saveTestDriveBooking(userId, username, date, time, locationType, threadChannelId) {
  await upsertLead(userId, username, {
    selectedModel: null,
    step: 'test_drive_booked',
    tempData: {},
    lastInteraction: new Date()
  });
  const query = `
    INSERT INTO test_drive_bookings (user_id, date, time, location_type, thread_channel_id)
    VALUES ($1, $2, $3, $4, $5)
  `;
  await pool.query(query, [userId, date, time, locationType, threadChannelId]);
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
  await pool.query('DELETE FROM leads WHERE last_interaction < $1', [cutoff]);
}

// ------------------------- Guild Configuration (updated with auto poster) -------------------------
async function getGuildConfig(guildId) {
  const res = await pool.query('SELECT * FROM guild_config WHERE guild_id = $1', [guildId]);
  if (res.rows.length === 0) {
    return {
      verify_enabled: false,
      auto_post_enabled: false,
      auto_post_channels: [],
      auto_post_interval_hours: 2,
    };
  }
  const row = res.rows[0];
  // Ensure arrays are returned as arrays
  if (row.auto_post_channels && typeof row.auto_post_channels === 'string') {
    row.auto_post_channels = row.auto_post_channels.replace(/[{}]/g, '').split(',').filter(Boolean);
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
    auto_post_enabled,
    auto_post_channels,
    auto_post_interval_hours,
  } = config;

  await pool.query(
    `INSERT INTO guild_config (
      guild_id, verify_role_id, verify_enabled, ticket_category_id, 
      ticket_logs_channel_id, staff_role_id, 
      auto_post_enabled, auto_post_channels, auto_post_interval_hours
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (guild_id) DO UPDATE SET
       verify_role_id = EXCLUDED.verify_role_id,
       verify_enabled = EXCLUDED.verify_enabled,
       ticket_category_id = EXCLUDED.ticket_category_id,
       ticket_logs_channel_id = EXCLUDED.ticket_logs_channel_id,
       staff_role_id = EXCLUDED.staff_role_id,
       auto_post_enabled = EXCLUDED.auto_post_enabled,
       auto_post_channels = EXCLUDED.auto_post_channels,
       auto_post_interval_hours = EXCLUDED.auto_post_interval_hours`,
    [
      guildId,
      verify_role_id || null,
      verify_enabled !== undefined ? verify_enabled : false,
      ticket_category_id || null,
      ticket_logs_channel_id || null,
      staff_role_id || null,
      auto_post_enabled !== undefined ? auto_post_enabled : false,
      auto_post_channels || [],
      auto_post_interval_hours !== undefined ? auto_post_interval_hours : 2,
    ]
  );
}

// ------------------------- Ticket System (unchanged) -------------------------
async function saveTicket(guildId, userId, channelId) {
  await pool.query(
    'INSERT INTO tickets (guild_id, user_id, channel_id) VALUES ($1, $2, $3)',
    [guildId, userId, channelId]
  );
}

async function closeTicket(channelId) {
  await pool.query(
    'UPDATE tickets SET status = $1, closed_at = NOW() WHERE channel_id = $2',
    ['closed', channelId]
  );
}

async function getUserOpenTickets(userId) {
  const res = await pool.query(
    'SELECT * FROM tickets WHERE user_id = $1 AND status = $2',
    [userId, 'open']
  );
  return res.rows;
}

module.exports = {
  initDatabase,
  // lead management
  upsertLead,
  getLead,
  getStaleLeads,
  updateLastFollowup,
  saveTestDriveBooking,
  getUserBookings,
  deleteOldLeads,
  // guild config
  getGuildConfig,
  setGuildConfig,
  // ticket system
  saveTicket,
  closeTicket,
  getUserOpenTickets,
};