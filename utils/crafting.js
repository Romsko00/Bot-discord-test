// crafting.js — Système de crafting casino
const db = require('./simpledb');

function getResources(userId) {
  return db.get(`casino_resources_${userId}`) || {};
}

function addResource(userId, type, amount) {
  const res = getResources(userId);
  res[type] = (res[type] || 0) + amount;
  db.set(`casino_resources_${userId}`, res);
}

function craftItem(userId, recipe) {
  const res = getResources(userId);
  for (const [type, amt] of Object.entries(recipe.require)) {
    if ((res[type] || 0) < amt) return false;
  }
  for (const [type, amt] of Object.entries(recipe.require)) {
    res[type] -= amt;
  }
  db.set(`casino_resources_${userId}`, res);
  // Ajout de l'objet à l'inventaire
  const items = db.get(`casino_items_${userId}`) || {};
  items[recipe.result] = { level: 1, xp: 0 };
  db.set(`casino_items_${userId}`, items);
  return true;
}

module.exports = {
  getResources,
  addResource,
  craftItem
};
