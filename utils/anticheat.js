// anticheat.js — Système anti-abus et économie saine casino
const db = require('./simpledb');

function logAction(userId, action) {
  const logs = db.get(`casino_logs_${userId}`) || [];
  logs.push({ action, ts: Date.now() });
  db.set(`casino_logs_${userId}`, logs);
}

function checkSpam(userId, limit = 5, windowMs = 10000) {
  const logs = db.get(`casino_logs_${userId}`) || [];
  const now = Date.now();
  const recent = logs.filter(l => now - l.ts < windowMs);
  return recent.length > limit;
}

function applyTax(userId, amount, rate = 0.05) {
  const taxed = Math.floor(amount * rate);
  // Retirer le taxé du gain
  return amount - taxed;
}

function detectWhale(userId) {
  // Détection simple : gros gains fréquents
  const logs = db.get(`casino_logs_${userId}`) || [];
  const bigWins = logs.filter(l => l.action === 'win' && l.amount > 10000);
  return bigWins.length > 3;
}

module.exports = {
  logAction,
  checkSpam,
  applyTax,
  detectWhale
};
