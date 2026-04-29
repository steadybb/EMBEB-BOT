// utils/logger.js
const fs = require('fs');
const path = require('path');

// ANSI color codes for console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

// Log levels
const levels = {
  info: { emoji: '📘', color: colors.blue, name: 'INFO' },
  success: { emoji: '✅', color: colors.green, name: 'SUCCESS' },
  warn: { emoji: '⚠️', color: colors.yellow, name: 'WARN' },
  error: { emoji: '❌', color: colors.red, name: 'ERROR' },
  debug: { emoji: '🐛', color: colors.magenta, name: 'DEBUG' },
  cmd: { emoji: '⚡', color: colors.cyan, name: 'CMD' },
  db: { emoji: '🗄️', color: colors.cyan, name: 'DB' },
  event: { emoji: '🎯', color: colors.magenta, name: 'EVENT' },
  ready: { emoji: '🟢', color: colors.green, name: 'READY' },
};

// Optional: write logs to a file (set in environment)
const logToFile = process.env.LOG_TO_FILE === 'true';
const logFilePath = path.join(__dirname, '..', 'logs', 'bot.log');

// Ensure logs directory exists if file logging enabled
if (logToFile && !fs.existsSync(path.dirname(logFilePath))) {
  fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

function formatMessage(level, message, ...args) {
  const time = getTimestamp();
  const { emoji, color, name } = levels[level] || levels.info;
  const coloredName = `${color}[${name}]${colors.reset}`;
  const prefix = `${colors.dim}${time}${colors.reset} ${emoji} ${coloredName}`;
  return { prefix, formatted: `${prefix} ${message}`, rawArgs: args };
}

function writeToFile(level, message, ...args) {
  if (!logToFile) return;
  const time = getTimestamp();
  const logLine = `[${time}] [${level.toUpperCase()}] ${message} ${args.map(a => String(a)).join(' ')}\n`;
  fs.appendFileSync(logFilePath, logLine);
}

function log(level, message, ...args) {
  const { formatted, rawArgs } = formatMessage(level, message, ...args);
  const finalArgs = rawArgs.length ? [formatted, ...rawArgs] : [formatted];
  console.log(...finalArgs);
  writeToFile(level, message, ...args);
}

// Specific log methods
function info(message, ...args) { log('info', message, ...args); }
function success(message, ...args) { log('success', message, ...args); }
function warn(message, ...args) { log('warn', message, ...args); }
function error(message, ...args) { log('error', message, ...args); }
function debug(message, ...args) { log('debug', message, ...args); }
function cmd(message, ...args) { log('cmd', message, ...args); }
function db(message, ...args) { log('db', message, ...args); }
function event(message, ...args) { log('event', message, ...args); }
function ready(message, ...args) { log('ready', message, ...args); }

// Pretty print objects with indentation
function inspect(obj, depth = 2) {
  return require('util').inspect(obj, { colors: true, depth, compact: false });
}

// Display a fancy startup banner
function printBanner(botName, version) {
  const banner = `
${colors.bright}${colors.cyan}╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   ${colors.white}${botName} ${colors.dim}v${version}${colors.reset}${colors.cyan}                                    ║
║   ${colors.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}${colors.cyan}   ║
║   ${colors.green}⚡ Status:${colors.reset} Ready for action                         ${colors.cyan}║
║   ${colors.magenta}🎯 Mode:${colors.reset} Production / Debug                        ${colors.cyan}║
║                                                          ║
╚══════════════════════════════════════════════════════════╝${colors.reset}
`;
  console.log(banner);
}

module.exports = {
  info,
  success,
  warn,
  error,
  debug,
  cmd,
  db,
  event,
  ready,
  inspect,
  printBanner,
  setLogLevel: () => {}, // stub for future enhancement
};