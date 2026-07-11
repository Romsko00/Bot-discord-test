const logger = require('../../utils/logger');

module.exports = async (client, reaction, user) => {
    try {
        // Log de réaction ajoutée
        logger.debug(`Réaction ajoutée par ${user.tag} sur ${reaction.message.id}`);

        // Ajouter ici la logique pour gérer les réactions si nécessaire
        // Par exemple, pour des systèmes de rôle ou de sondages

    } catch (error) {
        logger.error('Erreur lors de la gestion de la réaction ajoutée:', error);
    }
};
