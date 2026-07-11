const Discord = require('discord.js');
const db = require('./simpledb');
const logger = require('./logger');
const { EmbedBuilder } = require('discord.js');

/**
 * SYSTÈME DE BIENVENUE - UTILITAIRE CENTRALISÉ
 */

class WelcomeSystem {
    /**
     * Récupère la configuration complète
     */
    getConfig(guildId) {
        return {
            channelId: db.get(`joinchannelmessage_${guildId}`),
            style: db.get(`welcomestyle_${guildId}`) || 'message',
            message: db.get(`joinmessage_${guildId}`),
            embed: db.get(`joinmessageembed_${guildId}`),
            dmMessage: db.get(`joindmee_${guildId}`),
            autoroleId: db.get(`autorole_${guildId}`),
            enabled: db.get(`welcome_enabled_${guildId}`) !== false
        };
    }

    /**
     * Sauvegarde la configuration
     */
    saveConfig(guildId, config) {
        if (config.channelId !== undefined) db.set(`joinchannelmessage_${guildId}`, config.channelId);
        if (config.style !== undefined) db.set(`welcomestyle_${guildId}`, config.style);
        if (config.message !== undefined) db.set(`joinmessage_${guildId}`, config.message);
        if (config.embed !== undefined) db.set(`joinmessageembed_${guildId}`, config.embed);
        if (config.dmMessage !== undefined) db.set(`joindmee_${guildId}`, config.dmMessage);
        if (config.autoroleId !== undefined) db.set(`autorole_${guildId}`, config.autoroleId);
        if (config.enabled !== undefined) db.set(`welcome_enabled_${guildId}`, config.enabled);
    }

    /**
     * Formate un template avec les variables
     */
    formatTemplate(text, member, inviter = null, inviteCount = 0) {
        if (!text || !member || !member.user || !member.guild) return text;

        try {
            const invName = inviter ? inviter.username : 'Inconnu';
            const invTag = inviter ? (inviter.tag || `${inviter.username}#0000`) : 'Inconnu';
            const invId = inviter ? inviter.id : 'Inconnu';
            const memberCounter = member.guild.memberCount;

            return String(text)
                .replaceAll('{user}', member.toString())
                .replaceAll('{user:mention}', member.toString())
                .replaceAll('{user:name}', member.user.username)
                .replaceAll('{user:tag}', member.user.tag || `${member.user.username}#0000`)
                .replaceAll('{user:id}', member.user.id)
                .replaceAll('{inviter}', inviter ? inviter.toString() : 'Inconnu')
                .replaceAll('{inviter:mention}', inviter ? inviter.toString() : 'Inconnu')
                .replaceAll('{inviter:name}', invName)
                .replaceAll('{inviter:tag}', invTag)
                .replaceAll('{inviter:id}', invId)
                .replaceAll('{invite}', String(inviteCount))
                .replaceAll('{invites}', String(inviteCount))
                .replaceAll('{invite:count}', String(inviteCount))
                .replaceAll('{membre:counter}', String(memberCounter))
                .replaceAll('{member:counter}', String(memberCounter))
                .replaceAll('{member:count}', String(memberCounter))
                .replaceAll('{guild:name}', member.guild.name)
                .replaceAll('{guild:members}', String(member.guild.memberCount))
                .replaceAll('{server:name}', member.guild.name)
                .replaceAll('{server:members}', String(member.guild.memberCount));
        } catch (error) {
            logger.error('[WELCOME] Erreur formatTemplate:', error);
            return text;
        }
    }

    /**
     * Détecte l'inviteur
     */
    async detectInviter(client, member) {
        try {
            const guildId = member.guild.id;

            if (!member.guild.members.me.permissions.has(Discord.PermissionFlagsBits.ManageGuild)) {
                return { inviter: null, inviteCount: 0 };
            }

            const currentInvites = await member.guild.invites.fetch().catch(() => null);
            if (!currentInvites) return { inviter: null, inviteCount: 0 };

            if (!client.guildInvites) client.guildInvites = new Map();
            const cachedInvites = client.guildInvites.get(guildId);

            if (cachedInvites) {
                for (const [code, currentInvite] of currentInvites) {
                    const cachedInvite = cachedInvites.get(code);
                    if (cachedInvite && currentInvite.uses > cachedInvite.uses) {
                        client.guildInvites.set(guildId, currentInvites);
                        return { inviter: currentInvite.inviter, inviteCount: currentInvite.uses };
                    }
                }
            }

            client.guildInvites.set(guildId, currentInvites);
            return { inviter: null, inviteCount: 0 };
        } catch (error) {
            logger.error('[WELCOME] Erreur détection inviteur:', error);
            return { inviter: null, inviteCount: 0 };
        }
    }

    /**
     * Gère l'arrivée d'un membre
     */
    async handleMemberJoin(client, member) {
        try {
            logger.info(`[WELCOME] 🎉 Nouveau membre: ${member.user.tag} sur ${member.guild.name}`);
            const config = this.getConfig(member.guild.id);

            if (!config.enabled) return;

            const { inviter, inviteCount } = await this.detectInviter(client, member);

            // 1. Autorole
            if (config.autoroleId) {
                try {
                    const role = member.guild.roles.cache.get(config.autoroleId);
                    if (role && member.guild.members.me.roles.highest.position > role.position) {
                        await member.roles.add(role);
                        logger.info(`[WELCOME] <a:_:1483497369315315786> Rôle ajouté à ${member.user.tag}`);
                    }
                } catch (e) { logger.error(`[WELCOME] Erreur autorole:`, e); }
            }

            // 2. Message Salon
            if (config.channelId && (config.message || config.embed)) {
                try {
                    const channel = member.guild.channels.cache.get(config.channelId);
                    if (channel && channel.isTextBased() && channel.permissionsFor(member.guild.members.me).has(Discord.PermissionFlagsBits.SendMessages)) {

                        if (config.style === 'embed' && config.embed) {
                            const embedData = JSON.parse(JSON.stringify(config.embed));
                            // Formatage récursif simple pour les champs principaux
                            if (embedData.title) embedData.title = this.formatTemplate(embedData.title, member, inviter, inviteCount);
                            if (embedData.description) embedData.description = this.formatTemplate(embedData.description, member, inviter, inviteCount);
                            if (embedData.footer?.text) embedData.footer.text = this.formatTemplate(embedData.footer.text, member, inviter, inviteCount);
                            if (embedData.author?.name) embedData.author.name = this.formatTemplate(embedData.author.name, member, inviter, inviteCount);
                            if (embedData.fields) {
                                embedData.fields = embedData.fields.map(f => ({
                                    ...f,
                                    name: this.formatTemplate(f.name, member, inviter, inviteCount),
                                    value: this.formatTemplate(f.value, member, inviter, inviteCount)
                                }));
                            }
                            await channel.send({ embeds: [new EmbedBuilder(embedData)] });
                        } else if (config.message) {
                            await channel.send(this.formatTemplate(config.message, member, inviter, inviteCount));
                        }
                    }
                } catch (e) { logger.error(`[WELCOME] Erreur message salon:`, e); }
            }

            // 3. Message Privé
            if (config.dmMessage) {
                try {
                    await member.send(this.formatTemplate(config.dmMessage, member, inviter, inviteCount));
                } catch (e) { logger.warn(`[WELCOME] Impossible d'envoyer MP à ${member.user.tag}`); }
            }

        } catch (error) {
            logger.error('[WELCOME] Erreur handleMemberJoin:', error);
        }
    }
}

module.exports = new WelcomeSystem();
