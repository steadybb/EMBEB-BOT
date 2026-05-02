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

    -- Guild configuration with all features
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      verify_role_id TEXT,
      verify_enabled BOOLEAN DEFAULT false,
      ticket_category_id TEXT,
      ticket_logs_channel_id TEXT,
      staff_role_id TEXT,
      auto_post_enabled BOOLEAN DEFAULT false,
      auto_post_channels TEXT[] DEFAULT '{}',
      auto_post_interval_hours INTEGER DEFAULT 2,
      lobby_webhook_url TEXT,
      lobby_chatter_enabled BOOLEAN DEFAULT false,
      lobby_chatter_personas JSONB DEFAULT '[]',
      giveaway_ping_role_id TEXT
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

    -- Regular Giveaways
    CREATE TABLE IF NOT EXISTS giveaways (
      id SERIAL PRIMARY KEY,
      guild_id TEXT,
      channel_id TEXT,
      message_id TEXT,
      prize TEXT,
      winners_count INTEGER DEFAULT 1,
      end_time TIMESTAMP,
      hosted_by TEXT,
      entries JSONB DEFAULT '[]',
      winners TEXT[] DEFAULT '{}',
      ended BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS giveaway_entries (
      id SERIAL PRIMARY KEY,
      giveaway_id INTEGER REFERENCES giveaways(id) ON DELETE CASCADE,
      user_id TEXT,
      entered_at TIMESTAMP DEFAULT NOW()
    );

    -- Car Giveaways
    CREATE TABLE IF NOT EXISTS car_giveaways (
      id SERIAL PRIMARY KEY,
      guild_id TEXT,
      channel_id TEXT,
      message_id TEXT,
      car_model TEXT,
      car_year INTEGER DEFAULT 2026,
      car_color TEXT DEFAULT 'Aurora White',
      msrp INTEGER,
      shipping_cost INTEGER DEFAULT 1999,
      documentation_fee INTEGER DEFAULT 499,
      winners_count INTEGER DEFAULT 1,
      entry_fee INTEGER DEFAULT 0,
      end_time TIMESTAMP,
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
      user_id TEXT,
      user_email TEXT,
      user_phone TEXT,
      agreed_to_terms BOOLEAN DEFAULT false,
      entered_at TIMESTAMP DEFAULT NOW()
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_leads_last_interaction ON leads(last_interaction);
    CREATE INDEX IF NOT EXISTS idx_leads_last_followup ON leads(last_followup_sent);
    CREATE INDEX IF NOT EXISTS idx_tickets_guild_id ON tickets(guild_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_giveaways_message_id ON giveaways(message_id);
    CREATE INDEX IF NOT EXISTS idx_car_giveaways_message_id ON car_giveaways(message_id);
  `;
  await pool.query(queries);
  
  // For existing databases, ensure all new columns exist
  const alterQueries = `
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS auto_post_enabled BOOLEAN DEFAULT false;
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS auto_post_channels TEXT[] DEFAULT '{}';
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS auto_post_interval_hours INTEGER DEFAULT 2;
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS lobby_webhook_url TEXT;
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS lobby_chatter_enabled BOOLEAN DEFAULT false;
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS lobby_chatter_personas JSONB DEFAULT '[]';
    ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS giveaway_ping_role_id TEXT;
  `;
  try {
    await pool.query(alterQueries);
  } catch (err) {
    logger.warn('Could not add some columns (they may already exist):', err.message);
  }
  
  logger.db('Tables ready (leads, test_drive_bookings, guild_config, tickets, giveaways, car_giveaways)');
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

// ------------------------- Guild Configuration -------------------------
async function getGuildConfig(guildId) {
  const res = await pool.query('SELECT * FROM guild_config WHERE guild_id = $1', [guildId]);
  if (res.rows.length === 0) {
    return {
      verify_enabled: false,
      auto_post_enabled: false,
      auto_post_channels: [],
      auto_post_interval_hours: 2,
      lobby_chatter_enabled: false,
      lobby_chatter_personas: [],
      giveaway_ping_role_id: null,
    };
  }
  const row = res.rows[0];
  if (row.auto_post_channels && typeof row.auto_post_channels === 'string') {
    row.auto_post_channels = row.auto_post_channels.replace(/[{}]/g, '').split(',').filter(Boolean);
  }
  if (row.lobby_chatter_personas && typeof row.lobby_chatter_personas === 'string') {
    try {
      row.lobby_chatter_personas = JSON.parse(row.lobby_chatter_personas);
    } catch (e) {
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
    auto_post_enabled,
    auto_post_channels,
    auto_post_interval_hours,
    lobby_webhook_url,
    lobby_chatter_enabled,
    lobby_chatter_personas,
    giveaway_ping_role_id,
  } = config;

  await pool.query(
    `INSERT INTO guild_config (
      guild_id, verify_role_id, verify_enabled, ticket_category_id, 
      ticket_logs_channel_id, staff_role_id, 
      auto_post_enabled, auto_post_channels, auto_post_interval_hours,
      lobby_webhook_url, lobby_chatter_enabled, lobby_chatter_personas,
      giveaway_ping_role_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (guild_id) DO UPDATE SET
       verify_role_id = EXCLUDED.verify_role_id,
       verify_enabled = EXCLUDED.verify_enabled,
       ticket_category_id = EXCLUDED.ticket_category_id,
       ticket_logs_channel_id = EXCLUDED.ticket_logs_channel_id,
       staff_role_id = EXCLUDED.staff_role_id,
       auto_post_enabled = EXCLUDED.auto_post_enabled,
       auto_post_channels = EXCLUDED.auto_post_channels,
       auto_post_interval_hours = EXCLUDED.auto_post_interval_hours,
       lobby_webhook_url = EXCLUDED.lobby_webhook_url,
       lobby_chatter_enabled = EXCLUDED.lobby_chatter_enabled,
       lobby_chatter_personas = EXCLUDED.lobby_chatter_personas,
       giveaway_ping_role_id = EXCLUDED.giveaway_ping_role_id`,
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
      lobby_webhook_url || null,
      lobby_chatter_enabled !== undefined ? lobby_chatter_enabled : false,
      lobby_chatter_personas ? JSON.stringify(lobby_chatter_personas) : '[]',
      giveaway_ping_role_id || null,
    ]
  );
}

// ------------------------- Ticket System -------------------------
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

// ------------------------- Giveaway Functions -------------------------
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
  
  await pool.query(
    'UPDATE giveaways SET entries = entries || $2::jsonb WHERE id = $1',
    [giveawayId, JSON.stringify([{ user_id: userId, entered_at: new Date() }])]
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

// ------------------------- Car Giveaway Functions -------------------------
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
  
  await pool.query(
    'UPDATE car_giveaways SET entries = entries || $2::jsonb WHERE id = $1',
    [giveawayId, JSON.stringify([{ user_id: userId, email, phone, entered_at: new Date() }])]
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

module.exports = {
  initDatabase,
  pool,
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
  // regular giveaways
  createGiveaway,
  getGiveaway,
  addGiveawayEntry,
  getGiveawayEntries,
  endGiveaway,
  getGiveawaysByGuild,
  getCompletedGiveawaysByGuild,
  setGiveawayPingRole,
  getGiveawayPingRole,
  // car giveaways
  createCarGiveaway,
  getCarGiveaway,
  addCarGiveawayEntry,
  getCarGiveawayEntries,
  endCarGiveaway,
};