/**
 * Helpers pour les statistiques niveau / messages / vocal d'un membre sur un serveur.
 */

const db = require('./simpledb');

const XP_PER_LEVEL = 500;

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function getMessageCountForDays(guildId, userId, days) {
  const end = new Date();
  let total = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const key = `msg_day_${guildId}_${userId}_${dateKey(d)}`;
    total += db.get(key) || 0;
  }
  return total;
}

function getMessageStats(guildId, userId) {
  const total = db.get(`msg_${guildId}_${userId}`) || 0;
  return {
    total,
    d2: getMessageCountForDays(guildId, userId, 2),
    d7: getMessageCountForDays(guildId, userId, 7),
    d14: getMessageCountForDays(guildId, userId, 14),
    d30: getMessageCountForDays(guildId, userId, 30)
  };
}

function getVoiceStats(guildId, userId) {
  const minutes = db.get(`voice_minutes_${guildId}_${userId}`) || 0;
  const sessions = db.get(`voice_sessions_${guildId}_${userId}`) || 0;
  return { minutes, sessions };
}

function getLevelStats(guildId, userId, xpPerLevel = XP_PER_LEVEL) {
  const level = db.get(`guild_${guildId}_level_${userId}`) || 1;
  const currentXP = db.get(`guild_${guildId}_xp_${userId}`) || 0;
  const xpNeeded = level * xpPerLevel;
  const progress = Math.min((currentXP / xpNeeded) * 100, 100);
  const xpForNext = Math.max(0, xpNeeded - currentXP);
  return { level, currentXP, xpNeeded, progress, xpForNext };
}

function getMessageRank(guildId, userId) {
  const all = db.all()
    .filter(d => d.ID.startsWith(`msg_${guildId}_`) && !d.ID.includes('_day_'))
    .map(d => {
      const uid = d.ID.replace(`msg_${guildId}_`, '');
      if (uid.includes('_')) return null;
      return { userId: uid, count: d.data };
    })
    .filter(Boolean)
    .sort((a, b) => (b.count || 0) - (a.count || 0));
  const idx = all.findIndex(u => u.userId === userId);
  return idx === -1 ? null : { rank: idx + 1, total: all.length };
}

function getVoiceRank(guildId, userId) {
  const all = db.all()
    .filter(d => d.ID.startsWith(`voice_minutes_${guildId}_`))
    .map(d => {
      const uid = d.ID.replace(`voice_minutes_${guildId}_`, '');
      return { userId: uid, minutes: d.data || 0 };
    })
    .sort((a, b) => (b.minutes || 0) - (a.minutes || 0));
  const idx = all.findIndex(u => u.userId === userId);
  return idx === -1 ? null : { rank: idx + 1, total: all.length };
}

function getActivityLast14Days(guildId, userId) {
  const result = [];
  const end = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const key = `msg_day_${guildId}_${userId}_${dateKey(d)}`;
    result.push({
      date: dateKey(d),
      messages: db.get(key) || 0
    });
  }
  return result;
}

function getMessageRecord(guildId, userId) {
  let max = 0;
  let recordDate = null;
  const end = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const key = `msg_day_${guildId}_${userId}_${dateKey(d)}`;
    const count = db.get(key) || 0;
    if (count > max) {
      max = count;
      recordDate = dateKey(d);
    }
  }
  return { count: max, date: recordDate };
}

function getActiveDays(guildId, userId) {
  let days = 0;
  const end = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const key = `msg_day_${guildId}_${userId}_${dateKey(d)}`;
    if ((db.get(key) || 0) > 0) days++;
  }
  return days;
}

const BADGES = [
  { id: 'first_msg', label: '1er message', req: { messages: 1 } },
  { id: '100_msg', label: '100 msgs', req: { messages: 100 } },
  { id: '500_msg', label: '500 msgs', req: { messages: 500 } },
  { id: '1k_msg', label: '1k msgs', req: { messages: 1000 } },
  { id: '5k_msg', label: '5k msgs', req: { messages: 5000 } },
  { id: '10k_msg', label: '10k msgs', req: { messages: 10000 } },
  { id: '1h_voice', label: '1h vocal', req: { voiceMinutes: 60 } },
  { id: '10h_voice', label: '10h vocal', req: { voiceMinutes: 600 } },
  { id: '50h_voice', label: '50h vocal', req: { voiceMinutes: 3000 } },
  { id: 'streak_3', label: 'Streak 3j', req: { streak: 3 } },
  { id: 'streak_7', label: 'Streak 7j', req: { streak: 7 } },
  { id: 'lvl_5', label: 'Niveau 5', req: { level: 5 } },
  { id: 'lvl_10', label: 'Niveau 10', req: { level: 10 } },
  { id: 'lvl_25', label: 'Niveau 25', req: { level: 25 } },
  { id: 'lvl_50', label: 'Niveau 50', req: { level: 50 } }
];

function getAccomplishments(guildId, userId) {
  const { level } = getLevelStats(guildId, userId);
  const msgStats = getMessageStats(guildId, userId);
  const voiceStats = getVoiceStats(guildId, userId);
  const activity = getActivityLast14Days(guildId, userId);
  let streak = 0;
  for (let i = activity.length - 1; i >= 0; i--) {
    if (activity[i].messages > 0) streak++;
    else break;
  }
  const unlocked = [];
  const next = [];
  for (const b of BADGES) {
    let ok = false;
    if (b.req.messages != null) ok = msgStats.total >= b.req.messages;
    else if (b.req.voiceMinutes != null) ok = voiceStats.minutes >= b.req.voiceMinutes;
    else if (b.req.level != null) ok = level >= b.req.level;
    else if (b.req.streak != null) ok = streak >= b.req.streak;
    if (ok) unlocked.push(b);
    else next.push(b);
  }
  return { unlocked, next: next.slice(0, 5) };
}

module.exports = {
  getMessageStats,
  getVoiceStats,
  getLevelStats,
  getMessageRank,
  getVoiceRank,
  getActivityLast14Days,
  getMessageRecord,
  getActiveDays,
  getAccomplishments,
  dateKey,
  BADGES
};
