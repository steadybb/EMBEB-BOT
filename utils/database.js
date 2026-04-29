// utils/database.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Create tables if they don't exist
async function initDatabase() {
  const queries = `
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

    CREATE INDEX IF NOT EXISTS idx_leads_last_interaction ON leads(last_interaction);
    CREATE INDEX IF NOT EXISTS idx_leads_last_followup ON leads(last_followup_sent);
  `;
  await pool.query(queries);
  console.log('[DB] Tables ready');
}

// ------------------------- Lead Management -------------------------
/**
 * Insert or update a lead record.
 * @param {string} userId - Discord user ID
 * @param {string} username - Discord username
 * @param {object} data - { selectedModel, step, tempData, lastInteraction }
 */
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

/**
 * Get a lead's stored data.
 * @param {string} userId
 * @returns {Promise<object|null>} { selectedModel, step, tempData, lastInteraction }
 */
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

/**
 * Get all leads that haven't interacted in X hours and haven't received a follow‑up recently.
 * @param {number} hours - Stale threshold (default 48)
 * @returns {Promise<Array>} List of { user_id, selected_model }
 */
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

/**
 * Update the timestamp when a follow‑up was sent to a lead.
 * @param {string} userId
 */
async function updateLastFollowup(userId) {
  await pool.query('UPDATE leads SET last_followup_sent = NOW() WHERE user_id = $1', [userId]);
}

// ------------------------- Test Drive Bookings -------------------------
/**
 * Save a test drive booking.
 * @param {string} userId
 * @param {string} username
 * @param {string} date - YYYY-MM-DD
 * @param {string} time - HH:MM
 * @param {string} locationType - 'showroom' or 'home'
 * @param {string} threadChannelId - Discord channel ID
 */
async function saveTestDriveBooking(userId, username, date, time, locationType, threadChannelId) {
  // Ensure lead exists first (with minimal info)
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

/**
 * Get all bookings for a user.
 * @param {string} userId
 */
async function getUserBookings(userId) {
  const res = await pool.query(
    'SELECT * FROM test_drive_bookings WHERE user_id = $1 ORDER BY booked_at DESC',
    [userId]
  );
  return res.rows;
}

// ------------------------- Cleanup / Analytics (optional) -------------------------
/**
 * Delete leads older than X days (GDPR / data retention).
 * @param {number} days
 */
async function deleteOldLeads(days = 90) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  await pool.query('DELETE FROM leads WHERE last_interaction < $1', [cutoff]);
}

module.exports = {
  initDatabase,
  upsertLead,
  getLead,
  getStaleLeads,
  updateLastFollowup,
  saveTestDriveBooking,
  getUserBookings,
  deleteOldLeads,
};