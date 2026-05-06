// utils/permissions.js
const { getGuildConfig } = require('./database');
const logger = require('./logger');

// ============================================
// PERMISSION LEVELS
// ============================================
const PermissionLevels = {
  EVERYONE: 0,      // All users
  VERIFIED: 1,      // Verified members
  LEAD: 2,          // Lead role
  STAFF: 3,         // Support staff
  MODERATOR: 4,     // Moderators
  ADMIN: 5,         // Administrators
  OWNER: 6,         // Server owner
  BOT_OWNER: 7,     // Bot owner (from env)
};

const PermissionLevelNames = {
  0: 'Everyone',
  1: 'Verified',
  2: 'Lead',
  3: 'Staff',
  4: 'Moderator',
  5: 'Admin',
  6: 'Owner',
  7: 'Bot Owner',
};

// ============================================
// CORE PERMISSION CHECKS
// ============================================

/**
 * Check if member has Administrator permission
 * @param {GuildMember} member - Discord guild member
 * @returns {boolean} - True if has admin permission
 */
function isAdmin(member) {
  if (!member) return false;
  try {
    return member.permissions?.has('Administrator') === true;
  } catch (err) {
    logger.debug(`Error checking admin permission: ${err.message}`);
    return false;
  }
}

/**
 * Check if member is the server owner
 * @param {GuildMember} member - Discord guild member
 * @returns {boolean} - True if is server owner
 */
function isOwner(member) {
  if (!member?.guild) return false;
  try {
    return member.id === member.guild.ownerId;
  } catch (err) {
    logger.debug(`Error checking owner: ${err.message}`);
    return false;
  }
}

/**
 * Check if member is the bot owner (set in .env)
 * @param {GuildMember} member - Discord guild member
 * @returns {boolean} - True if is bot owner
 */
function isBotOwner(member) {
  if (!member) return false;
  const botOwnerIds = (process.env.BOT_OWNER_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
  return botOwnerIds.includes(member.id);
}

/**
 * Check if member has any admin-level access (Admin, Owner, or Bot Owner)
 * @param {GuildMember} member - Discord guild member
 * @returns {boolean} - True if has admin-level access
 */
function isAdminOrAbove(member) {
  return isAdmin(member) || isOwner(member) || isBotOwner(member);
}

// ============================================
// CONFIG-BASED PERMISSIONS
// ============================================

/**
 * Check if member has the configured staff role
 * @param {GuildMember} member - Discord guild member
 * @returns {Promise<boolean>} - True if has staff role
 */
async function isStaff(member) {
  if (!member?.guild) return false;
  
  // Admin counts as staff
  if (isAdminOrAbove(member)) return true;
  
  try {
    const config = await getGuildConfig(member.guild.id);
    if (!config?.staff_role_id) return false;
    return member.roles.cache.has(config.staff_role_id);
  } catch (err) {
    logger.error('Error checking staff permission:', err.message);
    return false;
  }
}

/**
 * Check if member has the configured lead role
 * @param {GuildMember} member - Discord guild member
 * @returns {Promise<boolean>} - True if has lead role
 */
async function isLead(member) {
  if (!member?.guild) return false;
  
  // Staff counts as lead
  if (await isStaffOrAbove(member)) return true;
  
  // First check for a role named "Lead"
  const leadRole = member.roles.cache.find(r => 
    r.name.toLowerCase() === 'lead'
  );
  if (leadRole) return true;
  
  // Then check database config
  try {
    const config = await getGuildConfig(member.guild.id);
    if (!config?.lead_role_id) return false;
    return member.roles.cache.has(config.lead_role_id);
  } catch (err) {
    logger.error('Error checking lead permission:', err.message);
    return false;
  }
}

/**
 * Check if member has any staff-level access (Staff, Admin, or Owner)
 * @param {GuildMember} member - Discord guild member
 * @returns {Promise<boolean>} - True if has staff-level access
 */
async function isStaffOrAbove(member) {
  if (isAdminOrAbove(member)) return true;
  return isStaff(member);
}

/**
 * Check if member has moderator role
 * @param {GuildMember} member - Discord guild member
 * @returns {Promise<boolean>} - True if has moderator role
 */
async function isModerator(member) {
  if (!member?.guild) return false;
  if (isAdminOrAbove(member)) return true;
  
  // Check config for mod role
  try {
    const config = await getGuildConfig(member.guild.id);
    if (config?.mod_role_id && member.roles.cache.has(config.mod_role_id)) {
      return true;
    }
  } catch {}
  
  // Check by name
  return hasAnyRole(member, ['Moderator', 'Mod', 'ModeratorRole']);
}

// ============================================
// ROLE-BASED CHECKS
// ============================================

/**
 * Check if member has a specific role by name
 * @param {GuildMember} member - Discord guild member
 * @param {string} roleName - Name of the role to check
 * @returns {boolean} - True if has role
 */
function hasRoleByName(member, roleName) {
  if (!member || !roleName) return false;
  try {
    return member.roles.cache.some(r => 
      r.name.toLowerCase() === roleName.toLowerCase()
    );
  } catch {
    return false;
  }
}

/**
 * Check if member has a specific role by ID
 * @param {GuildMember} member - Discord guild member
 * @param {string} roleId - ID of the role to check
 * @returns {boolean} - True if has role
 */
function hasRoleById(member, roleId) {
  if (!member || !roleId) return false;
  try {
    return member.roles.cache.has(roleId);
  } catch {
    return false;
  }
}

/**
 * Check if member has any of the specified roles
 * @param {GuildMember} member - Discord guild member
 * @param {string[]} roleNames - Array of role names to check
 * @returns {boolean} - True if has any of the roles
 */
function hasAnyRole(member, roleNames) {
  if (!member || !roleNames?.length) return false;
  try {
    const lowerRoleNames = roleNames.map(n => n.toLowerCase());
    return member.roles.cache.some(r => 
      lowerRoleNames.includes(r.name.toLowerCase())
    );
  } catch {
    return false;
  }
}

/**
 * Check if member has all of the specified roles
 * @param {GuildMember} member - Discord guild member
 * @param {string[]} roleNames - Array of role names to check
 * @returns {boolean} - True if has all roles
 */
function hasAllRoles(member, roleNames) {
  if (!member || !roleNames?.length) return false;
  try {
    const lowerRoleNames = roleNames.map(n => n.toLowerCase());
    return lowerRoleNames.every(name =>
      member.roles.cache.some(r => r.name.toLowerCase() === name)
    );
  } catch {
    return false;
  }
}

// ============================================
// PERMISSION LEVEL CALCULATION
// ============================================

/**
 * Get the permission level of a member
 * @param {GuildMember} member - Discord guild member
 * @returns {Promise<number>} - Permission level (0-7)
 */
async function getPermissionLevel(member) {
  if (!member) return PermissionLevels.EVERYONE;
  
  // Bot owner (highest)
  if (isBotOwner(member)) return PermissionLevels.BOT_OWNER;
  
  // Server owner
  if (isOwner(member)) return PermissionLevels.OWNER;
  
  // Administrator
  if (isAdmin(member)) return PermissionLevels.ADMIN;
  
  // Staff (from config)
  if (await isStaff(member)) return PermissionLevels.STAFF;
  
  // Moderator
  if (await isModerator(member)) return PermissionLevels.MODERATOR;
  
  // Lead role
  if (await isLead(member)) return PermissionLevels.LEAD;
  
  // Check for verified role
  try {
    const config = await getGuildConfig(member.guild?.id);
    if (config?.verify_role_id && member.roles.cache.has(config.verify_role_id)) {
      return PermissionLevels.VERIFIED;
    }
  } catch {}
  
  return PermissionLevels.EVERYONE;
}

/**
 * Get the permission level name for display
 * @param {number} level - Permission level number
 * @returns {string} - Human-readable permission level name
 */
function getPermissionLevelName(level) {
  return PermissionLevelNames[level] || 'Unknown';
}

/**
 * Check if a member meets a required permission level
 * @param {GuildMember} member - Discord guild member
 * @param {number} requiredLevel - Required permission level
 * @returns {Promise<boolean>} - True if meets requirement
 */
async function hasPermissionLevel(member, requiredLevel) {
  const userLevel = await getPermissionLevel(member);
  return userLevel >= requiredLevel;
}

// ============================================
// PERMISSION GUARDS (for commands)
// ============================================

/**
 * Guard: Requires bot owner only
 * @param {CommandInteraction} interaction - Discord interaction
 * @returns {Promise<boolean>} - True if allowed
 */
async function requireBotOwner(interaction) {
  if (!isBotOwner(interaction.member)) {
    await interaction.reply({ 
      content: '❌ This command is restricted to the bot owner only.', 
      ephemeral: true 
    });
    logPermissionCheck(interaction.member, interaction.commandName, false);
    return false;
  }
  logPermissionCheck(interaction.member, interaction.commandName, true);
  return true;
}

/**
 * Guard: Requires admin or above
 * @param {CommandInteraction} interaction - Discord interaction
 * @returns {Promise<boolean>} - True if allowed
 */
async function requireAdmin(interaction) {
  if (!isAdminOrAbove(interaction.member)) {
    await interaction.reply({ 
      content: '❌ This command requires Administrator permissions.', 
      ephemeral: true 
    });
    logPermissionCheck(interaction.member, interaction.commandName, false);
    return false;
  }
  logPermissionCheck(interaction.member, interaction.commandName, true);
  return true;
}

/**
 * Guard: Requires staff or above
 * @param {CommandInteraction} interaction - Discord interaction
 * @returns {Promise<boolean>} - True if allowed
 */
async function requireStaff(interaction) {
  if (!await isStaffOrAbove(interaction.member)) {
    const config = await getGuildConfig(interaction.guildId);
    const staffRole = config?.staff_role_id 
      ? `<@&${config.staff_role_id}>` 
      : 'Staff';
    await interaction.reply({ 
      content: `❌ This command requires ${staffRole} permissions.`, 
      ephemeral: true 
    });
    logPermissionCheck(interaction.member, interaction.commandName, false);
    return false;
  }
  logPermissionCheck(interaction.member, interaction.commandName, true);
  return true;
}

/**
 * Guard: Requires lead or above
 * @param {CommandInteraction} interaction - Discord interaction
 * @returns {Promise<boolean>} - True if allowed
 */
async function requireLead(interaction) {
  const isLeadUser = await isLead(interaction.member);
  if (!isLeadUser && !await isStaffOrAbove(interaction.member)) {
    await interaction.reply({ 
      content: '❌ This feature is for Leads only. Ask an admin to assign you the Lead role.', 
      ephemeral: true 
    });
    logPermissionCheck(interaction.member, interaction.commandName, false);
    return false;
  }
  logPermissionCheck(interaction.member, interaction.commandName, true);
  return true;
}

/**
 * Guard: Requires specific permission level
 * @param {CommandInteraction} interaction - Discord interaction
 * @param {number} requiredLevel - Required permission level
 * @returns {Promise<boolean>} - True if allowed
 */
async function requirePermissionLevel(interaction, requiredLevel) {
  const userLevel = await getPermissionLevel(interaction.member);
  if (userLevel < requiredLevel) {
    const requiredName = getPermissionLevelName(requiredLevel);
    await interaction.reply({ 
      content: `❌ This command requires **${requiredName}** permissions.`, 
      ephemeral: true 
    });
    logPermissionCheck(interaction.member, interaction.commandName, false);
    return false;
  }
  logPermissionCheck(interaction.member, interaction.commandName, true);
  return true;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get a list of all admin users in a guild
 * @param {Guild} guild - Discord guild
 * @returns {Promise<Array>} - Array of admin users
 */
async function getAdminUsers(guild) {
  if (!guild) return [];
  
  const admins = [];
  const addedUserIds = new Set();
  
  // Server owner
  try {
    const owner = await guild.fetchOwner();
    if (!addedUserIds.has(owner.id)) {
      admins.push({ user: owner.user, level: 'Owner', id: owner.id });
      addedUserIds.add(owner.id);
    }
  } catch {}
  
  // Users with Administrator permission
  try {
    const adminMembers = guild.members.cache.filter(m => 
      m.permissions?.has('Administrator') && m.id !== guild.ownerId
    );
    for (const [, member] of adminMembers) {
      if (!addedUserIds.has(member.id)) {
        admins.push({ user: member.user, level: 'Admin', id: member.id });
        addedUserIds.add(member.id);
      }
    }
  } catch {}
  
  // Staff role members
  try {
    const config = await getGuildConfig(guild.id);
    if (config?.staff_role_id) {
      const staffRole = guild.roles.cache.get(config.staff_role_id);
      if (staffRole) {
        for (const [, member] of staffRole.members) {
          if (!addedUserIds.has(member.id)) {
            admins.push({ user: member.user, level: 'Staff', id: member.id });
            addedUserIds.add(member.id);
          }
        }
      }
    }
  } catch {}
  
  return admins;
}

/**
 * Check if a channel is hidden/private to the user
 * @param {GuildMember} member - Discord guild member
 * @param {GuildChannel} channel - Discord channel
 * @returns {boolean} - True if user can view channel
 */
function canViewChannel(member, channel) {
  if (!member || !channel) return false;
  try {
    return channel.permissionsFor(member)?.has('ViewChannel') === true;
  } catch {
    return false;
  }
}

/**
 * Check if member can send messages in a channel
 * @param {GuildMember} member - Discord guild member
 * @param {GuildChannel} channel - Discord channel
 * @returns {boolean} - True if user can send messages
 */
function canSendMessages(member, channel) {
  if (!member || !channel) return false;
  try {
    return channel.permissionsFor(member)?.has('SendMessages') === true;
  } catch {
    return false;
  }
}

/**
 * Check if member can manage messages in a channel
 * @param {GuildMember} member - Discord guild member
 * @param {GuildChannel} channel - Discord channel
 * @returns {boolean} - True if user can manage messages
 */
function canManageMessages(member, channel) {
  if (!member || !channel) return false;
  if (isAdmin(member)) return true;
  try {
    return channel.permissionsFor(member)?.has('ManageMessages') === true;
  } catch {
    return false;
  }
}

/**
 * Log permission check for auditing
 * @param {GuildMember} member - Discord guild member
 * @param {string} action - Action being performed
 * @param {boolean} allowed - Whether permission was granted
 */
function logPermissionCheck(member, action, allowed) {
  const status = allowed ? 'ALLOWED' : 'DENIED';
  const userId = member?.user?.id || member?.id || 'unknown';
  const userName = member?.user?.tag || member?.user?.username || 'unknown';
  logger.debug(`Permission ${status} | ${userName} (${userId}) | ${action}`);
}

/**
 * Get highest role color for a member
 * @param {GuildMember} member - Discord guild member
 * @returns {string} - Hex color code
 */
function getHighestRoleColor(member) {
  if (!member) return '#99AAB5';
  
  try {
    const highestRole = member.roles.cache
      .filter(r => r.color !== 0)
      .sort((a, b) => b.position - a.position)
      .first();
    
    return highestRole ? highestRole.hexColor : '#99AAB5';
  } catch {
    return '#99AAB5';
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Permission levels enum
  PermissionLevels,
  PermissionLevelNames,
  
  // Basic checks
  isAdmin,
  isOwner,
  isBotOwner,
  isAdminOrAbove,
  
  // Config-based checks
  isStaff,
  isLead,
  isStaffOrAbove,
  isModerator,
  
  // Role checks
  hasRoleByName,
  hasRoleById,
  hasAnyRole,
  hasAllRoles,
  
  // Permission level
  getPermissionLevel,
  getPermissionLevelName,
  hasPermissionLevel,
  
  // Guards (for slash commands)
  requireBotOwner,
  requireAdmin,
  requireStaff,
  requireLead,
  requirePermissionLevel,
  
  // Utilities
  getAdminUsers,
  canViewChannel,
  canSendMessages,
  canManageMessages,
  logPermissionCheck,
  getHighestRoleColor,
};