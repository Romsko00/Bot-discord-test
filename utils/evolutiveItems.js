// evolutiveItems.js — Système d'objets évolutifs casino
const db = require('./simpledb');

function getItem(userId, itemId) {
  const items = db.get(`casino_items_${userId}`) || {};
  return items[itemId] || { level: 1, xp: 0 };
}

function addItemXP(userId, itemId, xp) {
  const items = db.get(`casino_items_${userId}`) || {};
  const item = items[itemId] || { level: 1, xp: 0 };
  item.xp += xp;
  // Level up
  const needed = item.level * 100;
  if (item.xp >= needed) {
    item.level++;
    item.xp -= needed;
  }
  items[itemId] = item;
  db.set(`casino_items_${userId}`, items);
  return item;
}

function getAllItems(userId) {
  return db.get(`casino_items_${userId}`) || {};
}

module.exports = {
  getItem,
  addItemXP,
  getAllItems
};
