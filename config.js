// config.js – safe version
require('dotenv').config();

module.exports = {
  // ============================================
  // DISCORD BOT (REQUIRED)
  // ============================================
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  guildId: process.env.GUILD_ID,
  
  // Bot owners (comma-separated Discord IDs)
  botOwners: (process.env.BOT_OWNER_IDS || '').split(',').map(id => id.trim()).filter(Boolean),

  // ============================================
  // DATABASE
  // ============================================
  database: {
    url: process.env.DATABASE_URL,
    poolMax: parseInt(process.env.DB_POOL_MAX, 10) || 20,
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT, 10) || 10000,
  },

  // ============================================
  // WEB SERVER
  // ============================================
  port: parseInt(process.env.PORT, 10) || 3000,
  staticUrl: process.env.STATIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,

  // ============================================
  // OPENROUTER API (AI Content Generation)
  // ============================================
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultModel: process.env.AI_DEFAULT_MODEL || 'openai/gpt-3.5-turbo',
    fallbackModels: [
      'google/gemini-flash-1.5',
      'anthropic/claude-instant-1.2',
      'meta-llama/llama-3.2-3b-instruct',
    ],
    maxTokens: parseInt(process.env.AI_MAX_TOKENS, 10) || 500,
    temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.8,
    timeout: parseInt(process.env.AI_TIMEOUT, 10) || 15000,
    maxRetries: parseInt(process.env.AI_MAX_RETRIES, 10) || 1,
  },

  // ============================================
  // AUTO POSTER
  // ============================================
  autoPost: {
    channels: (process.env.AUTO_POST_CHANNELS || '').split(',').map(id => id.trim()).filter(Boolean),
    schedule: process.env.AUTO_POST_SCHEDULE || '0 */2 * * *',
    postToAllChannels: process.env.AUTO_POST_ALL_CHANNELS === 'true',
    runOnStartup: process.env.AUTO_POST_ON_STARTUP === 'true',
    minDelayBetweenPosts: parseInt(process.env.AUTO_POST_MIN_DELAY, 10) || 5000,
    useFallback: process.env.USE_FALLBACK_CONTENT !== 'false',
  },

  // ============================================
  // LOBBY CHATTER
  // ============================================
  lobbyChatter: {
    schedule: process.env.LOBBY_CHATTER_SCHEDULE || '*/2 * * * *',
    minDelay: 30000,
    maxDelay: 120000,
    avatarStyle: process.env.LOBBY_AVATAR_STYLE || 'ui-avatars',
  },

  // ============================================
  // FOLLOW-UP SCHEDULER
  // ============================================
  followUp: {
    schedule: process.env.FOLLOWUP_SCHEDULE || '0 * * * *',
    staleLeadHours: parseInt(process.env.STALE_LEAD_HOURS, 10) || 48,
  },

  // ============================================
  // VERIFICATION SYSTEM
  // ============================================
  verification: {
    defaultEnabled: process.env.VERIFY_DEFAULT_ENABLED === 'true',
    buttonLabel: process.env.VERIFY_BUTTON_LABEL || '✅ Verify Me',
  },

  // ============================================
  // TICKET SYSTEM
  // ============================================
  tickets: {
    maxOpenPerUser: parseInt(process.env.MAX_OPEN_TICKETS, 10) || 1,
    closeDelay: parseInt(process.env.TICKET_CLOSE_DELAY, 10) || 5000,
    categoryName: process.env.TICKET_CATEGORY_NAME || 'Tickets',
  },

  // ============================================
  // GIVEAWAYS
  // ============================================
  giveaways: {
    defaultDuration: parseInt(process.env.GIVEAWAY_DEFAULT_DURATION, 10) || 24,
    defaultWinners: parseInt(process.env.GIVEAWAY_DEFAULT_WINNERS, 10) || 1,
    carGiveawayShipping: parseInt(process.env.CAR_GIVEAWAY_SHIPPING, 10) || 1999,
    carGiveawayDocFee: parseInt(process.env.CAR_GIVEAWAY_DOC_FEE, 10) || 499,
  },

  // ============================================
  // BYD PRICING DEFAULTS
  // ============================================
  pricing: {
    registrationFee: parseInt(process.env.REGISTRATION_FEE, 10) || 450,
    deliveryFee: parseInt(process.env.DELIVERY_FEE, 10) || 895,
    docFee: parseInt(process.env.DOC_FEE, 10) || 299,
    taxRate: parseFloat(process.env.TAX_RATE) || 0.0425,
    financeTerm: parseInt(process.env.FINANCE_TERM, 10) || 60,
    financeRate: parseFloat(process.env.FINANCE_RATE) || 0.0399,
    leaseTerm: parseInt(process.env.LEASE_TERM, 10) || 36,
    leaseResidual: parseFloat(process.env.LEASE_RESIDUAL) || 0.55,
  },

  // ============================================
  // LOGGING
  // ============================================
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    toFile: process.env.LOG_TO_FILE === 'true',
    showTimestamp: process.env.LOG_TIMESTAMP !== 'false',
    showEmoji: process.env.LOG_EMOJI !== 'false',
    colorize: process.env.LOG_COLOR !== 'false',
    maxLogSize: parseInt(process.env.MAX_LOG_SIZE, 10) || 10485760,
    maxLogFiles: parseInt(process.env.MAX_LOG_FILES, 10) || 7,
  },

  // ============================================
  // STATE MANAGEMENT
  // ============================================
  state: {
    cacheTTL: parseInt(process.env.STATE_CACHE_TTL, 10) || 60000,
    maxCacheSize: parseInt(process.env.STATE_MAX_CACHE, 10) || 1000,
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 1800000,
  },

  // ============================================
  // ENVIRONMENT
  // ============================================
  environment: process.env.NODE_ENV || 'development',
  get isProduction() {
    return this.environment === 'production';
  },
  get isDevelopment() {
    return this.environment !== 'production';
  },
};