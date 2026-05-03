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

// ============================================
// CORE PERMISSION CHECKS
// ============================================

/**
 * Check if member has Administrator permission
 */
function isAdmin(member) {
  if (!member) return false;
  return member.permissions.has('Administrator');
}

/**
 * Check if member is the server owner
 */
function isOwner(member) {
  if (!member?.guild) return false;
  return member.id === member.guild.ownerId;
}

/**
 * Check if member is the bot owner (set in .env)
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
 */
function isAdminOrAbove(member) {
  return isAdmin(member) || isOwner(member) || isBotOwner(member);
}

// ============================================
// CONFIG-BASED PERMISSIONS
// ============================================

/**
 * Check if member has the configured staff role
 */
async function isStaff(member) {
  if (!member?.guild) return false;
  
  try {
    const config = await getGuildConfig(member.guild.id);
    if (!config?.staff_role_id) return false;
    return member.roles.cache.has(config.staff_role_id);
  } catch (err) {
    logger.error('Error checking staff permission:', err);
    return false;
  }
}

/**
 * Check if member has the configured lead role
 */
async function isLead(member) {
  if (!member?.guild) return false;
  
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
  } catch {
    return false;
  }
}

/**
 * Check if member has any staff-level access (Staff, Admin, or Owner)
 */
async function isStaffOrAbove(member) {
  if (isAdminOrAbove(member)) return true;
  return isStaff(member);
}

// ============================================
// ROLE-BASED CHECKS
// ============================================

/**
 * Check if member has a specific role by name
 */
function hasRoleByName(member, roleName) {
  if (!member) return false;
  return member.roles.cache.some(r => 
    r.name.toLowerCase() === roleName.toLowerCase()
  );
}

/**
 * Check if member has a specific role by ID
 */
function hasRoleById(member, roleId) {
  if (!member || !roleId) return false;
  return member.roles.cache.has(roleId);
}

/**
 * Check if member has any of the specified roles
 */
function hasAnyRole(member, roleNames) {
  if (!member || !roleNames?.length) return false;
  return member.roles.cache.some(r => 
    roleNames.some(name => r.name.toLowerCase() === name.toLowerCase())
  );
}

/**
 * Check if member has all of the specified roles
 */
function hasAllRoles(member, roleNames) {
  if (!member || !roleNames?.length) return false;
  return roleNames.every(name =>
    member.roles.cache.some(r => r.name.toLowerCase() === name.toLowerCase())
  );
}

// ============================================
// PERMISSION LEVEL CALCULATION
// ============================================

/**
 * Get the permission level of a member
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
  
  // Lead role
  if (await isLead(member)) return PermissionLevels.LEAD;
  
  // Check for moderator roles
  if (hasAnyRole(member, ['Moderator', 'Mod', 'Staff'])) return PermissionLevels.MODERATOR;
  
  // Check for verified role
  try {
    const config = await getGuildConfig(member.guild?.id);
    if (config?.verify_role_id && member.roles.cache.has(config.verify_role_id)) {
      return PermissionLevels.VERIFIED;
    }
  } catch {}
  
  return PermissionLevels.EVERYONE;
}

// ============================================
// PERMISSION GUARDS (for commands)
// ============================================

/**
 * Guard: Requires bot owner only
 */
async function requireBotOwner(interaction) {
  if (!isBotOwner(interaction.member)) {
    await interaction.reply({ 
      content: '❌ This command is restricted to the bot owner only.', 
      ephemeral: true 
    });
    return false;
  }
  return true;
}

/**
 * Guard: Requires admin or above
 */
async function requireAdmin(interaction) {
  if (!isAdminOrAbove(interaction.member)) {
    await interaction.reply({ 
      content: '❌ This command requires Administrator permissions.', 
      ephemeral: true 
    });
    return false;
  }
  return true;
}

/**
 * Guard: Requires staff or above
 */
async function requireStaff(interaction) {
  if (!await isStaffOrAbove(interaction.member)) {
    await interaction.reply({ 
      content: '❌ This command requires Staff permissions.', 
      ephemeral: true 
    });
    return false;
  }
  return true;
}

/**
 * Guard: Requires lead or above
 */
async function requireLead(interaction) {
  const isLeadUser = await isLead(interaction.member);
  if (!isLeadUser && !await isStaffOrAbove(interaction.member)) {
    await interaction.reply({ 
      content: '❌ This feature is for Leads only. Ask an admin to assign you the Lead role.', 
      ephemeral: true 
    });
    return false;
  }
  return true;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get a list of all admin users in a guild
 */
async function getAdminUsers(guild) {
  if (!guild) return [];
  
  const admins = [];
  
  // Server owner
  try {
    const owner = await guild.fetchOwner();
    admins.push({ user: owner.user, level: 'Owner' });
  } catch {}
  
  // Users with Administrator permission
  const adminMembers = guild.members.cache.filter(m => 
    m.permissions.has('Administrator') && m.id !== guild.ownerId
  );
  for (const [, member] of adminMembers) {
    admins.push({ user: member.user, level: 'Admin' });
  }
  
  // Staff role members
  try {
    const config = await getGuildConfig(guild.id);
    if (config?.staff_role_id) {
      const staffRole = guild.roles.cache.get(config.staff_role_id);
      if (staffRole) {
        for (const [, member] of staffRole.members) {
          if (!admins.some(a => a.user.id === member.id)) {
            admins.push({ user: member.user, level: 'Staff' });
          }
        }
      }
    }
  } catch {}
  
  return admins;
}

/**
 * Check if a channel is hidden/private to the user
 */
function canViewChannel(member, channel) {
  if (!member || !channel) return false;
  return channel.permissionsFor(member)?.has('ViewChannel') ?? false;
}

/**
 * Check if member can send messages in a channel
 */
function canSendMessages(member, channel) {
  if (!member || !channel) return false;
  return channel.permissionsFor(member)?.has('SendMessages') ?? false;
}

/**
 * Log permission check for auditing
 */
function logPermissionCheck(member, action, allowed) {
  const status = allowed ? '✅ ALLOWED' : '❌ DENIED';
  logger.debug(`Permission: ${status} | ${member?.user?.tag} | ${action}`);
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Permission levels enum
  PermissionLevels,
  
  // Basic checks
  isAdmin,
  isOwner,
  isBotOwner,
  isAdminOrAbove,
  
  // Config-based checks
  isStaff,
  isLead,
  isStaffOrAbove,
  
  // Role checks
  hasRoleByName,
  hasRoleById,
  hasAnyRole,
  hasAllRoles,
  
  // Permission level
  getPermissionLevel,
  
  // Guards (for slash commands)
  requireBotOwner,
  requireAdmin,
  requireStaff,
  requireLead,
  
  // Utilities
  getAdminUsers,
  canViewChannel,
  canSendMessages,
  logPermissionCheck,
};