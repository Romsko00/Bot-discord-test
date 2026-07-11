// globalCasino.js — Casino multi-serveurs interconnecté
const db = require('./simpledb');

function getGlobalStats() {
  return db.get('casino_global_stats') || { totalJTN: 0, totalPlayers: 0, jackpot: 0 };
}

function updateGlobalStats({ jtn = 0, players = 0, jackpot = 0 }) {
  const stats = getGlobalStats();
  stats.totalJTN += jtn;
  stats.totalPlayers += players;
  stats.jackpot = Math.max(stats.jackpot, jackpot);
  db.set('casino_global_stats', stats);
}

function getGlobalLeaderboard() {
  return db.get('casino_global_leaderboard') || [];
}

module.exports = {
  getGlobalStats,
  updateGlobalStats,
  getGlobalLeaderboard
};
