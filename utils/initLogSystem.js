const LogSystem = require('./logSystem');
const RaidDetection = require('./raidDetection');
const ModerationLogger = require('./moderationLogger');

class LogSystemInitializer {
  constructor(client) {
    this.client = client;
    this.logSystem = new LogSystem(client);
    this.raidDetection = new RaidDetection(client);
    this.moderationLogger = new ModerationLogger(client);
  }

  async initialize() {
    console.log('[LOGS] Initialisation du système de logs...');
    
    // Configurer les logs pour tous les serveurs existants
    for (const guild of this.client.guilds.cache.values()) {
      try {
        await this.logSystem.setupGuildLogs(guild);
        console.log(`[LOGS] Système configuré pour ${guild.name}`);
      } catch (error) {
        console.error(`[LOGS] Erreur lors de la configuration pour ${guild.name}:`, error);
      }
    }

    console.log('[LOGS] Système de logs initialisé avec succès');
    return this;
  }

  // Méthodes pour accéder aux différents systèmes
  getLogSystem() {
    return this.logSystem;
  }

  getRaidDetection() {
    return this.raidDetection;
  }

  getModerationLogger() {
    return this.moderationLogger;
  }

  // Middleware pour les commandes de modération
  createModerationMiddleware(action) {
    return this.moderationLogger.createMiddleware(action);
  }

  // Enregistrer les événements de joins/leaves pour la détection de raids
  recordMemberJoin(guild) {
    this.raidDetection.recordJoin(guild);
  }

  recordMemberLeave(guild) {
    this.raidDetection.recordLeave(guild);
  }

  // Obtenir les statistiques de sécurité
  getSecurityStats(guildId) {
    return {
      raid: this.raidDetection.getStats(guildId),
      logs: this.logSystem.config.guilds[guildId] || null
    };
  }
}

module.exports = LogSystemInitializer;
