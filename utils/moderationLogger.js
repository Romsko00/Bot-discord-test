const LogSystem = require('./logSystem');

class ModerationLogger {
  constructor(client) {
    this.logSystem = new LogSystem(client);
  }

  async logAction(guild, action, moderator, target, reason, options = {}) {
    // Formater l'action pour les logs
    const formattedAction = this.formatAction(action);
    
    await this.logSystem.logModeration(guild, formattedAction, moderator, target, reason, {
      caseId: options.caseId || Date.now().toString(),
      duration: options.duration,
      ...options
    });
  }

  formatAction(action) {
    const actionMap = {
      'ban': 'Ban',
      'unban': 'Unban',
      'kick': 'Kick',
      'mute': 'Mute',
      'unmute': 'Unmute',
      'tempban': 'Ban Temporaire',
      'tempmute': 'Mute Temporaire',
      'warn': 'Avertissement',
      'clearwarn': 'Suppression Avertissement',
      'lockdown': 'Verrouillage',
      'unlockdown': 'Déverrouillage',
      'addrole': 'Ajout Rôle',
      'removerole': 'Suppression Rôle',
      'nickname': 'Modification Pseudo',
      'vcmove': 'Déplacement Vocal',
      'vckick': 'Expulsion Vocale'
    };

    return actionMap[action] || action.toUpperCase();
  }

  // Middleware pour les commandes
  createMiddleware(action) {
    return async (client, message, args, options = {}) => {
      const target = options.getTarget ? options.getTarget(message, args) : null;
      const reason = options.getReason ? options.getReason(args) : 'Aucune raison spécifiée';
      
      if (target) {
        await this.logAction(message.guild, action, message.author, target, reason, {
          caseId: options.caseId,
          duration: options.duration
        });
      }
    };
  }
}

module.exports = ModerationLogger;
