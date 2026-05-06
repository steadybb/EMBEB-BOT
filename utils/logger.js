// utils/logger.js
const fs = require('fs');
const path = require('path');
const util = require('util');

// ============================================
// ANSI COLOR CODES
// ============================================
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

// ============================================
// LOG LEVELS WITH EMOJIS
// ============================================
const levels = {
  info:    { emoji: '📘', color: colors.blue,    bg: colors.bgBlue,    name: 'INFO' },
  success: { emoji: '✅', color: colors.green,   bg: colors.bgGreen,   name: 'SUCCESS' },
  warn:    { emoji: '⚠️', color: colors.yellow,  bg: colors.bgYellow,  name: 'WARN' },
  error:   { emoji: '❌', color: colors.red,     bg: colors.bgRed,     name: 'ERROR' },
  debug:   { emoji: '🐛', color: colors.magenta, bg: colors.bgMagenta, name: 'DEBUG' },
  cmd:     { emoji: '⚡', color: colors.cyan,    bg: colors.bgCyan,    name: 'CMD' },
  db:      { emoji: '🗄️', color: colors.cyan,    bg: colors.bgCyan,    name: 'DB' },
  event:   { emoji: '🎯', color: colors.magenta, bg: colors.bgMagenta, name: 'EVENT' },
  ready:   { emoji: '🟢', color: colors.green,   bg: colors.bgGreen,   name: 'READY' },
  api:     { emoji: '🔌', color: colors.yellow,  bg: colors.bgYellow,  name: 'API' },
  webhook: { emoji: '🔗', color: colors.cyan,    bg: colors.bgCyan,    name: 'WEBHOOK' },
  cron:    { emoji: '⏰', color: colors.magenta, bg: colors.bgMagenta, name: 'CRON' },
  test:    { emoji: '🧪', color: colors.white,   bg: colors.bgBlue,    name: 'TEST' },
};

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  logToFile: process.env.LOG_TO_FILE === 'true',
  logLevel: process.env.LOG_LEVEL || 'info',
  maxLogSize: parseInt(process.env.MAX_LOG_SIZE, 10) || 10 * 1024 * 1024, // 10MB default
  maxLogFiles: parseInt(process.env.MAX_LOG_FILES, 10) || 7,
  showTimestamp: process.env.LOG_TIMESTAMP !== 'false',
  showEmoji: process.env.LOG_EMOJI !== 'false',
  colorize: process.env.LOG_COLOR !== 'false',
  separateErrorFile: process.env.LOG_SEPARATE_ERRORS === 'true',
  logToConsole: process.env.LOG_TO_CONSOLE !== 'false',
};

// Log level hierarchy (higher = more verbose)
const levelHierarchy = {
  error: 0,
  warn: 1,
  info: 2,
  success: 2,
  cmd: 2,
  event: 2,
  ready: 2,
  api: 2,
  webhook: 2,
  cron: 2,
  db: 3,
  debug: 4,
  test: 4,
};

// Should this level be logged based on current log level?
function shouldLog(level) {
  const currentLevel = levelHierarchy[CONFIG.logLevel] ?? 2;
  const messageLevel = levelHierarchy[level] ?? 2;
  return messageLevel <= currentLevel;
}

// ============================================
// LOG FILE MANAGEMENT
// ============================================
const logDir = path.join(__dirname, '..', 'logs');

// Ensure logs directory exists
if (CONFIG.logToFile && !fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Get current log file path with date
 */
function getLogFilePath() {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logDir, `bot-${date}.log`);
}

/**
 * Get error log file path
 */
function getErrorLogFilePath() {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logDir, `error-${date}.log`);
}

/**
 * Get formatted date for filenames
 */
function getDateString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Rotate logs - delete old files beyond maxLogFiles
 */
function rotateLogs() {
  if (!CONFIG.logToFile) return;
  
  try {
    const files = fs.readdirSync(logDir)
      .filter(f => (f.startsWith('bot-') || f.startsWith('error-')) && f.endsWith('.log'))
      .sort()
      .reverse();
    
    const botLogs = files.filter(f => f.startsWith('bot-'));
    const errorLogs = files.filter(f => f.startsWith('error-'));
    
    const deleteOldLogs = (logArray) => {
      if (logArray.length > CONFIG.maxLogFiles) {
        const toDelete = logArray.slice(CONFIG.maxLogFiles);
        for (const file of toDelete) {
          const filePath = path.join(logDir, file);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            if (CONFIG.logLevel === 'debug') {
              console.log(`Deleted old log file: ${file}`);
            }
          }
        }
      }
    };
    
    deleteOldLogs(botLogs);
    deleteOldLogs(errorLogs);
    
    // Check current file size for rotation
    const currentLogPath = getLogFilePath();
    if (fs.existsSync(currentLogPath)) {
      const stats = fs.statSync(currentLogPath);
      if (stats.size > CONFIG.maxLogSize) {
        const archiveName = currentLogPath.replace('.log', `-${Date.now()}.log`);
        fs.renameSync(currentLogPath, archiveName);
        if (CONFIG.logLevel === 'debug') {
          console.log(`Rotated large log file: ${path.basename(archiveName)}`);
        }
      }
    }
  } catch (err) {
    console.error('Log rotation error:', err.message);
  }
}

// ============================================
// FORMATTING FUNCTIONS
// ============================================

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 23);
}

function getShortTimestamp() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
}

/**
 * Format a log message with colors and emojis
 */
function formatMessage(level, message, ...args) {
  const time = CONFIG.showTimestamp ? getTimestamp() : '';
  const { emoji, color, bg, name } = levels[level] || levels.info;
  
  let prefix = '';
  
  if (CONFIG.colorize && CONFIG.logToConsole) {
    if (time) prefix += `${colors.dim}${time}${colors.reset} `;
    if (CONFIG.showEmoji && emoji) prefix += `${emoji} `;
    prefix += `${bg}${colors.bright} ${name} ${colors.reset}${color}`;
  } else {
    if (time) prefix += `${time} `;
    if (CONFIG.showEmoji && emoji) prefix += `${emoji} `;
    prefix += `[${name}]`;
  }
  
  // Format args for logging - improved error handling
  let formattedArgs = '';
  if (args && args.length > 0) {
    formattedArgs = args.map(arg => {
      if (arg instanceof Error) {
        const stackLines = (arg.stack || arg.message).split('\n');
        const shortStack = stackLines.slice(0, 3).join('\n');
        return CONFIG.colorize && CONFIG.logToConsole 
          ? `\n${colors.red}${shortStack}${colors.reset}`
          : `\n${shortStack}`;
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          return CONFIG.colorize && CONFIG.logToConsole
            ? `\n${util.inspect(arg, { colors: true, depth: 3 })}`
            : `\n${util.inspect(arg, { colors: false, depth: 3 })}`;
        } catch (err) {
          return `\n[Uninspectable: ${err.message}]`;
        }
      }
      return arg;
    }).join(' ');
  }
  
  return {
    prefix,
    formatted: CONFIG.logToConsole ? `${prefix} ${message}${formattedArgs}${colors.reset}` : `${prefix} ${message}${formattedArgs}`,
    rawArgs: args,
  };
}

// ============================================
// FILE WRITING
// ============================================

function writeToFile(level, message, ...args) {
  if (!CONFIG.logToFile) return;
  
  try {
    const time = getTimestamp();
    const { emoji, name } = levels[level] || levels.info;
    
    const plainArgs = args.map(a => {
      if (a instanceof Error) {
        return `\n${a.stack || a.message}`;
      }
      if (typeof a === 'object' && a !== null) {
        try {
          return `\n${util.inspect(a, { colors: false, depth: 5 })}`;
        } catch {
          return `\n[Object]`;
        }
      }
      return String(a);
    }).join(' ');
    
    const logLine = `[${time}] ${emoji || '📝'} [${name}] ${message} ${plainArgs}\n`.replace(/\x1b\[[0-9;]*m/g, ''); // Strip ANSI colors
    fs.appendFileSync(getLogFilePath(), logLine);
    
    // Write to separate error file if needed
    if (CONFIG.separateErrorFile && (level === 'error' || level === 'warn')) {
      fs.appendFileSync(getErrorLogFilePath(), logLine);
    }
  } catch (err) {
    console.error('Failed to write to log file:', err.message);
  }
}

// ============================================
// CORE LOGGING FUNCTION
// ============================================

function log(level, message, ...args) {
  // Check log level
  if (!shouldLog(level)) return;
  
  const { formatted, rawArgs } = formatMessage(level, message, ...args);
  
  // Console output
  if (CONFIG.logToConsole) {
    if (level === 'error') {
      console.error(formatted, ...rawArgs);
    } else if (level === 'warn') {
      console.warn(formatted, ...rawArgs);
    } else {
      console.log(formatted, ...rawArgs);
    }
  }
  
  // File output
  writeToFile(level, message, ...args);
}

// ============================================
// SPECIFIC LOG METHODS
// ============================================

function info(message, ...args)    { log('info', message, ...args); }
function success(message, ...args) { log('success', message, ...args); }
function warn(message, ...args)    { log('warn', message, ...args); }
function error(message, ...args)   { log('error', message, ...args); }
function debug(message, ...args)   { log('debug', message, ...args); }
function cmd(message, ...args)     { log('cmd', message, ...args); }
function db(message, ...args)      { log('db', message, ...args); }
function event(message, ...args)   { log('event', message, ...args); }
function ready(message, ...args)   { log('ready', message, ...args); }
function api(message, ...args)     { log('api', message, ...args); }
function webhook(message, ...args) { log('webhook', message, ...args); }
function cron(message, ...args)    { log('cron', message, ...args); }
function test(message, ...args)    { log('test', message, ...args); }

// Alias for backward compatibility
module.exports.success = success;

// ============================================
// ADVANCED LOGGING FUNCTIONS
// ============================================

/**
 * Pretty print objects with colors and indentation
 */
function inspect(obj, depth = 3) {
  return util.inspect(obj, { colors: CONFIG.colorize, depth, compact: false, maxArrayLength: 100 });
}

/**
 * Log an object as formatted JSON
 */
function json(label, obj) {
  if (!obj) {
    debug(`${label}: null`);
    return;
  }
  try {
    const formatted = typeof obj === 'object' 
      ? JSON.stringify(obj, null, 2)
      : String(obj);
    debug(`${label}:\n${formatted}`);
  } catch (err) {
    debug(`${label}: [Unable to stringify - ${err.message}]`);
  }
}

/**
 * Log a separator line for visual distinction
 */
function separator(title = '') {
  if (!CONFIG.logToConsole) return;
  
  const line = '━'.repeat(50);
  if (title) {
    console.log(`\n${colors.cyan}${line}${colors.reset}`);
    console.log(`${colors.bright}${colors.white}  ${title}${colors.reset}`);
    console.log(`${colors.cyan}${line}${colors.reset}\n`);
  } else {
    console.log(`${colors.dim}${line}${colors.reset}`);
  }
}

/**
 * Log a table from array of objects
 */
function table(data, columns) {
  if (!CONFIG.logToConsole) return;
  
  if (!Array.isArray(data) || data.length === 0) {
    info('No data to display in table');
    return;
  }
  
  const keys = columns || Object.keys(data[0]);
  const maxWidth = 60;
  const truncatedKeys = keys.map(k => k.substring(0, maxWidth));
  
  console.log(`\n${colors.cyan}┌${'─'.repeat(maxWidth)}┐${colors.reset}`);
  
  // Header
  console.log(`${colors.cyan}│${colors.reset} ${colors.bright}${truncatedKeys.join(' │ ').substring(0, maxWidth)}${colors.reset} ${colors.cyan}│${colors.reset}`);
  console.log(`${colors.cyan}├${'─'.repeat(maxWidth)}┤${colors.reset}`);
  
  // Data rows (limit to 25)
  for (const row of data.slice(0, 25)) {
    const values = keys.map(k => {
      let val = row[k];
      if (val === undefined) return 'N/A';
      if (typeof val === 'object') {
        try {
          return JSON.stringify(val).substring(0, 20);
        } catch {
          return '[Object]';
        }
      }
      return String(val).substring(0, maxWidth - 5);
    });
    console.log(`${colors.cyan}│${colors.reset} ${values.join(' │ ').substring(0, maxWidth)} ${colors.cyan}│${colors.reset}`);
  }
  
  console.log(`${colors.cyan}└${'─'.repeat(maxWidth)}┘${colors.reset}\n`);
}

/**
 * Progress log with percentage
 */
function progress(current, total, label = 'Progress') {
  if (!CONFIG.logToConsole) return;
  if (total <= 0) return;
  
  const percent = Math.min(100, Math.round((current / total) * 100));
  const filledBars = Math.floor(percent / 5);
  const bar = '█'.repeat(filledBars) + '░'.repeat(20 - filledBars);
  
  const output = `\r${colors.cyan}[${bar}]${colors.reset} ${percent}% ${label}...`;
  process.stdout.write(output);
  
  if (current >= total) {
    process.stdout.write('\n');
  }
}

/**
 * Start a timer for performance tracking
 */
const timers = new Map();

function timeStart(label) {
  timers.set(label, Date.now());
  if (shouldLog('debug')) {
    debug(`⏱️  Timer started: ${label}`);
  }
}

function timeEnd(label) {
  const start = timers.get(label);
  if (!start) {
    warn(`Timer "${label}" was never started`);
    return 0;
  }
  const elapsed = Date.now() - start;
  timers.delete(label);
  debug(`⏱️  Timer "${label}": ${elapsed}ms`);
  return elapsed;
}

/**
 * Log and return performance metrics
 */
function timeRecord(label, callback) {
  timeStart(label);
  const result = callback();
  const elapsed = timeEnd(label);
  return { result, elapsed };
}

/**
 * Log HTTP request details
 */
function http(method, url, status, durationMs, metadata = {}) {
  const statusEmoji = status >= 500 ? '🔴' : status >= 400 ? '🟡' : status >= 300 ? '🔵' : '🟢';
  const logMessage = `${statusEmoji} ${method} ${url} → ${status} (${durationMs}ms)`;
  if (metadata && Object.keys(metadata).length > 0) {
    debug(logMessage, metadata);
  } else {
    info(logMessage);
  }
}

// ============================================
// BANNER & STARTUP
// ============================================

/**
 * Display a fancy startup banner
 */
function printBanner(botName = 'BYD BladeBot', version = '2.0.0') {
  if (!CONFIG.logToConsole) return;
  
  const banner = `
${colors.cyan}${colors.bright}╔══════════════════════════════════════════════════╗
║                                                  ║
║   ${colors.white}${botName}${colors.cyan}                          ║
║   ${colors.dim}Version ${version}${colors.cyan}                                ║
║   ${colors.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.cyan}   ║
║   ${colors.green}⚡ Status:${colors.reset} Initializing...                      ${colors.cyan}║
║   ${colors.yellow}🔧 Mode:${colors.reset} ${process.env.NODE_ENV || 'development'}                          ${colors.cyan}║
║   ${colors.magenta}📋 Log Level:${colors.reset} ${CONFIG.logLevel.toUpperCase()}                            ${colors.cyan}║
║                                                  ║
╚══════════════════════════════════════════════════╝${colors.reset}
`;
  console.log(banner);
}

/**
 * Display system info on startup
 */
function printSystemInfo(client) {
  if (!CONFIG.logToConsole) return;
  
  const info = [
    { key: 'Bot Tag', value: client?.user?.tag || 'N/A' },
    { key: 'Bot ID', value: client?.user?.id || 'N/A' },
    { key: 'Guilds', value: client?.guilds?.cache?.size || 0 },
    { key: 'Users', value: client?.users?.cache?.size || 0 },
    { key: 'Node.js', value: process.version },
    { key: 'Platform', value: process.platform },
    { key: 'Memory', value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB` },
    { key: 'Log Level', value: CONFIG.logLevel.toUpperCase() },
    { key: 'File Logging', value: CONFIG.logToFile ? 'Enabled' : 'Disabled' },
  ];
  
  console.log(`\n${colors.cyan}${colors.bright}  📊 System Information${colors.reset}`);
  console.log(`${colors.dim}  ─────────────────────────${colors.reset}`);
  for (const { key, value } of info) {
    console.log(`  ${colors.dim}${key}:${colors.reset} ${colors.white}${value}${colors.reset}`);
  }
  console.log('');
}

/**
 * Display current configuration
 */
function printConfig() {
  if (!CONFIG.logToConsole) return;
  
  console.log(`\n${colors.cyan}${colors.bright}  ⚙️ Logger Configuration${colors.reset}`);
  console.log(`${colors.dim}  ─────────────────────────${colors.reset}`);
  console.log(`  ${colors.dim}Log Level:${colors.reset} ${colors.white}${CONFIG.logLevel}${colors.reset}`);
  console.log(`  ${colors.dim}File Logging:${colors.reset} ${colors.white}${CONFIG.logToFile}${colors.reset}`);
  console.log(`  ${colors.dim}Colorize:${colors.reset} ${colors.white}${CONFIG.colorize}${colors.reset}`);
  console.log(`  ${colors.dim}Show Emoji:${colors.reset} ${colors.white}${CONFIG.showEmoji}${colors.reset}`);
  console.log(`  ${colors.dim}Max Log Size:${colors.reset} ${colors.white}${Math.round(CONFIG.maxLogSize / 1024 / 1024)} MB${colors.reset}`);
  console.log(`  ${colors.dim}Max Log Files:${colors.reset} ${colors.white}${CONFIG.maxLogFiles}${colors.reset}`);
  console.log('');
}

// ============================================
// CLEANUP & MAINTENANCE
// ============================================

let rotationInterval = null;

function startLogRotation() {
  if (rotationInterval) clearInterval(rotationInterval);
  rotationInterval = setInterval(rotateLogs, 3600000); // Run rotation every hour
}

function stopLogRotation() {
  if (rotationInterval) {
    clearInterval(rotationInterval);
    rotationInterval = null;
  }
}

// Start log rotation
startLogRotation();
rotateLogs(); // Run once on startup

// Clean up timers on exit
process.on('beforeExit', () => {
  stopLogRotation();
  for (const [label] of timers) {
    if (shouldLog('warn')) {
      warn(`Timer "${label}" still running on exit`);
    }
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  error('Uncaught Exception:', err);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Basic logging
  info,
  success,
  warn,
  error,
  debug,
  cmd,
  db,
  event,
  ready,
  api,
  webhook,
  cron,
  test,
  
  // Advanced logging
  inspect,
  json,
  separator,
  table,
  progress,
  timeStart,
  timeEnd,
  timeRecord,
  http,
  
  // Display
  printBanner,
  printSystemInfo,
  printConfig,
  
  // Configuration
  setLogLevel: (level) => { 
    if (levelHierarchy[level] !== undefined) {
      CONFIG.logLevel = level; 
      info(`Log level changed to: ${level.toUpperCase()}`);
    } else {
      warn(`Invalid log level: ${level}`);
    }
  },
  getLogLevel: () => CONFIG.logLevel,
  setFileLogging: (enabled) => { CONFIG.logToFile = enabled; },
  setConsoleLogging: (enabled) => { CONFIG.logToConsole = enabled; },
  
  // Raw log function for custom use
  log,
  
  // Colors for external use
  colors,
  
  // Utilities
  rotateLogs,
  startLogRotation,
  stopLogRotation,
};