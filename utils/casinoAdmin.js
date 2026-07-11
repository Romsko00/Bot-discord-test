const db = require('./simpledb');
const logger = require('./logger');


const AUDIT_LOG_KEY = (guildId) => `casino_audit_${guildId}`;
const SUSPEND_KEY = (guildId, userId) => `casino_suspend_${guildId}_${userId}`;

function addAudit(guildId, entry) {
  const key = AUDIT_LOG_KEY(guildId);
  const list = db.get(key) || [];
  const record = {
    ts: Date.now(),
    ...entry
  };
  list.unshift(record);
  db.set(key, list.slice(0, 500));
  return record;
}

function getAudit(guildId, { userId, type, fromTs, toTs, limit = 50 } = {}) {
  let list = db.get(AUDIT_LOG_KEY(guildId)) || [];
  if (userId) list = list.filter((e) => e.userId === userId);
  if (type) list = list.filter((e) => e.type === type);
  if (fromTs) list = list.filter((e) => e.ts >= fromTs);
  if (toTs) list = list.filter((e) => e.ts <= toTs);
  return list.slice(0, limit);
}

function suspendUser(guildId, userId, reason = 'unspecified', durationMs = 0) {
  const until = durationMs > 0 ? Date.now() + durationMs : -1;
  db.set(SUSPEND_KEY(guildId, userId), { until, reason });
  try {addAudit(guildId, { type: 'suspend', userId, reason, durationMs });} catch (e) {logger && logger.warn && logger.warn('[casinoAdmin] audit fail', e);}
  return { until, reason };
}

function unsuspendUser(guildId, userId) {
  db.delete(SUSPEND_KEY(guildId, userId));
  try {addAudit(guildId, { type: 'unsuspend', userId });} catch (e) {}
}

function isSuspended(guildId, userId) {
  const rec = db.get(SUSPEND_KEY(guildId, userId));
  if (!rec) return false;
  if (rec.until === -1) return true;
  if (Date.now() <= rec.until) return true;

  db.delete(SUSPEND_KEY(guildId, userId));
  return false;
}

module.exports = {
  addAudit,
  getAudit,
  suspendUser,
  unsuspendUser,
  isSuspended
};
