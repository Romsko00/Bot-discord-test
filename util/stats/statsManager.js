
const Discord = require('discord.js');
const db = require('../../utils/simpledb');
const logger = require('../../utils/logger');

const STAT_CONFIGS = {
    total_members: { 
        name: 'Membres', 
        emoji: '👥', 
        placeholder: '(members)', 
        getValue: (g) => g.memberCount 
    },
    online_members: { 
        name: 'En ligne', 
        emoji: '🟢', 
        placeholder: '(online)', 
        getValue: (g) => g.members.cache.filter(m => m.presence?.status && m.presence.status !== 'offline').size 
    },
    voice_members: { 
        name: 'Vocal', 
        emoji: '🎤', 
        placeholder: '(in_voc)', 
        getValue: (g) => g.channels.cache.filter(c => [Discord.ChannelType.GuildVoice, Discord.ChannelType.GuildStageVoice].includes(c.type)).reduce((acc, channel) => acc + channel.members.size, 0) 
    },
    bots: { 
        name: 'Bots', 
        emoji: '🤖', 
        placeholder: '(bots)', 
        getValue: (g) => g.members.cache.filter(m => m.user.bot).size 
    },
    channels: { 
        name: 'Salons', 
        emoji: '📢', 
        placeholder: '(channels)', 
        getValue: (g) => g.channels.cache.size 
    },
    boosts: { 
        name: 'Boosts', 
        emoji: '⚡', 
        placeholder: '(boosts)', 
        getValue: (g) => g.premiumSubscriptionCount || 0 
    },
    boost_level: {
        name: 'Niveau Boost',
        emoji: '💎',
        placeholder: '(boost_level)',
        getValue: (g) => g.premiumTier
    },
    stage_members: {
        name: 'Membres Stage',
        emoji: '🎭',
        placeholder: '(stage_members)',
        getValue: (g) => g.channels.cache.filter(c => c.type === Discord.ChannelType.GuildStageVoice).reduce((acc, channel) => acc + channel.members.size, 0)
    }
};

/**
 * Met à jour les salons de statistiques pour un serveur donné
 */
async function updateStatsChannels(guild, client) {
    const config = db.get(`statsvocals_${guild.id}`);
    if (!config || !config.channels || !Array.isArray(config.channels)) return;

    // S'assurer que les membres sont cachés pour les stats online
    if (config.channels.some(c => c.statKey === 'online_members' || c.statKey === 'bots')) {
        try {
            await guild.members.fetch();
        } catch (e) {
            logger.error(`[STATS] Impossible de fetch les membres pour ${guild.name}:`, e.message);
        }
    }

    for (const channelData of config.channels) {
        try {
            const channel = guild.channels.cache.get(channelData.channelId);
            const statConfig = STAT_CONFIGS[channelData.statKey];

            if (channel && statConfig) {
                const value = statConfig.getValue(guild);
                const format = channelData.format || `${statConfig.emoji} ${statConfig.name} : ${statConfig.placeholder}`;
                const newName = format.replace(statConfig.placeholder, value.toLocaleString('fr-FR'));

                if (channel.name !== newName) {
                    await channel.setName(newName).catch(err => {
                        if (err.code === 50035) return; // Rate limit ou nom invalide
                        throw err;
                    });
                }
            }
        } catch (error) {
            // Ne pas logger si c'est juste que le salon a été supprimé
            if (error.code !== 10003) {
                logger.error(`[STATS] Erreur mise à jour salon ${channelData.channelId} (${guild.name}):`, error.message);
            }
        }
    }
}

/**
 * Démarre le cycle de mise à jour automatique
 */
function initStatsInterval(clients) {
    logger.info('[STATS] Initialisation du cycle de mise à jour des statistiques (5 min)');
    
    setInterval(async () => {
        for (const client of clients) {
            if (!client || !client.isReady()) continue;
            
            for (const guild of client.guilds.cache.values()) {
                // Un seul client s'occupe du serveur (celui qui est responsable)
                if (typeof client.isResponsibleForGuild === 'function' && client.isResponsibleForGuild(guild.id)) {
                    await updateStatsChannels(guild, client);
                }
            }
        }
    }, 300000); // 5 minutes
}

module.exports = {
    updateStatsChannels,
    initStatsInterval,
    STAT_CONFIGS
};
