const db = require('./simpledb');
const Casino = require('./casino');

/**
 * Module d'améliorations du système de casino Zoom Bot
 * - Statistiques détaillées
 * - Protections anti-triche
 * - Système de bonus progressif
 * - Gestion avancée des cooldowns
 */

// ============================================
// STATISTIQUES DÉTAILLÉES
// ============================================

const DETAILED_STATS_KEY = (userId) => `casino_stats_detailed_${userId}`;
const SESSION_KEY = (userId) => `casino_session_${userId}`;
const DAILY_STATS_KEY = (userId, date) => `casino_daily_${userId}_${date}`;

/**
 * Obtenir les statistiques détaillées d'un utilisateur
 */
function getDetailedStats(userId) {
  return db.get(DETAILED_STATS_KEY(userId)) || {
    totalGames: 0,
    totalWagered: 0,
    totalWon: 0,
    totalLost: 0,
    totalPayout: 0,
    winRate: 0,
    averageBet: 0,
    largestWin: 0,
    largestLoss: 0,
    currentStreak: 0,
    longestWinStreak: 0,
    longestLossStreak: 0,
    favoriteGame: null,
    lastPlayTime: 0,
    playTime: 0
  };
}

/**
 * Mettre à jour les statistiques après une partie
 */
function updateDetailedStats(userId, { game, bet, win, payout }) {
  const stats = getDetailedStats(userId);
  
  stats.totalGames += 1;
  stats.totalWagered += bet;
  stats.totalPayout += payout;
  
  if (win) {
    stats.totalWon += 1;
    stats.currentStreak = Math.max(0, stats.currentStreak) + 1;
    stats.longestWinStreak = Math.max(stats.longestWinStreak, stats.currentStreak);
  } else {
    stats.totalLost += 1;
    stats.currentStreak = Math.min(0, stats.currentStreak) - 1;
    stats.longestLossStreak = Math.max(stats.longestLossStreak, Math.abs(stats.currentStreak));
  }
  
  stats.largestWin = Math.max(stats.largestWin, payout - bet);
  stats.largestLoss = Math.max(stats.largestLoss, bet - payout);
  stats.winRate = stats.totalGames > 0 ? (stats.totalWon / stats.totalGames * 100).toFixed(2) : 0;
  stats.averageBet = stats.totalGames > 0 ? Math.floor(stats.totalWagered / stats.totalGames) : 0;
  
  // Tracker du jeu préféré
  if (!stats.gameStats) stats.gameStats = {};
  if (!stats.gameStats[game]) {
    stats.gameStats[game] = { plays: 0, wins: 0, wagered: 0, payout: 0 };
  }
  stats.gameStats[game].plays += 1;
  if (win) stats.gameStats[game].wins += 1;
  stats.gameStats[game].wagered += bet;
  stats.gameStats[game].payout += payout;
  
  // Déterminer le jeu préféré
  let maxPlays = 0;
  for (const [g, data] of Object.entries(stats.gameStats)) {
    if (data.plays > maxPlays) {
      maxPlays = data.plays;
      stats.favoriteGame = g;
    }
  }
  
  stats.lastPlayTime = Date.now();
  
  db.set(DETAILED_STATS_KEY(userId), stats);
  return stats;
}

/**
 * Obtenir les statistiques de la session actuelle
 */
function getSessionStats(userId) {
  const today = new Date().toISOString().split('T')[0];
  return db.get(SESSION_KEY(userId)) || {
    date: today,
    gamesPlayed: 0,
    totalWagered: 0,
    totalWon: 0,
    sessionProfit: 0,
    startBalance: Casino.getCasinoBalance(userId),
    peakBalance: Casino.getCasinoBalance(userId)
  };
}

/**
 * Mettre à jour les statistiques de session
 */
function updateSessionStats(userId, { bet, payout }) {
  const session = getSessionStats(userId);
  const today = new Date().toISOString().split('T')[0];
  
  // Réinitialiser si nouveau jour
  if (session.date !== today) {
    session.date = today;
    session.gamesPlayed = 0;
    session.totalWagered = 0;
    session.totalWon = 0;
    session.startBalance = Casino.getCasinoBalance(userId);
    session.peakBalance = Casino.getCasinoBalance(userId);
  }
  
  session.gamesPlayed += 1;
  session.totalWagered += bet;
  session.totalWon += payout;
  session.sessionProfit = session.totalWon - session.totalWagered;
  
  const currentBalance = Casino.getCasinoBalance(userId);
  session.peakBalance = Math.max(session.peakBalance, currentBalance);
  
  db.set(SESSION_KEY(userId), session);
  return session;
}

// ============================================
// PROTECTIONS ANTI-TRICHE
// ============================================

const ANTI_CHEAT_KEY = (userId) => `casino_anticheat_${userId}`;
const SPAM_KEY = (userId) => `casino_spam_${userId}`;

/**
 * Vérifier les activités suspectes
 */
function checkSuspiciousActivity(userId) {
  const anticheat = db.get(ANTI_CHEAT_KEY(userId)) || {
    warnings: 0,
    lastWarning: 0,
    suspended: false,
    suspendUntil: 0
  };
  
  // Vérifier si suspendu
  if (anticheat.suspended && anticheat.suspendUntil > Date.now()) {
    return {
      suspicious: true,
      reason: 'account_suspended',
      until: anticheat.suspendUntil
    };
  }
  
  // Réinitialiser si suspension expirée
  if (anticheat.suspended && anticheat.suspendUntil <= Date.now()) {
    anticheat.suspended = false;
    anticheat.suspendUntil = 0;
    db.set(ANTI_CHEAT_KEY(userId), anticheat);
  }
  
  return { suspicious: false };
}

/**
 * Ajouter un avertissement anti-triche
 */
function addAntiCheatWarning(userId, reason) {
  const anticheat = db.get(ANTI_CHEAT_KEY(userId)) || {
    warnings: 0,
    lastWarning: 0,
    suspended: false,
    suspendUntil: 0
  };
  
  anticheat.warnings += 1;
  anticheat.lastWarning = Date.now();
  
  // Suspension automatique après 3 avertissements
  if (anticheat.warnings >= 3) {
    anticheat.suspended = true;
    anticheat.suspendUntil = Date.now() + (24 * 60 * 60 * 1000); // 24h
  }
  
  db.set(ANTI_CHEAT_KEY(userId), anticheat);
  return anticheat;
}

/**
 * Détecter le spam de commandes
 */
function detectSpam(userId, limit = 5, timeWindow = 5000) {
  const spam = db.get(SPAM_KEY(userId)) || [];
  const now = Date.now();
  
  // Nettoyer les anciennes entrées
  const recent = spam.filter(t => now - t < timeWindow);
  
  if (recent.length >= limit) {
    return { spam: true, count: recent.length };
  }
  
  recent.push(now);
  db.set(SPAM_KEY(userId), recent);
  
  return { spam: false, count: recent.length };
}

// ============================================
// SYSTÈME DE BONUS PROGRESSIF
// ============================================

const BONUS_MULTIPLIER_KEY = (userId) => `casino_bonus_mult_${userId}`;
const BONUS_STREAK_KEY = (userId) => `casino_bonus_streak_${userId}`;

/**
 * Obtenir le multiplicateur de bonus
 */
function getBonusMultiplier(userId) {
  const multiplier = db.get(BONUS_MULTIPLIER_KEY(userId)) || 1.0;
  return Math.max(1.0, Math.min(multiplier, 2.5)); // Cap à 2.5x
}

/**
 * Augmenter le multiplicateur de bonus
 */
function increaseBonusMultiplier(userId, increment = 0.05) {
  const current = getBonusMultiplier(userId);
  const newMult = Math.min(current + increment, 2.5);
  db.set(BONUS_MULTIPLIER_KEY(userId), newMult);
  return newMult;
}

/**
 * Réinitialiser le multiplicateur de bonus
 */
function resetBonusMultiplier(userId) {
  db.set(BONUS_MULTIPLIER_KEY(userId), 1.0);
  return 1.0;
}

/**
 * Obtenir la streak de bonus
 */
function getBonusStreak(userId) {
  return db.get(BONUS_STREAK_KEY(userId)) || 0;
}

/**
 * Augmenter la streak de bonus
 */
function increaseBonusStreak(userId) {
  const current = getBonusStreak(userId);
  const newStreak = current + 1;
  db.set(BONUS_STREAK_KEY(userId), newStreak);
  
  // Augmenter le multiplicateur tous les 5 wins
  if (newStreak % 5 === 0) {
    increaseBonusMultiplier(userId, 0.1);
  }
  
  return newStreak;
}

/**
 * Réinitialiser la streak de bonus
 */
function resetBonusStreak(userId) {
  db.set(BONUS_STREAK_KEY(userId), 0);
  return 0;
}

// ============================================
// GESTION AVANCÉE DES COOLDOWNS
// ============================================

const COOLDOWN_TRACKER_KEY = (userId) => `casino_cooldown_tracker_${userId}`;

/**
 * Obtenir les informations détaillées des cooldowns
 */
function getCooldownInfo(userId) {
  return db.get(COOLDOWN_TRACKER_KEY(userId)) || {};
}

/**
 * Obtenir le temps restant formaté avec détails
 */
function getCooldownDetails(userId, cmd) {
  const remaining = Casino.getCooldownRemaining(userId, cmd);
  if (remaining <= 0) {
    return {
      active: false,
      remaining: 0,
      formatted: 'Prêt'
    };
  }
  
  return {
    active: true,
    remaining: remaining,
    formatted: Casino.formatMs(remaining),
    percentage: Math.round((remaining / 10000) * 100) // Basé sur un cooldown de 10s
  };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Statistiques détaillées
  getDetailedStats,
  updateDetailedStats,
  getSessionStats,
  updateSessionStats,
  
  // Protections anti-triche
  checkSuspiciousActivity,
  addAntiCheatWarning,
  detectSpam,
  
  // Système de bonus progressif
  getBonusMultiplier,
  increaseBonusMultiplier,
  resetBonusMultiplier,
  getBonusStreak,
  increaseBonusStreak,
  resetBonusStreak,
  
  // Gestion avancée des cooldowns
  getCooldownInfo,
  getCooldownDetails
};
