// Ce fichier n'est pas utilisé - les kicks sont gérés par guildMemberRemove.js
// Cet événement n'existe pas dans Discord.js
// Gardé pour compatibilité

const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { LogSystem } = require('../../utils/logSystem');

module.exports = async (client, member) => {
  try {
    // Les kicks sont maintenant gérés dans guildMemberRemove.js
    // Cette fonction n'est jamais appelée
  } catch (e) {
    console.error('Erreur guildKickAdd:', e);
  }
};
