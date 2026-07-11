// talents.js — Système d'arbre de talents casino
const db = require('./simpledb');

const TALENT_TREE = [
  { id: 'slots_gain', name: 'Gains Slots +5%', desc: '+5% gains sur les slots', max: 5 },
  { id: 'roulette_loss', name: 'Pertes Roulette -3%', desc: '-3% pertes sur la roulette', max: 3 },
  { id: 'crit_chance', name: 'Chance Critique', desc: 'Chance de gain x2 rare', max: 1 },
  { id: 'bonus_xp', name: 'XP Bonus', desc: '+10% XP sur tous les jeux', max: 3 },
  { id: 'jackpot_boost', name: 'Boost Jackpot', desc: '+10% chance de jackpot', max: 2 }
];

function getTalentPoints(userId) {
  return db.get(`casino_talent_points_${userId}`) || 0;
}

function getTalents(userId) {
  return db.get(`casino_talents_${userId}`) || {};
}

function addTalentPoint(userId, n = 1) {
  const pts = getTalentPoints(userId) + n;
  db.set(`casino_talent_points_${userId}`, pts);
  return pts;
}

function spendTalentPoint(userId, talentId) {
  const pts = getTalentPoints(userId);
  if (pts <= 0) return false;
  const talents = getTalents(userId);
  const talent = TALENT_TREE.find(t => t.id === talentId);
  if (!talent) return false;
  if ((talents[talentId] || 0) >= talent.max) return false;
  talents[talentId] = (talents[talentId] || 0) + 1;
  db.set(`casino_talents_${userId}`, talents);
  db.set(`casino_talent_points_${userId}`, pts - 1);
  return true;
}

module.exports = {
  TALENT_TREE,
  getTalentPoints,
  getTalents,
  addTalentPoint,
  spendTalentPoint
};
