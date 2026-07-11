const fs = require('fs');
const path = require('path');
const db = require('./simpledb');
const { ChannelType, OverwriteType } = require('discord.js');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function generateBackupId() {
    return Math.random().toString(36).substring(2, 10);
}

// ======================== CREATE BACKUP ========================
async function createBackup(guild) {
    const backupId = generateBackupId();
    
    // Sort roles by position descending
    const roles = Array.from(guild.roles.cache.values())
        .filter(r => !r.managed && r.id !== guild.id) // Exclude bot roles & everyone
        .sort((a, b) => b.position - a.position)
        .map(role => ({
            id: role.id,
            name: role.name,
            color: role.color,
            hoist: role.hoist,
            permissions: role.permissions.bitfield.toString(),
            mentionable: role.mentionable
        }));

    // Everyone role permissions
    const everyoneRole = guild.roles.everyone;
    roles.push({
        id: everyoneRole.id,
        name: everyoneRole.name,
        color: everyoneRole.color,
        hoist: everyoneRole.hoist,
        permissions: everyoneRole.permissions.bitfield.toString(),
        mentionable: everyoneRole.mentionable,
        isEveryone: true
    });

    // Categories
    const categories = Array.from(guild.channels.cache.values())
        .filter(c => c.type === ChannelType.GuildCategory)
        .sort((a, b) => a.position - b.position)
        .map(c => ({
            id: c.id,
            name: c.name,
            permissions: getPermissionOverwrites(c)
        }));

    // Channels
    const channels = Array.from(guild.channels.cache.values())
        .filter(c => c.type !== ChannelType.GuildCategory)
        .sort((a, b) => a.position - b.position)
        .map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            topic: c.topic || null,
            nsfw: c.nsfw || false,
            bitrate: c.bitrate || null,
            userLimit: c.userLimit || null,
            parentId: c.parentId,
            permissions: getPermissionOverwrites(c)
        }));

    // SimpleDB bot config extraction
    const botConfig = {};
    Object.keys(db.readDB() || {}).forEach(key => {
        if (key.includes(guild.id)) {
            botConfig[key] = db.get(key);
        }
    });

    const backupData = {
        id: backupId,
        guildId: guild.id,
        name: guild.name,
        iconURL: guild.iconURL({ dynamic: true }),
        createdAt: Date.now(),
        roles,
        categories,
        channels,
        botConfig
    };

    fs.writeFileSync(path.join(BACKUP_DIR, `${backupId}.json`), JSON.stringify(backupData, null, 2));
    
    return backupId;
}

function getPermissionOverwrites(channel) {
    return Array.from(channel.permissionOverwrites.cache.values()).map(overwrite => ({
        id: overwrite.id,
        type: overwrite.type === OverwriteType.Role ? 'role' : 'member',
        allow: overwrite.allow.bitfield.toString(),
        deny: overwrite.deny.bitfield.toString()
    }));
}

// ======================== LOAD BACKUP ========================
function getBackupInfos() {
    return fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => {
            const data = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, f), 'utf-8'));
            return {
                id: data.id,
                name: data.name,
                createdAt: data.createdAt
            };
        });
}

function getBackupData(backupId) {
    const file = path.join(BACKUP_DIR, `${backupId}.json`);
    if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
    return null;
}

async function loadBackup(guild, backupData, options, progressCallback) {
    // options = { deleteRoles, deleteChannels, loadRoles, loadChannels, loadSettings }
    
    // Mapping IDs
    const roleMapping = new Map(); // oldRoleId -> newRoleId
    roleMapping.set(backupData.guildId, guild.id); // Map old guild id to new everyone role id
    const categoryMapping = new Map(); // oldCategoryId -> newCategoryId

    // 1. DELETE CHANNELS
    if (options.deleteChannels) {
        progressCallback('🗑️ Suppression des anciens salons...');
        const channelsToDelete = Array.from(guild.channels.cache.values());
        for (const ch of channelsToDelete) {
            try { await ch.delete(); } catch(e) {}
        }
    }

    // 2. DELETE ROLES
    if (options.deleteRoles) {
        progressCallback('🗑️ Suppression des anciens rôles...');
        const rolesToDelete = Array.from(guild.roles.cache.values())
            .filter(r => !r.managed && r.id !== guild.id);
        for (const r of rolesToDelete) {
            try { await r.delete(); } catch(e) {}
        }
    }

    // 3. LOAD ROLES
    if (options.loadRoles) {
        progressCallback('📥 Création des nouveaux rôles...');
        for (const r of backupData.roles) {
            if (r.isEveryone) {
                try {
                    await guild.roles.everyone.setPermissions(BigInt(r.permissions));
                    roleMapping.set(r.id, guild.id);
                } catch(e) {}
                continue;
            }
            try {
                const newRole = await guild.roles.create({
                    name: r.name,
                    color: r.color,
                    hoist: r.hoist,
                    permissions: BigInt(r.permissions),
                    mentionable: r.mentionable
                });
                roleMapping.set(r.id, newRole.id);
            } catch(e) { console.error('Error creating role', e) }
        }
    } else {
        // If not loading roles, map by name if they happen to exist? Just a fallback if needed
        for (const r of backupData.roles) {
            const existing = guild.roles.cache.find(role => role.name === r.name);
            if (existing) roleMapping.set(r.id, existing.id);
        }
    }

    // 4. LOAD CHANNELS
    if (options.loadChannels) {
        progressCallback('📥 Création des catégories...');
        for (const c of backupData.categories) {
            try {
                const overwrites = mapOverwrites(c.permissions, roleMapping);
                const newCat = await guild.channels.create({
                    name: c.name,
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: overwrites
                });
                categoryMapping.set(c.id, newCat.id);
            } catch(e) { console.error('Error creating category', e) }
        }

        progressCallback('📥 Création des salons textuels et vocaux...');
        for (const ch of backupData.channels) {
            try {
                const overwrites = mapOverwrites(ch.permissions, roleMapping);
                const newParentId = ch.parentId ? categoryMapping.get(ch.parentId) : null;
                
                // Some fallback for types if undefined
                const options = {
                    name: ch.name,
                    type: ch.type,
                    parent: newParentId,
                    permissionOverwrites: overwrites
                };
                if (ch.type === ChannelType.GuildText) {
                    options.topic = ch.topic;
                    options.nsfw = ch.nsfw;
                } else if (ch.type === ChannelType.GuildVoice) {
                    if (ch.bitrate && ch.bitrate >= 8000 && ch.bitrate <= 96000) options.bitrate = ch.bitrate; // safe ranges
                    options.userLimit = ch.userLimit;
                }

                await guild.channels.create(options);
            } catch(e) { console.error('Error creating channel', e) }
        }
    }

    // 5. LOAD SETTINGS
    if (options.loadSettings && backupData.botConfig) {
        progressCallback('<:_:1483497382279643207> Restauration de la configuration du bot...');
        for (const [key, value] of Object.entries(backupData.botConfig)) {
            // Replace the old guild id in the key with the new guild id if restoring to a different server
            const newKey = key.replace(backupData.guildId, guild.id);
            db.set(newKey, replaceRoleAndChannelIds(value, roleMapping, categoryMapping, guild.channels.cache));
        }
    }

    progressCallback('<a:_:1483497369315315786> Restauration terminée avec succès !');
}

function mapOverwrites(overwrites, roleMapping) {
    const formatted = [];
    for (const ow of overwrites) {
        if (ow.type === 'role') {
            const mappedId = roleMapping.get(ow.id);
            if (mappedId) {
                formatted.push({
                    id: mappedId,
                    allow: BigInt(ow.allow),
                    deny: BigInt(ow.deny)
                });
            }
        }
    }
    return formatted;
}

// Simple recursively ID string replacement for simpledb data
function replaceRoleAndChannelIds(data, roleMapping, categoryMapping, newChannelsCache) {
    if (typeof data === 'string') {
        const mappedRole = roleMapping.get(data);
        if (mappedRole) return mappedRole;
        // Since channels re-created IDs are different, we might lose exact simpledb channel mappings unless we do name-matching.
        // It's safer to just return data. But let's try mapping roles at least (which are most sensitive).
    } else if (Array.isArray(data)) {
        return data.map(item => replaceRoleAndChannelIds(item, roleMapping, categoryMapping, newChannelsCache));
    } else if (data && typeof data === 'object') {
        const newData = {};
        for (const [key, val] of Object.entries(data)) {
            newData[key] = replaceRoleAndChannelIds(val, roleMapping, categoryMapping, newChannelsCache);
        }
        return newData;
    }
    return data;
}

function deleteBackup(backupId) {
    const file = path.join(BACKUP_DIR, `${backupId}.json`);
    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        return true;
    }
    return false;
}

module.exports = {
    createBackup,
    getBackupInfos,
    getBackupData,
    loadBackup,
    deleteBackup
};
