// skins.js — Système de skins de jeux casino
const db = require('./simpledb');

function getSkins(userId) {
  return db.get(`casino_skins_${userId}`) || [];
}

function equipSkin(userId, skinId) {
  db.set(`casino_skin_equipped_${userId}`, skinId);
}

function getEquippedSkin(userId) {
  return db.get(`casino_skin_equipped_${userId}`) || null;
}

module.exports = {
  getSkins,
  equipSkin,
  getEquippedSkin
};
