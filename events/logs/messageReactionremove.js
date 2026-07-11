const logger = require('../../utils/logger');

module.exports = async (client, reaction, user) => {
    try {
        // Log de réaction supprimée
        logger.debug(`Réaction supprimée par ${user.tag} sur ${reaction.message.id}`);

        // Ajouter ici la logique pour gérer les réactions supprimées si nécessaire

    } catch (error) {
        logger.error('Erreur lors de la gestion de la réaction supprimée:', error);
    }
};
