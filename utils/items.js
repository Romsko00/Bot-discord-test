const db = require('./simpledb');
const Casino = require('./casino');


const ITEM_DEF_KEY = (name) => `casino_itemdef_${name.toLowerCase()}`;
const ITEM_LIST_KEY = `casino_itemdef_list`;
const USER_INV_KEY = (uid) => `casino_inventory_${uid}`;
const EFFECT_KEY = (uid, effect) => `casino_effect_${effect}_${uid}`;

const DEFAULT_ITEMS = [
{ name: 'antivol', price: 2500, effect: { type: 'shield_steal', durationMs: 24 * 60 * 60 * 1000 }, desc: 'Empêche un vol pendant 24h' },
{ name: 'jeton_chance', price: 1000, effect: { type: 'boost_win_chance', durationMs: 0 }, desc: '+10% chances de victoire au prochain jeu' },
{ name: 'potion_xp', price: 1500, effect: { type: 'xp_boost', durationMs: 60 * 60 * 1000, mult: 1.5 }, desc: '+50% XP Casino pendant 1h' },
{ name: 'anti_tilt', price: 2000, effect: { type: 'cancel_next_loss', durationMs: 0 }, desc: 'Annule la prochaine perte' },
{ name: 'malette_blindee', price: 5000, effect: { type: 'maxbet_increase', durationMs: 2 * 60 * 60 * 1000, amount: 10000 }, desc: 'Augmente maxBet temporairement' },
{ name: 'script_hack', price: 3000, effect: { type: 'hacker_crack', durationMs: 0 }, desc: 'Chance de gains 150% sur un jeu (rare) pour hackers' }];


function ensureDefaults() {
  let list = db.get(ITEM_LIST_KEY);
  if (!Array.isArray(list) || list.length === 0) {
    list = [];
    for (const it of DEFAULT_ITEMS) {
      db.set(ITEM_DEF_KEY(it.name), it);
      list.push(it.name);
    }
    db.set(ITEM_LIST_KEY, list);
  }
}

function listItems() {
  ensureDefaults();
  const names = db.get(ITEM_LIST_KEY) || [];
  return names.map((n) => db.get(ITEM_DEF_KEY(n))).filter(Boolean);
}

function getItem(name) {return db.get(ITEM_DEF_KEY(String(name || '').toLowerCase())) || null;}

function addItemDef(def) {
  ensureDefaults();
  const name = String(def?.name || '').toLowerCase();
  if (!name) return { ok: false, error: 'Nom requis' };
  if (db.get(ITEM_DEF_KEY(name))) return { ok: false, error: 'Existe déjà' };
  const norm = { name, price: Math.max(0, parseInt(def.price || 0, 10)), effect: def.effect || {}, desc: def.desc || '' };
  db.set(ITEM_DEF_KEY(name), norm);
  const list = db.get(ITEM_LIST_KEY) || [];
  list.push(name);
  db.set(ITEM_LIST_KEY, list);
  return { ok: true, item: norm };
}

function removeItemDef(name) {
  const key = ITEM_DEF_KEY(name);
  if (!db.get(key)) return false;
  db.delete(key);
  const list = (db.get(ITEM_LIST_KEY) || []).filter((n) => n !== String(name).toLowerCase());
  db.set(ITEM_LIST_KEY, list);
  return true;
}

function getInventory(uid) {
  return db.get(USER_INV_KEY(uid)) || {};
}

function setInventory(uid, inv) {
  db.set(USER_INV_KEY(uid), inv || {});
}

function addToInventory(uid, name, qty) {
  const inv = getInventory(uid);
  inv[String(name).toLowerCase()] = (inv[String(name).toLowerCase()] || 0) + Math.max(1, parseInt(qty || 1, 10));
  setInventory(uid, inv);
  return inv;
}

function removeFromInventory(uid, name, qty) {
  const inv = getInventory(uid);
  const key = String(name).toLowerCase();
  const cur = inv[key] || 0;
  const take = Math.max(1, parseInt(qty || 1, 10));
  if (cur < take) return false;
  inv[key] = cur - take;
  if (inv[key] <= 0) delete inv[key];
  setInventory(uid, inv);
  return true;
}

function canUse(uid, item) {
  const inv = getInventory(uid);
  return (inv[String(item.name).toLowerCase()] || 0) > 0;
}

function buy(uid, itemName) {
  const item = getItem(itemName);
  if (!item) return { ok: false, error: 'Objet introuvable' };
  if (!Casino.hasEnoughCasino(uid, item.price)) return { ok: false, error: 'Fonds insuffisants' };
  Casino.deductCasinoCredits(uid, item.price);
  addToInventory(uid, item.name, 1);
  return { ok: true, item };
}

function effectActive(uid, effectType) {
  const until = db.get(EFFECT_KEY(uid, effectType));
  if (!until) return false;
  if (until === -1) return true;
  if (until > Date.now()) return true;
  db.delete(EFFECT_KEY(uid, effectType));
  return false;
}

function applyEffect(uid, effect) {
  if (!effect || !effect.type) return;
  const dur = Number(effect.durationMs || 0);
  const until = dur > 0 ? Date.now() + dur : -1;
  db.set(EFFECT_KEY(uid, effect.type), until);
  if (effect.mult) db.set(`casino_effect_mult_${effect.type}_${uid}`, Number(effect.mult));
  if (effect.amount) db.set(`casino_effect_amount_${effect.type}_${uid}`, Number(effect.amount));
}

function getEffectData(uid, effectType, key, fallback = null) {
  return db.get(`casino_effect_${key}_${effectType}_${uid}`) || fallback;
}

function use(uid, itemName) {
  const item = getItem(itemName);
  if (!item) return { ok: false, error: 'Objet introuvable' };
  if (!canUse(uid, item)) return { ok: false, error: 'Objet non disponible' };
  removeFromInventory(uid, item.name, 1);
  applyEffect(uid, item.effect);
  return { ok: true, item };
}

module.exports = {
  listItems,
  getItem,
  addItemDef,
  removeItemDef,
  getInventory,
  addToInventory,
  removeFromInventory,
  buy,
  use,
  effectActive,
  applyEffect
};
