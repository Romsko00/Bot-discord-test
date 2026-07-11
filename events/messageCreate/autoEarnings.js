const autoEarnings = require('../../utils/autoEarnings');
const logger = require('../../utils/logger');

/**
 * Événement: messageCreate
 * Gère les gains automatiques par message
 */

module.exports = async (client, message) => {
    try {
        // Traiter les gains automatiques
        await autoEarnings.handleMessage(message);
    } catch (error) {
        logger.error('[EVENT-AUTO-EARNINGS] Erreur dans messageCreate:', error);
    }
};

module.exports.eventName = 'messageCreate';
