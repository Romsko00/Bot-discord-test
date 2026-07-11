const fs = require('fs');
const path = require('path');
const db = require('./simpledb');

const AccessLevels = {
  SUPERADMIN: 9,
  BUYER: 8,
  OWNER: 7,
  PERM6: 6,
  PERM5: 5,
  PERM4: 4,
  PERM3: 3,
  PERM2: 2,
  PERM1: 1,
  USER: 0
};

let buyersMap = null;
function loadBuyersMap() {
  if (buyersMap) return buyersMap;
  try {
    const p = path.resolve(__dirname, '../data/buyers.json');
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8')) || {};
      buyersMap = raw;
    } else {
      buyersMap = {};
    }
  } catch (_) {
    buyersMap = {};
  }
  return buyersMap;
}

/** Invalide le cache buyers.json (à appeler après modification du fichier) */
function invalidateBuyersCache() {
  buyersMap = null;
}

function isBuyerForClient(client, userId) {
  if (!client) return false;

  // Check DB for buyer scoped to THIS specific bot (set by +buyer command)
  // Format: buyer_bot_{botId}_{userId}
  if (client.user && db.get(`buyer_bot_${client.user.id}_${userId}`)) return true;

  // Legacy fallback: global buyer flag (kept for backwards compat but not set anymore on new buyers)
  if (db.get(`buyer_global_${userId}`)) return true;

  // Vérifier le token du client dans buyers.json
  const token = client.botToken || client.token;
  if (!token) return false;

  const buyers = loadBuyersMap();
  const entry = buyers[userId];
  if (!entry) return false;

  const tokens = Array.isArray(entry) ? entry : [entry];
  return tokens.includes(token);
}

function getExactPermissionLevel(client, message) {
  const authorId = message.author.id;

  // 1. SuperAdmin
  if (client.config.superadmin && client.config.superadmin.includes(authorId)) {
    return AccessLevels.SUPERADMIN;
  }

  // 2. Buyer (Guild-local or Global)
  // Check guild-local buyer flag first (e.g. `buyer_${message.guild.id}_${authorId}`)
  try {
    if (message && message.guild && db.get(`buyer_${message.guild.id}_${authorId}`)) return AccessLevels.BUYER;
  } catch (_) {}

  // Global buyer via DB or buyers.json
  if (isBuyerForClient(client, authorId)) {
    return AccessLevels.BUYER;
  }

  // 3. Owner (Global config or DB)
  if (
    (client.config.owners && client.config.owners.includes(authorId)) ||
    db.get(`ownermd_${client.user.id}_${authorId}`)
  ) {
    return AccessLevels.OWNER;
  }

  // 4. Guild Permissions (1-6)
  let highestLevel = 0;

  // Check User Level Custom Override
  const userLevel = db.get(`userlevel_${message.guild.id}_${authorId}`);
  if (userLevel && typeof userLevel === 'number') {
    highestLevel = Math.max(highestLevel, userLevel);
  }

  // Check Role Levels (nouveau systeme permlevel_ ET vieux systeme modsp_/admin_/ownerp_)
  if (message.member && message.member.roles) {
    for (const role of message.member.roles.cache.values()) {
      const roleLevel = db.get(`permlevel_${message.guild.id}_${role.id}`);
      if (roleLevel && typeof roleLevel === 'number') {
        highestLevel = Math.max(highestLevel, roleLevel);
      }
      // Compatibilite ancien systeme
      if (db.get(`ownerp_${message.guild.id}_${role.id}`))  highestLevel = Math.max(highestLevel, 7);
      if (db.get(`admin_${message.guild.id}_${role.id}`))   highestLevel = Math.max(highestLevel, 6);
      if (db.get(`modsp_${message.guild.id}_${role.id}`))   highestLevel = Math.max(highestLevel, 4);
    }
  }

  return highestLevel;
}

function hasPermissionLevel(client, message, requiredLevel) {
  const userLevel = getExactPermissionLevel(client, message);
  return userLevel >= requiredLevel;
}

function isBotOwner(client, message) {
  return hasPermissionLevel(client, message, AccessLevels.OWNER); // Includes Owner (7), Buyer (8), SuperAdmin (9)
}

function isBuyer(client, message) {
  return hasPermissionLevel(client, message, AccessLevels.BUYER); // Includes Buyer (8), SuperAdmin (9)
} 

function hasTempPermission(message, commandName) {
  const tempKey = `tempperm_${message.guild.id}_${message.author.id}_${message.channel.id}`;
  const tempPerm = db.get(tempKey);
  if (!tempPerm) return false;

  const superadminCommands = ['superadmin', 'owner', 'perm']; // Block dangerous commands for temp perms if needed
  if (superadminCommands.includes(commandName)) return false;

  if (Date.now() > tempPerm.expires) {
    db.delete(tempKey);
    return false;
  }
  return true;
}


// --- Keep old exports but mapped to new logic ---
// 'getUserPermissionLevel' old behavior returned "$" for owners.
// We should return numeric now for consistency, but if code relies on "$", we might need adaptation.
// I will return numeric in getExactPermissionLevel and use that in new commands.
// For legacy compatibility, I'll export getUserPermissionLevel passing through.

function getUserPermissionLevel(client, message) {
  const lvl = getExactPermissionLevel(client, message);
  if (lvl >= AccessLevels.OWNER) return "$";
  return lvl;
}

function setRolePermissionLevel(guildId, roleId, level) {
  if (level < 1 || level > 6) throw new Error('Le niveau doit être entre 1 et 6');
  db.set(`permlevel_${guildId}_${roleId}`, level);
}
function removeRolePermissionLevel(guildId, roleId) {
  db.delete(`permlevel_${guildId}_${roleId}`);
}
function setUserPermissionLevel(guildId, userId, level) {
  if (level < 1 || level > 6) throw new Error('Le niveau doit être entre 1 et 6');
  db.set(`userlevel_${guildId}_${userId}`, level);
}
function removeUserPermissionLevel(guildId, userId) {
  db.delete(`userlevel_${guildId}_${userId}`);
}


module.exports = {
  AccessLevels,
  getExactPermissionLevel,
  getUserPermissionLevel,
  hasPermissionLevel,
  isBotOwner,
  isBuyer,
  isBuyerForClient,
  invalidateBuyersCache,
  setRolePermissionLevel,
  removeRolePermissionLevel,
  hasTempPermission,
  setUserPermissionLevel,
  removeUserPermissionLevel
};
