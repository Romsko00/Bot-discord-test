const db = require('./simpledb');
const logger = require('./logger');
const configManager = require('./casinoConfigManager');
const Casino = require('./casino');

/**
 * SYSTÈME DE GAINS AUTOMATIQUES
 * Permet aux utilisateurs de gagner des crédits en étant actifs
 * - Gains par message dans les salons texte configurés
 * - Gains par minute dans les salons vocaux configurés
 */

class AutoEarnings {
    constructor() {
        // Cache pour les cooldowns utilisateurs
        this.textCooldowns = new Map(); // userId_channelId -> timestamp
        this.voiceTimers = new Map(); // userId -> interval
        this.voiceStartTimes = new Map(); // userId -> timestamp
    }

    /**
     * Traite un message et attribue des gains si applicable
     */
    async handleMessage(message) {
        try {
            // Ignorer les bots
            if (message.author.bot) return;

            // Ignorer les messages sans guilde
            if (!message.guild) return;

            const guildId = message.guild.id;
            const userId = message.author.id;
            const channelId = message.channel.id;

            // Récupérer la configuration
            const config = configManager.getGuildConfig(guildId);

            // Vérifier si le système est activé
            if (!config.autoEarnings?.text?.enabled) return;

            // Vérifier si ce salon est configuré
            const channelConfig = config.autoEarnings.text.channels?.[channelId];
            if (!channelConfig || !channelConfig.enabled) return;

            // Vérifier le cooldown
            const cooldownKey = `${userId}_${channelId}`;
            const lastEarn = this.textCooldowns.get(cooldownKey) || 0;
            const now = Date.now();

            if (now - lastEarn < channelConfig.cooldownMs) {
                return; // Encore en cooldown
            }

            // Vérifier la longueur minimale du message
            if (message.content.length < (channelConfig.minMessageLength || 0)) {
                return;
            }

            // Vérifier les limites horaires/journalières
            const hourlyKey = `autoearnings_text_hourly_${userId}_${channelId}`;
            const dailyKey = `autoearnings_text_daily_${userId}_${channelId}`;

            const hourlyEarned = db.get(hourlyKey) || 0;
            const dailyEarned = db.get(dailyKey) || 0;

            if (hourlyEarned >= channelConfig.maxPerHour) {
                return; // Limite horaire atteinte
            }

            if (dailyEarned >= channelConfig.maxPerDay) {
                return; // Limite journalière atteinte
            }

            // Calculer les gains
            let earnings = channelConfig.coinsPerMessage || 5;

            // Bonus pour message long
            if (channelConfig.bonusLongMessage) {
                const threshold = channelConfig.bonusLongMessage.threshold || 100;
                const multiplier = channelConfig.bonusLongMessage.multiplier || 1.5;

                if (message.content.length >= threshold) {
                    earnings = Math.floor(earnings * multiplier);
                }
            }

            // Attribuer les gains
            Casino.addCasinoCredits(userId, earnings);

            // Mettre à jour le cooldown
            this.textCooldowns.set(cooldownKey, now);

            // Mettre à jour les compteurs
            db.set(hourlyKey, hourlyEarned + earnings);
            db.set(dailyKey, dailyEarned + earnings);

            // Expiration automatique des compteurs
            setTimeout(() => {
                const current = db.get(hourlyKey) || 0;
                db.set(hourlyKey, Math.max(0, current - earnings));
            }, 3600000); // 1 heure

            setTimeout(() => {
                const current = db.get(dailyKey) || 0;
                db.set(dailyKey, Math.max(0, current - earnings));
            }, 86400000); // 24 heures

            logger.info(`[AUTO-EARNINGS] ${message.author.tag} a gagné ${earnings} crédits dans #${message.channel.name}`);

            // Notification optionnelle (discrète)
            if (channelConfig.notifyUser && earnings > 0) {
                message.react('💰').catch(() => { });
            }

        } catch (error) {
            logger.error('[AUTO-EARNINGS] Erreur handleMessage:', error);
        }
    }

    /**
     * Démarre le suivi vocal pour un utilisateur
     */
    startVoiceTracking(member, channelId, guildId) {
        try {
            const userId = member.id;

            // Récupérer la configuration
            const config = configManager.getGuildConfig(guildId);

            // Vérifier si le système est activé
            if (!config.autoEarnings?.voice?.enabled) return;

            // Vérifier si ce salon est configuré
            const channelConfig = config.autoEarnings.voice.channels?.[channelId];
            if (!channelConfig || !channelConfig.enabled) return;

            // Arrêter le timer existant si présent
            this.stopVoiceTracking(userId);

            // Enregistrer l'heure de début
            this.voiceStartTimes.set(userId, Date.now());

            // Créer un timer qui s'exécute chaque minute
            const timer = setInterval(() => {
                this.processVoiceEarnings(member, channelId, guildId, channelConfig);
            }, 60000); // Chaque minute

            this.voiceTimers.set(userId, timer);

            logger.info(`[AUTO-EARNINGS] Suivi vocal démarré pour ${member.user.tag} dans le salon ${channelId}`);

        } catch (error) {
            logger.error('[AUTO-EARNINGS] Erreur startVoiceTracking:', error);
        }
    }

    /**
     * Arrête le suivi vocal pour un utilisateur
     */
    stopVoiceTracking(userId) {
        const timer = this.voiceTimers.get(userId);
        if (timer) {
            clearInterval(timer);
            this.voiceTimers.delete(userId);
            this.voiceStartTimes.delete(userId);
            logger.info(`[AUTO-EARNINGS] Suivi vocal arrêté pour l'utilisateur ${userId}`);
        }
    }

    /**
     * Traite les gains vocaux pour un utilisateur
     */
    async processVoiceEarnings(member, channelId, guildId, channelConfig) {
        try {
            const userId = member.id;

            // Vérifier que l'utilisateur est toujours dans le salon
            const voiceState = member.voice;
            if (!voiceState || voiceState.channelId !== channelId) {
                this.stopVoiceTracking(userId);
                return;
            }

            // Vérifier les conditions requises
            if (channelConfig.requireUnmuted && voiceState.mute) {
                return; // Utilisateur muté
            }

            if (channelConfig.requireUndeafened && voiceState.deaf) {
                return; // Utilisateur sourd
            }

            // Vérifier les limites horaires/journalières
            const hourlyKey = `autoearnings_voice_hourly_${userId}_${channelId}`;
            const dailyKey = `autoearnings_voice_daily_${userId}_${channelId}`;

            const hourlyEarned = db.get(hourlyKey) || 0;
            const dailyEarned = db.get(dailyKey) || 0;

            if (hourlyEarned >= channelConfig.maxPerHour) {
                return; // Limite horaire atteinte
            }

            if (dailyEarned >= channelConfig.maxPerDay) {
                return; // Limite journalière atteinte
            }

            // Calculer les gains
            let earnings = channelConfig.coinsPerMinute || 10;

            // Bonus streaming
            if (voiceState.streaming && channelConfig.bonusStreaming) {
                earnings = Math.floor(earnings * (1 + channelConfig.bonusStreaming));
            }

            // Bonus caméra
            if (voiceState.selfVideo && channelConfig.bonusCamera) {
                earnings = Math.floor(earnings * (1 + channelConfig.bonusCamera));
            }

            // Attribuer les gains
            Casino.addCasinoCredits(userId, earnings);

            // Mettre à jour les compteurs
            db.set(hourlyKey, hourlyEarned + earnings);
            db.set(dailyKey, dailyEarned + earnings);

            // Expiration automatique des compteurs
            setTimeout(() => {
                const current = db.get(hourlyKey) || 0;
                db.set(hourlyKey, Math.max(0, current - earnings));
            }, 3600000); // 1 heure

            setTimeout(() => {
                const current = db.get(dailyKey) || 0;
                db.set(dailyKey, Math.max(0, current - earnings));
            }, 86400000); // 24 heures

            logger.info(`[AUTO-EARNINGS] ${member.user.tag} a gagné ${earnings} crédits en vocal (streaming: ${voiceState.streaming}, caméra: ${voiceState.selfVideo})`);

        } catch (error) {
            logger.error('[AUTO-EARNINGS] Erreur processVoiceEarnings:', error);
        }
    }

    /**
     * Gère les changements d'état vocal
     */
    handleVoiceStateUpdate(oldState, newState) {
        try {
            const member = newState.member;
            const userId = member.id;
            const guildId = newState.guild.id;

            // Utilisateur a rejoint un salon vocal
            if (!oldState.channelId && newState.channelId) {
                this.startVoiceTracking(member, newState.channelId, guildId);
            }

            // Utilisateur a quitté un salon vocal
            else if (oldState.channelId && !newState.channelId) {
                this.stopVoiceTracking(userId);
            }

            // Utilisateur a changé de salon
            else if (oldState.channelId !== newState.channelId) {
                this.stopVoiceTracking(userId);
                if (newState.channelId) {
                    this.startVoiceTracking(member, newState.channelId, guildId);
                }
            }

        } catch (error) {
            logger.error('[AUTO-EARNINGS] Erreur handleVoiceStateUpdate:', error);
        }
    }

    /**
     * Nettoie les cooldowns expirés (à appeler périodiquement)
     */
    cleanupCooldowns() {
        const now = Date.now();
        const maxAge = 3600000; // 1 heure

        for (const [key, timestamp] of this.textCooldowns.entries()) {
            if (now - timestamp > maxAge) {
                this.textCooldowns.delete(key);
            }
        }
    }

    /**
     * Arrête tous les timers vocaux (à appeler lors de l'arrêt du bot)
     */
    shutdown() {
        for (const [userId, timer] of this.voiceTimers.entries()) {
            clearInterval(timer);
        }
        this.voiceTimers.clear();
        this.voiceStartTimes.clear();
        logger.info('[AUTO-EARNINGS] Système arrêté, tous les timers vocaux ont été nettoyés');
    }
}

// Instance singleton
const autoEarnings = new AutoEarnings();

// Nettoyage périodique des cooldowns (toutes les 10 minutes)
setInterval(() => {
    autoEarnings.cleanupCooldowns();
}, 600000);

module.exports = autoEarnings;
