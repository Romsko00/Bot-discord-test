// season.js — Système de saison casino (battle pass)
const db = require('./simpledb');

const SEASON_ID = '2025-12'; // À incrémenter à chaque nouvelle saison
const SEASON_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 jours
const SEASON_START = Date.UTC(2025, 11, 1); // 1er décembre 2025

const REWARDS = [
  { level: 1, free: '100 JTN', vip: '200 JTN' },
  { level: 2, free: 'Badge Bronze', vip: 'Badge Silver' },
  { level: 3, free: 'Background Hiver', vip: 'Background Hiver Animé' },
  { level: 4, free: '500 JTN', vip: '1000 JTN' },
  { level: 5, free: 'Titre "Winter Grinder"', vip: 'Titre "Winter King"' },
  // ...
];

function getSeasonProgress(userId) {
  return db.get(`casino_season_${SEASON_ID}_progress_${userId}`) || 0;
}

function addSeasonXP(userId, xp) {
  const current = getSeasonProgress(userId);
  db.set(`casino_season_${SEASON_ID}_progress_${userId}`, current + xp);
  return current + xp;
}

function getSeasonRewards(userId) {
  return db.get(`casino_season_${SEASON_ID}_rewards_${userId}`) || {};
}

function claimReward(userId, level, vip = false) {
  const rewards = getSeasonRewards(userId);
  if (rewards[level]) return false;
  rewards[level] = true;
  db.set(`casino_season_${SEASON_ID}_rewards_${userId}`, rewards);
  // Attribution réelle à faire selon le type de récompense
  return true;
}

function getCurrentSeason() {
  return {
    id: SEASON_ID,
    start: SEASON_START,
    end: SEASON_START + SEASON_DURATION,
    rewards: REWARDS
  };
}

module.exports = {
  getSeasonProgress,
  addSeasonXP,
  getSeasonRewards,
  claimReward,
  getCurrentSeason
};
