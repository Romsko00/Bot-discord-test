const db = require('./simpledb');








const HIST_KEY = (userId) => `casino_risk_hist_${userId}`;

function recordPlay(userId, { bet = 0, payout = 0 }) {
  const list = db.get(HIST_KEY(userId)) || [];
  list.unshift({ ts: Date.now(), bet, payout });
  db.set(HIST_KEY(userId), list.slice(0, 30));
}

function computeRisk(userId) {
  const list = db.get(HIST_KEY(userId)) || [];
  if (list.length === 0) return 0;

  let wins = 0,sumRatio = 0;
  const now = Date.now();
  let recent = 0;
  for (const it of list) {
    if (now - it.ts < 30 * 60 * 1000) recent++;
    const ratio = it.bet > 0 ? it.payout / it.bet : 0;
    sumRatio += ratio;
    if (it.payout > it.bet) wins++;
  }
  const avgRatio = sumRatio / list.length;
  const winRate = wins / list.length;
  const recency = recent / Math.max(1, list.length);
  let score = 0;

  score += Math.min(avgRatio / 3, 1) * 0.5;

  score += winRate * 0.3;

  score += recency * 0.2;

  score = Math.max(0, Math.min(1, score));
  return score;
}

function getEdgePenalty(userId) {
  const risk = computeRisk(userId);

  const penalty = Math.min(0.1, Number((risk * 0.1).toFixed(3)));
  return { risk, penalty };
}

function getMaxBetWithRisk(userId, baseMax) {
  const { penalty } = getEdgePenalty(userId);
  const factor = 1 - penalty;
  return Math.max(1, Math.floor(baseMax * factor));
}

module.exports = {
  recordPlay,
  computeRisk,
  getEdgePenalty,
  getMaxBetWithRisk
};
