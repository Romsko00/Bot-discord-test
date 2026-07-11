const autoEarnings = require('../../utils/autoEarnings');
const logger = require('../../utils/logger');

/**
 * Événement: voiceStateUpdate
 * Gère les gains automatiques en vocal
 */

module.exports = async (client, oldState, newState) => {
    try {
        // Ignorer les bots
        if (newState.member.user.bot) return;

        // Traiter les changements d'état vocal
        autoEarnings.handleVoiceStateUpdate(oldState, newState);
    } catch (error) {
        logger.error('[EVENT-AUTO-EARNINGS] Erreur dans voiceStateUpdate:', error);
    }
};
