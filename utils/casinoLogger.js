const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Système de logs avancé pour le casino
 * Gère les logs par catégorie avec rotation automatique
 */

class CasinoLogger {
  constructor() {
    this.logsDir = path.join(__dirname, '..', 'logs', 'casino');
    this.ensureLogsDir();
    
    // Configuration des catégories de logs
    this.categories = {
      game: 'Jeux et paris',
      transaction: 'Transactions (crédits)',
      admin: 'Actions admin',
      team: 'Teams et guildes',
      shop: 'Boutique',
      job: 'Métiers et compétences',
      achievement: 'Succès',
      security: 'Sécurité et anti-triche',
      error: 'Erreurs'
    };
    
    // Limites de taille des fichiers de logs (5 MB)
    this.maxLogSize = 5 * 1024 * 1024;
  }

  /**
   * Crée le dossier de logs s'il n'existe pas
   */
  ensureLogsDir() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
      logger.info('[CASINO-LOGGER] Dossier de logs casino créé');
    }
  }

  /**
   * Obtient le chemin du fichier de log pour une catégorie
   */
  getLogPath(category) {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logsDir, `${category}_${date}.log`);
  }

  /**
   * Écrit un log dans le fichier approprié
   */
  write(category, data) {
    try {
      const logPath = this.getLogPath(category);
      const timestamp = new Date().toISOString();
      
      const logEntry = {
        timestamp,
        category,
        ...data
      };
      
      const logLine = JSON.stringify(logEntry) + '\n';
      
      // Vérifier la taille du fichier
      if (fs.existsSync(logPath)) {
        const stats = fs.statSync(logPath);
        if (stats.size > this.maxLogSize) {
          this.rotateLogs(category);
        }
      }
      
      // Écrire le log
      fs.appendFileSync(logPath, logLine);
    } catch (error) {
      logger.error('[CASINO-LOGGER] Erreur d\'écriture:', error);
    }
  }

  /**
   * Rotation des logs (archivage des anciens logs)
   */
  rotateLogs(category) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const currentPath = this.getLogPath(category);
      const archivePath = path.join(
        this.logsDir,
        'archives',
        `${category}_${date}_${Date.now()}.log`
      );
      
      // Créer le dossier d'archives
      const archiveDir = path.join(this.logsDir, 'archives');
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }
      
      // Déplacer le fichier actuel vers les archives
      if (fs.existsSync(currentPath)) {
        fs.renameSync(currentPath, archivePath);
        logger.info(`[CASINO-LOGGER] Logs ${category} archivés`);
      }
    } catch (error) {
      logger.error('[CASINO-LOGGER] Erreur de rotation:', error);
    }
  }

  /**
   * Log d'une partie de jeu
   */
  logGame(userId, game, data) {
    this.write('game', {
      userId,
      game,
      bet: data.bet,
      payout: data.payout,
      win: data.win,
      balance: data.balance,
      extra: data.extra || {}
    });
    
    logger.debug(`[CASINO] ${game} | User:${userId} | Mise:${data.bet} | Gain:${data.payout}`);
  }

  /**
   * Log d'une transaction
   */
  logTransaction(type, userId, amount, data = {}) {
    this.write('transaction', {
      type,
      userId,
      amount,
      balance: data.balance,
      reason: data.reason || 'unknown',
      adminId: data.adminId
    });
    
    logger.info(`[CASINO-TRX] ${type} | User:${userId} | Montant:${amount} | Raison:${data.reason || 'N/A'}`);
  }

  /**
   * Log d'une action admin
   */
  logAdmin(adminId, action, data) {
    this.write('admin', {
      adminId,
      action,
      targetId: data.targetId,
      details: data.details || {},
      guildId: data.guildId
    });
    
    logger.warn(`[CASINO-ADMIN] ${action} | Admin:${adminId} | Target:${data.targetId || 'N/A'}`);
  }

  /**
   * Log d'activité team
   */
  logTeam(teamId, action, data) {
    this.write('team', {
      teamId,
      action,
      userId: data.userId,
      details: data.details || {},
      guildId: data.guildId
    });
    
    logger.debug(`[CASINO-TEAM] ${action} | Team:${teamId} | User:${data.userId || 'N/A'}`);
  }

  /**
   * Log d'achat boutique
   */
  logShop(userId, item, data) {
    this.write('shop', {
      userId,
      item,
      price: data.price,
      quantity: data.quantity || 1,
      balance: data.balance
    });
    
    logger.info(`[CASINO-SHOP] Achat | User:${userId} | Item:${item} | Prix:${data.price}`);
  }

  /**
   * Log de métier
   */
  logJob(userId, action, data) {
    this.write('job', {
      userId,
      action,
      job: data.job,
      skill: data.skill,
      level: data.level,
      reward: data.reward
    });
    
    logger.debug(`[CASINO-JOB] ${action} | User:${userId} | Job:${data.job || 'N/A'}`);
  }

  /**
   * Log de succès débloqué
   */
  logAchievement(userId, achievement) {
    this.write('achievement', {
      userId,
      achievement,
      timestamp: Date.now()
    });
    
    logger.info(`[CASINO-ACH] <a:_:1483497369315315786> ${achievement} | User:${userId}`);
  }

  /**
   * Log de sécurité
   */
  logSecurity(type, data) {
    this.write('security', {
      type,
      userId: data.userId,
      reason: data.reason,
      severity: data.severity || 'medium',
      details: data.details || {}
    });
    
    logger.warn(`[CASINO-SEC] ${type} | User:${data.userId} | Severity:${data.severity}`);
  }

  /**
   * Log d'erreur
   */
  logError(context, error, data = {}) {
    this.write('error', {
      context,
      error: error.message || String(error),
      stack: error.stack || '',
      userId: data.userId,
      details: data.details || {}
    });
    
    logger.error(`[CASINO-ERR] ${context} | ${error.message || error}`);
  }

  /**
   * Lire les logs d'une catégorie
   */
  readLogs(category, options = {}) {
    try {
      const logPath = this.getLogPath(category);
      
      if (!fs.existsSync(logPath)) {
        return [];
      }
      
      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.trim().split('\n').filter(l => l);
      
      let logs = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);
      
      // Filtrer par userId si spécifié
      if (options.userId) {
        logs = logs.filter(l => l.userId === options.userId);
      }
      
      // Filtrer par période si spécifié
      if (options.since) {
        logs = logs.filter(l => new Date(l.timestamp) >= new Date(options.since));
      }
      
      // Limiter le nombre de résultats
      const limit = options.limit || 100;
      return logs.slice(-limit);
      
    } catch (error) {
      logger.error('[CASINO-LOGGER] Erreur de lecture:', error);
      return [];
    }
  }

  /**
   * Obtenir des statistiques globales
   */
  getStats(category, days = 7) {
    try {
      const stats = {
        totalEntries: 0,
        uniqueUsers: new Set(),
        dailyActivity: {}
      };
      
      // Lire les X derniers jours
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const logPath = path.join(this.logsDir, `${category}_${dateStr}.log`);
        
        if (!fs.existsSync(logPath)) continue;
        
        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.trim().split('\n').filter(l => l);
        
        stats.totalEntries += lines.length;
        stats.dailyActivity[dateStr] = lines.length;
        
        lines.forEach(line => {
          try {
            const log = JSON.parse(line);
            if (log.userId) stats.uniqueUsers.add(log.userId);
          } catch {}
        });
      }
      
      return {
        totalEntries: stats.totalEntries,
        uniqueUsers: stats.uniqueUsers.size,
        dailyActivity: stats.dailyActivity
      };
    } catch (error) {
      logger.error('[CASINO-LOGGER] Erreur de statistiques:', error);
      return null;
    }
  }

  /**
   * Nettoyer les vieux logs
   */
  cleanOldLogs(days = 30) {
    try {
      const archiveDir = path.join(this.logsDir, 'archives');
      if (!fs.existsSync(archiveDir)) return;
      
      const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
      const files = fs.readdirSync(archiveDir);
      
      let deleted = 0;
      files.forEach(file => {
        const filePath = path.join(archiveDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtimeMs < cutoffDate) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      });
      
      if (deleted > 0) {
        logger.info(`[CASINO-LOGGER] ${deleted} fichiers de logs archivés supprimés`);
      }
    } catch (error) {
      logger.error('[CASINO-LOGGER] Erreur de nettoyage:', error);
    }
  }
}

// Instance singleton
const casinoLogger = new CasinoLogger();

// Nettoyage automatique tous les jours
setInterval(() => {
  casinoLogger.cleanOldLogs(30);
}, 24 * 60 * 60 * 1000);

module.exports = casinoLogger;
