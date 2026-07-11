const db = require('./simpledb');

/**
 * Système de statistiques avancé pour le casino
 * Track toutes les activités, gains, pertes, etc.
 */

const STATS_PREFIX = 'casino_stats_';
const GAME_STATS_PREFIX = 'casino_game_stats_';
const DAILY_STATS_PREFIX = 'casino_daily_stats_';
const USER_STATS_PREFIX = 'casino_user_stats_';

/**
 * Enregistre une partie jouée
 */
function recordGame(guildId, userId, gameName, bet, win, loss) {
    const now = Date.now();
    const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Stats globales
    const globalKey = `${STATS_PREFIX}${guildId}`;
    const globalStats = db.get(globalKey) || {
        totalGames: 0,
        totalBets: 0,
        totalWins: 0,
        totalLosses: 0,
        totalRevenue: 0,
        gamesByType: {},
        lastUpdate: now
    };

    globalStats.totalGames++;
    globalStats.totalBets += bet;
    if (win > 0) {
        globalStats.totalWins += win;
        globalStats.totalRevenue -= (win - bet); // Revenue = mise - gain
    } else {
        globalStats.totalLosses += loss;
        globalStats.totalRevenue += bet; // Revenue = mise perdue
    }

    if (!globalStats.gamesByType[gameName]) {
        globalStats.gamesByType[gameName] = { count: 0, bets: 0, wins: 0, losses: 0 };
    }
    globalStats.gamesByType[gameName].count++;
    globalStats.gamesByType[gameName].bets += bet;
    if (win > 0) {
        globalStats.gamesByType[gameName].wins += win;
    } else {
        globalStats.gamesByType[gameName].losses += loss;
    }

    globalStats.lastUpdate = now;
    db.set(globalKey, globalStats);

    // Stats par jeu
    const gameKey = `${GAME_STATS_PREFIX}${guildId}_${gameName}`;
    const gameStats = db.get(gameKey) || {
        totalGames: 0,
        totalBets: 0,
        totalWins: 0,
        totalLosses: 0,
        players: new Set(),
        lastUpdate: now
    };
    gameStats.totalGames++;
    gameStats.totalBets += bet;
    if (win > 0) {
        gameStats.totalWins += win;
    } else {
        gameStats.totalLosses += loss;
    }
    if (!gameStats.players) gameStats.players = [];
    if (!gameStats.players.includes(userId)) {
        gameStats.players.push(userId);
    }
    gameStats.lastUpdate = now;
    db.set(gameKey, gameStats);

    // Stats quotidiennes
    const dailyKey = `${DAILY_STATS_PREFIX}${guildId}_${dateKey}`;
    const dailyStats = db.get(dailyKey) || {
        date: dateKey,
        totalGames: 0,
        totalBets: 0,
        totalWins: 0,
        totalLosses: 0,
        uniquePlayers: [],
        gamesByType: {}
    };

    dailyStats.totalGames++;
    dailyStats.totalBets += bet;
    if (win > 0) {
        dailyStats.totalWins += win;
    } else {
        dailyStats.totalLosses += loss;
    }

    if (!dailyStats.uniquePlayers.includes(userId)) {
        dailyStats.uniquePlayers.push(userId);
    }

    if (!dailyStats.gamesByType[gameName]) {
        dailyStats.gamesByType[gameName] = { count: 0, bets: 0, wins: 0, losses: 0 };
    }
    dailyStats.gamesByType[gameName].count++;
    dailyStats.gamesByType[gameName].bets += bet;
    if (win > 0) {
        dailyStats.gamesByType[gameName].wins += win;
    } else {
        dailyStats.gamesByType[gameName].losses += loss;
    }

    db.set(dailyKey, dailyStats);

    // Stats utilisateur
    const userKey = `${USER_STATS_PREFIX}${userId}`;
    const userStats = db.get(userKey) || {
        totalGames: 0,
        totalBets: 0,
        totalWins: 0,
        totalLosses: 0,
        gamesByType: {},
        biggestWin: 0,
        biggestLoss: 0,
        lastGame: now,
        lastGameType: null
    };

    userStats.totalGames++;
    userStats.totalBets += bet;
    if (win > 0) {
        userStats.totalWins += win;
        if (win > userStats.biggestWin) {
            userStats.biggestWin = win;
        }
    } else {
        userStats.totalLosses += loss;
        if (loss > userStats.biggestLoss) {
            userStats.biggestLoss = loss;
        }
    }

    if (!userStats.gamesByType[gameName]) {
        userStats.gamesByType[gameName] = { count: 0, bets: 0, wins: 0, losses: 0 };
    }
    userStats.gamesByType[gameName].count++;
    userStats.gamesByType[gameName].bets += bet;
    if (win > 0) {
        userStats.gamesByType[gameName].wins += win;
    } else {
        userStats.gamesByType[gameName].losses += loss;
    }

    userStats.lastGame = now;
    userStats.lastGameType = gameName;
    db.set(userKey, userStats);
}

/**
 * Enregistre un gain (jackpot, bonus, etc.)
 */
function recordWin(guildId, userId, amount, type = 'game') {
    const now = Date.now();
    const dateKey = new Date().toISOString().split('T')[0];

    // Stats globales
    const globalKey = `${STATS_PREFIX}${guildId}`;
    const globalStats = db.get(globalKey) || {};
    if (!globalStats.biggestWins) globalStats.biggestWins = [];
    globalStats.biggestWins.push({ userId, amount, type, timestamp: now });
    globalStats.biggestWins.sort((a, b) => b.amount - a.amount);
    globalStats.biggestWins = globalStats.biggestWins.slice(0, 100); // Garder les 100 plus gros gains
    db.set(globalKey, globalStats);

    // Stats utilisateur
    const userKey = `${USER_STATS_PREFIX}${userId}`;
    const userStats = db.get(userKey) || {};
    if (amount > userStats.biggestWin) {
        userStats.biggestWin = amount;
    }
    db.set(userKey, userStats);
}

/**
 * Récupère les statistiques globales d'une guilde
 */
function getGuildStats(guildId, days = 7) {
    const globalKey = `${STATS_PREFIX}${guildId}`;
    const globalStats = db.get(globalKey) || {
        totalGames: 0,
        totalBets: 0,
        totalWins: 0,
        totalLosses: 0,
        totalRevenue: 0,
        gamesByType: {}
    };

    // Calculer les stats des X derniers jours
    const dailyStats = [];
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    for (let i = 0; i < days; i++) {
        const date = new Date(now - (i * oneDay));
        const dateKey = date.toISOString().split('T')[0];
        const dailyKey = `${DAILY_STATS_PREFIX}${guildId}_${dateKey}`;
        const stats = db.get(dailyKey);
        if (stats) {
            dailyStats.push(stats);
        }
    }

    // Calculer les totaux des X derniers jours
    const recentStats = {
        totalGames: dailyStats.reduce((sum, d) => sum + (d.totalGames || 0), 0),
        totalBets: dailyStats.reduce((sum, d) => sum + (d.totalBets || 0), 0),
        totalWins: dailyStats.reduce((sum, d) => sum + (d.totalWins || 0), 0),
        totalLosses: dailyStats.reduce((sum, d) => sum + (d.totalLosses || 0), 0),
        uniquePlayers: new Set()
    };

    dailyStats.forEach(d => {
        if (d.uniquePlayers) {
            d.uniquePlayers.forEach(p => recentStats.uniquePlayers.add(p));
        }
    });
    recentStats.uniquePlayers = Array.from(recentStats.uniquePlayers);

    // Calculer RTP
    const totalPayout = globalStats.totalWins || 0;
    const totalBets = globalStats.totalBets || 1;
    const rtp = totalPayout / totalBets;

    return {
        global: globalStats,
        recent: recentStats,
        rtp: rtp,
        houseEdge: 1 - rtp,
        topGames: Object.entries(globalStats.gamesByType || {})
            .map(([name, stats]) => ({
                name,
                count: stats.count || 0,
                bets: stats.bets || 0,
                wins: stats.wins || 0,
                losses: stats.losses || 0
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
        biggestWins: (globalStats.biggestWins || []).slice(0, 10)
    };
}

/**
 * Récupère les statistiques d'un utilisateur
 */
function getUserStats(userId) {
    const userKey = `${USER_STATS_PREFIX}${userId}`;
    return db.get(userKey) || {
        totalGames: 0,
        totalBets: 0,
        totalWins: 0,
        totalLosses: 0,
        gamesByType: {},
        biggestWin: 0,
        biggestLoss: 0
    };
}

/**
 * Récupère les statistiques d'un jeu spécifique
 */
function getGameStats(guildId, gameName) {
    const gameKey = `${GAME_STATS_PREFIX}${guildId}_${gameName}`;
    const stats = db.get(gameKey) || {
        totalGames: 0,
        totalBets: 0,
        totalWins: 0,
        totalLosses: 0,
        players: []
    };

    const totalPayout = stats.totalWins || 0;
    const totalBets = stats.totalBets || 1;
    const rtp = totalPayout / totalBets;

    return {
        ...stats,
        rtp: rtp,
        houseEdge: 1 - rtp,
        uniquePlayers: (stats.players || []).length
    };
}

/**
 * Nettoie les anciennes statistiques (plus de X jours)
 */
function cleanOldStats(daysToKeep = 30) {
    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const cutoffDate = new Date(cutoff).toISOString().split('T')[0];

    // Nettoyer les stats quotidiennes
    const allKeys = db.all();
    allKeys.forEach(item => {
        if (item.key.startsWith(DAILY_STATS_PREFIX)) {
            const dateMatch = item.key.match(/_(\d{4}-\d{2}-\d{2})$/);
            if (dateMatch && dateMatch[1] < cutoffDate) {
                db.delete(item.key);
            }
        }
    });
}

module.exports = {
    recordGame,
    recordWin,
    getGuildStats,
    getUserStats,
    getGameStats,
    cleanOldStats
};
