const logger = require('../../utils/logger');

// Ce fichier est désactivé car fusionné avec events/invite/guildMemberAdd.js
// pour éviter les conflits de gestionnaire d'événement (écrasement).
module.exports = async (client, member) => {
  // Géré dans events/invite/guildMemberAdd.js
};

module.exports.eventName = 'guildMemberAdd';
