const db = require('./simpledb');
const logger = require('./logger');

/**
 * SYSTÈME DE SOUTIEN - UTILITAIRE CENTRALISÉ
 */

class SoutienSystem {

    getConfig(guildId) {
        return {
            roleId: db.get(`soutien_role_${guildId}`),
            statusText: db.get(`soutien_text_${guildId}`),
            detectionType: db.get(`soutien_type_${guildId}`) || 'contains',
            isActive: db.get(`soutien_active_${guildId}`) || false,
            logsEnabled: db.get(`soutien_logs_${guildId}`) || false,
            logChannel: db.get(`soutien_logchannel_${guildId}`),
            caseSensitive: db.get(`soutien_case_${guildId}`) || false,
        };
    }

    updateConfig(guildId, key, value) {
        db.set(`soutien_${key}_${guildId}`, value);
    }

    /**
     * Vérifie le statut d'un membre
     */
    checkMemberStatus(member, config) {
        if (!member.presence || !member.presence.activities) return false;
        if (!config.statusText) return false;

        const searchText = config.caseSensitive ? config.statusText : config.statusText.toLowerCase();

        for (const activity of member.presence.activities) {
            // On vérifie le Custom Status (state) ou le nom de l'activité
            const fieldsToCheck = [activity.state, activity.name].filter(Boolean);

            for (const field of fieldsToCheck) {
                const fieldText = config.caseSensitive ? field : field.toLowerCase();

                switch (config.detectionType) {
                    case 'contains':
                        if (fieldText.includes(searchText)) return true;
                        break;
                    case 'starts_with':
                        if (fieldText.startsWith(searchText)) return true;
                        break;
                    case 'ends_with':
                        if (fieldText.endsWith(searchText)) return true;
                        break;
                    case 'exact':
                        if (fieldText === searchText) return true;
                        break;
                }
            }
        }
        return false;
    }

    /**
     * Gère le changement de présence
     */
    async handlePresenceUpdate(oldPresence, newPresence) {
        if (!newPresence || !newPresence.guild || !newPresence.member) return;

        const guild = newPresence.guild;
        const member = newPresence.member;
        if (member.user.bot) return;

        // Si le membre passe hors-ligne, on ne lui retire pas son statut de soutien
        if (newPresence.status === 'offline') return;

        const config = this.getConfig(guild.id);
        if (!config.isActive || !config.roleId || !config.statusText) return;

        const role = guild.roles.cache.get(config.roleId);
        if (!role) return;

        try {
            const hasStatus = this.checkMemberStatus(member, config);
            const hasRole = member.roles.cache.has(config.roleId);

            if (hasStatus && !hasRole) {
                await member.roles.add(role);
                if (config.logsEnabled && config.logChannel) {
                    const channel = guild.channels.cache.get(config.logChannel);
                    if (channel) channel.send(`<a:_:1483497369315315786> **${member.user.tag}** a ajouté le statut de soutien. Rôle ajouté.`);
                }
            } else if (!hasStatus && hasRole) {
                await member.roles.remove(role);
                if (config.logsEnabled && config.logChannel) {
                    const channel = guild.channels.cache.get(config.logChannel);
                    if (channel) channel.send(`<a:_:1483497365863399536> **${member.user.tag}** a retiré le statut de soutien. Rôle retiré.`);
                }
            }
        } catch (error) {
            logger.error(`[SOUTIEN] Erreur pour ${member.user.tag}:`, error);
        }
    }
}

module.exports = new SoutienSystem();
