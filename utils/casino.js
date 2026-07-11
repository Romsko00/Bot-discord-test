const db = require('./simpledb');
const config = require('../config.json');
const Enhancements = require('./casinoEnhancements');


const JACKPOT_KEY = 'casino_jackpot_global';
const GUILD_JP_KEY = (guildId) => `casino_jackpot_${guildId}`;
const COOLDOWN_KEY = (userId, cmd) => `casino_cd_${cmd}_${userId}`;
const CASINO_BAL_KEY = (userId) => `casino_credits_${userId}`;
const CASINO_LAST_CLAIM_KEY = (userId) => `casino_last_claim_${userId}`;
const CASINO_STREAK_KEY = (userId) => `casino_streak_${userId}`;


const CASINO_XP_KEY = (userId) => `casino_xp_${userId}`;
const CASINO_LEVEL_KEY = (userId) => `casino_level_${userId}`;


const HISTORY_KEY = (userId, game) => `casino_history_${userId}_${game}`;
const ACHIEVEMENTS_KEY = (userId) => `casino_achievements_${userId}`;

function getCasinoBalance(userId) {
  return db.get(CASINO_BAL_KEY(userId)) || 0;
}

function addCasinoCredits(userId, amount) {
  if (amount > 0) db.add(CASINO_BAL_KEY(userId), amount);
}

function deductCasinoCredits(userId, amount) {
  if (amount > 0) db.subtract(CASINO_BAL_KEY(userId), amount);
}

function hasEnoughCasino(userId, cost) {
  return getCasinoBalance(userId) >= cost;
}

function claimCasinoDaily(userId) {
  const now = Date.now();
  const last = db.get(CASINO_LAST_CLAIM_KEY(userId)) || 0;
  const oneDay = 24 * 60 * 60 * 1000;
  if (now - last < oneDay) {
    return { ok: false, remaining: oneDay - (now - last) };
  }

  const base = config.CASINO && config.CASINO.DAILY_AMOUNT ? config.CASINO.DAILY_AMOUNT : 50;
  let streak = db.get(CASINO_STREAK_KEY(userId)) || 0;


  if (last && now - last <= 2 * oneDay) streak += 1;else streak = 1;

  const bonus = Math.min(streak * 5, 100);
  const total = base + bonus;

  addCasinoCredits(userId, total);
  db.set(CASINO_LAST_CLAIM_KEY(userId), now);
  db.set(CASINO_STREAK_KEY(userId), streak);

  return { ok: true, amount: total, base, bonus, streak };
}

function getJackpot() {
  return db.get(JACKPOT_KEY) || 0;
}

function addToJackpot(amount) {
  if (amount > 0) db.add(JACKPOT_KEY, amount);
}

function tryWinJackpot() {
  const jp = getJackpot();
  if (jp <= 0) return 0;
  if (Math.floor(Math.random() * 5000) === 0) {
    db.set(JACKPOT_KEY, 0);
    return jp;
  }
  return 0;
}

function getGuildJackpot(guildId) {
  return db.get(GUILD_JP_KEY(guildId)) || 0;
}

function addToGuildJackpot(guildId, amount) {
  if (amount > 0) db.add(GUILD_JP_KEY(guildId), amount);
}

function tryWinGuildJackpot(guildId) {
  const jp = getGuildJackpot(guildId);
  if (jp <= 0) return 0;
  if (Math.floor(Math.random() * 5000) === 0) {
    db.set(GUILD_JP_KEY(guildId), 0);
    return jp;
  }
  return 0;
}

function setCooldown(userId, cmd, ms) {
  db.set(COOLDOWN_KEY(userId, cmd), Date.now() + ms);
}

function getCooldownRemaining(userId, cmd) {
  const until = db.get(COOLDOWN_KEY(userId, cmd));
  if (!until) return 0;
  return Math.max(0, until - Date.now());
}

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0) return `${h}h ${min}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}


const symbols = [
{ name: '🍒', weight: 30, payout: 2 },
{ name: '🍋', weight: 25, payout: 3 },
{ name: '<:_:1483497491797377184>', weight: 20, payout: 5 },
{ name: '⭐', weight: 15, payout: 10 },
{ name: '💎', weight: 7, payout: 25 },
{ name: '7️⃣', weight: 3, payout: 100 }];


const reelStrip = (() => {
  const arr = [];
  symbols.forEach((s) => {for (let i = 0; i < s.weight; i++) arr.push(s.name);});
  return arr;
})();

function spinReel() {
  const i = Math.floor(Math.random() * reelStrip.length);
  return reelStrip[i];
}

function spinGrid() {
  const grid = [[], [], []];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      grid[r][c] = spinReel();
    }
  }
  return grid;
}

function evaluateLines(grid, bet) {
  const lines = [
  [[0, 0], [0, 1], [0, 2]],
  [[1, 0], [1, 1], [1, 2]],
  [[2, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 1], [2, 2]],
  [[2, 0], [1, 1], [0, 2]]];

  let total = 0;
  const hits = [];
  for (const line of lines) {
    const [a, b, c] = line.map(([r, col]) => grid[r][col]);
    if (a === b && b === c) {
      const sym = symbols.find((s) => s.name === a);
      const multi = sym ? sym.payout : 0;
      const win = bet * multi;
      total += win;
      hits.push({ line, symbol: a, win });
    }
  }
  return { total, hits };
}


const STAT_KEY = (userId) => `casino_stats_${userId}`;

function getStats(userId) {
  return db.get(STAT_KEY(userId)) || {};
}

function setStats(userId, stats) {
  db.set(STAT_KEY(userId), stats || {});
}

function incStat(userId, field, amount = 1) {
  const stats = getStats(userId);
  stats[field] = (stats[field] || 0) + amount;
  setStats(userId, stats);
}


function getXp(userId) {
  return db.get(CASINO_XP_KEY(userId)) || 0;
}

function getLevel(userId) {
  return db.get(CASINO_LEVEL_KEY(userId)) || 1;
}

function xpNeededForLevel(level) {

  if (level <= 1) return 100;
  return Math.floor(100 + 75 * Math.pow(level - 1, 1.5));
}

function addXp(userId, xp) {
  if (!xp || xp <= 0) return { levelUp: false, level: getLevel(userId), xp: getXp(userId), needed: xpNeededForLevel(getLevel(userId)) };
  const current = getXp(userId);
  const total = current + xp;
  db.set(CASINO_XP_KEY(userId), total);

  let level = getLevel(userId);
  let needed = xpNeededForLevel(level);
  let levelUp = false;
  while (total >= needed) {
    level += 1;
    db.set(CASINO_LEVEL_KEY(userId), level);
    levelUp = true;
    needed = xpNeededForLevel(level);
  }
  return { levelUp, level, xp: total, needed };
}


function computeGameXp({ game, bet = 0, win = false, payout = 0 }) {
  const basePerGame = {
    blackjack: 12,
    slots: 8,
    roulette: 10,
    dice: 9,
    coinflip: 6
  };
  const base = basePerGame[game] || 5;
  const stakeFactor = Math.floor(Math.log2(1 + Math.max(0, bet)));
  const outcomeBonus = win ? 6 : 0;
  const payoutBonus = Math.floor(Math.log2(1 + Math.max(0, payout - bet)));
  const xp = Math.max(1, base + stakeFactor + outcomeBonus + payoutBonus);
  return Math.min(xp, 100);
}

function grantGameXp(userId, context) {
  const xp = computeGameXp(context);
  return addXp(userId, xp);
}


function getVipActive(userId) {
  const until = db.get(`casino_vip_${userId}`);
  return !!until && (until === -1 || until > Date.now());
}

function getXpMultiplier(userId) {
  const prestigeMult = db.get(`casino_xp_mult_${userId}`) || 1.0;
  const vipMult = getVipActive(userId) ? 1.05 : 1.0;
  const boostUntil = db.get(`casino_xpboost_${userId}`);
  const boostMult = boostUntil && boostUntil > Date.now() ? 1.5 : 1.0;
  const total = prestigeMult * vipMult * boostMult;
  return Number(total.toFixed(2));
}

function grantGameXpWithBonuses(userId, context) {
  const base = computeGameXp(context);
  const mult = getXpMultiplier(userId);
  const amount = Math.max(1, Math.floor(base * mult));
  return addXp(userId, amount);
}


function getEmbedColor(guildId, client) {
  const key = `casino_ui_theme_${guildId}`;
  const theme = db.get(key);
  const def = client?.config?.SETTINGS?.EMBED_COLOR || 0x2b2d31;
  if (!theme) return def;
  const map = { dark: 0x2b2d31, light: 0xffffff, blue: 0x2f88ff, red: 0xff3b3b, green: 0x3bff88 };
  if (map[theme]) return map[theme];

  if (typeof theme === 'string' && theme.startsWith('#')) {
    const num = parseInt(theme.slice(1), 16);
    if (!isNaN(num)) return num;
  }
  return def;
}

function getBanner(guildId) {
  return db.get(`casino_ui_banner_${guildId}`) || null;
}


function addHistory(userId, game, record) {
  const key = HISTORY_KEY(userId, game);
  const list = db.get(key) || [];
  const entry = Object.assign({ ts: Date.now() }, record);
  list.unshift(entry);
  const limit = 20;
  const trimmed = list.slice(0, limit);
  db.set(key, trimmed);

  try {db.set(`casino_last_play_${userId}`, Date.now());} catch (_) {}

  try {
    const Teams = require('./casinoTeams');
    const ctx = { game, bet: Number(record?.bet || 0), win: !!record?.win, payout: Number(record?.payout || 0) };
    if (Teams && typeof Teams.grantActivityXp === 'function') {
      Teams.grantActivityXp(userId, ctx);
    }
  } catch (_) {}
  return trimmed;
}

function getHistory(userId, game, limit = 10) {
  const key = HISTORY_KEY(userId, game);
  const list = db.get(key) || [];
  return list.slice(0, limit);
}


function getAchievements(userId) {
  return db.get(ACHIEVEMENTS_KEY(userId)) || {};
}

function grantAchievement(userId, key) {
  const a = getAchievements(userId);
  if (a[key]) return false;
  a[key] = true;
  db.set(ACHIEVEMENTS_KEY(userId), a);
  return true;
}

function checkAndGrantAchievements(userId, { game, bet = 0, win = false, payout = 0 }) {
  const granted = [];

  const firstKey = `first_${game}`;
  if (grantAchievement(userId, firstKey)) granted.push(firstKey);

  if (payout >= 1000 && grantAchievement(userId, 'win_1000_session')) granted.push('win_1000_session');

  const s = getStats(userId);
  const loseFields = {
    blackjack: 'bj_losses',
    roulette: 'roulette_losses',
    dice: 'dice_losses',
    coinflip: 'flip_losses',
    slots: 'slots_losses'
  };
  const lf = loseFields[game];
  if (lf && (s[lf] || 0) >= 10) {
    if (grantAchievement(userId, `lose_10_${game}`)) granted.push(`lose_10_${game}`);
  }
  return granted;
}


/**
 * Débloque un achievement pour un utilisateur, crédite la récompense si présente.
 * @param {string} userId
 * @param {string} key
 * @param {{name?: string, description?: string, reward?: number}} [meta]
 * @returns {boolean} true si débloqué, false si déjà obtenu
 */
function unlockAchievement(userId, key, meta = {}) {
  const a = getAchievements(userId);
  if (a[key]) return false;
  a[key] = {
    unlockedAt: Date.now(),
    name: meta.name || key,
    description: meta.description || '',
    reward: meta.reward || 0
  };
  db.set(ACHIEVEMENTS_KEY(userId), a);
  if (meta.reward && meta.reward > 0) {
    addCasinoCredits(userId, meta.reward);
  }
  return true;
}

module.exports = {
  getCasinoBalance,
  addCasinoCredits,
  deductCasinoCredits,
  hasEnoughCasino,
  claimCasinoDaily,

  getJackpot,
  addToJackpot,
  tryWinJackpot,
  getGuildJackpot,
  addToGuildJackpot,
  tryWinGuildJackpot,
  setCooldown,
  getCooldownRemaining,
  formatMs,

  spinGrid,
  evaluateLines,
  symbols,

  getStats,
  setStats,
  incStat,

  getXp,
  getLevel,
  addXp,
  xpNeededForLevel,
  computeGameXp,
  grantGameXp,

  getVipActive,
  getXpMultiplier,
  grantGameXpWithBonuses,

  addHistory,
  getHistory,

  getAchievements,
  grantAchievement,
  unlockAchievement,
  checkAndGrantAchievements,

  // Enhancements
  ...Enhancements
};
