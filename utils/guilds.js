// guilds.js — Système de guildes avancées casino
const db = require('./simpledb');

function getGuildData(guildId) {
  return db.get(`casino_guild_${guildId}`) || { level: 1, xp: 0, members: [], quests: [], wars: [], bonuses: {} };
}

function addGuildXP(guildId, xp) {
  const data = getGuildData(guildId);
  data.xp += xp;
  // Level up
  const needed = 1000 + (data.level - 1) * 500;
  if (data.xp >= needed) {
    data.level++;
    data.xp -= needed;
  }
  db.set(`casino_guild_${guildId}`, data);
  return data;
}

function addMember(guildId, userId) {
  const data = getGuildData(guildId);
  if (!data.members.includes(userId)) data.members.push(userId);
  db.set(`casino_guild_${guildId}`, data);
}

function getQuests(guildId) {
  const data = getGuildData(guildId);
  return data.quests || [];
}

function addQuest(guildId, quest) {
  const data = getGuildData(guildId);
  data.quests = data.quests || [];
  data.quests.push(quest);
  db.set(`casino_guild_${guildId}`, data);
}

function startWar(guildId, opponentId) {
  const data = getGuildData(guildId);
  data.wars = data.wars || [];
  data.wars.push({ opponent: opponentId, start: Date.now(), score: 0 });
  db.set(`casino_guild_${guildId}`, data);
}

module.exports = {
  getGuildData,
  addGuildXP,
  addMember,
  getQuests,
  addQuest,
  startWar
};
