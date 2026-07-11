const soutienSystem = require('../../utils/soutienSystem');

module.exports = async (client, oldPresence, newPresence) => {
    try {
        await soutienSystem.handlePresenceUpdate(oldPresence, newPresence);
    } catch (error) {
        // Silencieux pour éviter le spam de logs sur les updates fréquents
    }
};

module.exports.eventName = 'presenceUpdate';
