const db = require('./simpledb');


class RateLimiter {
  constructor(limit, intervalMs) {
    this.limit = limit;
    this.intervalMs = intervalMs;
    this.map = new Map();
  }
  hit(guildId, userId) {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const info = this.map.get(key) || { count: 0, ts: now };
    if (now - info.ts > this.intervalMs) {
      info.ts = now;
      info.count = 0;
    }
    info.count += 1;
    this.map.set(key, info);
    return info.count;
  }
}

const defaultInsults = [
'fdp', 'ntm', 'pute', 'merde', 'connard', 'salope', 'batard', 'encule', 'bite', 'pd', 'suce', 'pute', 'ta gueule'];


function getGuildSetting(guildId, key, def = false) {
  const val = db.get(`${key}_${guildId}`);
  return typeof val === 'undefined' || val === null ? def : val;
}


const spamBuckets = new Map();
function isSpam(message, limiter) {
  const gid = message.guild.id;
  const enabled = getGuildSetting(gid, 'automod_spam', false);
  if (!enabled) return false;
  const limit = db.get(`automod_spam_limit_${gid}`) ?? 6;
  const windowMs = db.get(`automod_spam_window_ms_${gid}`) ?? 7000;
  const key = `${gid}:${message.author.id}`;
  const now = Date.now();
  const arr = (spamBuckets.get(key) || []).filter((t) => now - t <= windowMs);
  arr.push(now);
  spamBuckets.set(key, arr);
  return arr.length > limit;
}

function hasInsult(message) {
  const enabled = getGuildSetting(message.guild.id, 'automod_insult', false);
  if (!enabled) return false;
  const list = db.get(`automod_insult_list_${message.guild.id}`) || defaultInsults;
  const content = message.content.toLowerCase();
  return list.some((w) => content.includes(w));
}

function isCapsAbuse(message) {
  const enabled = getGuildSetting(message.guild.id, 'automod_caps', false);
  if (!enabled) return false;
  const text = message.content.replace(/[^a-zA-Z]/g, '');
  if (text.length < 12) return false;
  const upper = (text.match(/[A-Z]/g) || []).length;
  return upper / text.length >= 0.7;
}

function isEmojiAbuse(message) {
  const enabled = getGuildSetting(message.guild.id, 'automod_emoji', false);
  if (!enabled) return false;
  const count = (message.content.match(/<a?:\w+:\d+>|[\u203C-\u3299\uD83C\uD000-\uDFFF\uD83D\uD000-\uDFFF\uD83E\uD000-\uDFFF]/g) || []).length;
  return count >= 10;
}

function isMentionAbuse(message) {
  const enabled = getGuildSetting(message.guild.id, 'automod_mention', false);
  if (!enabled) return false;
  const totalMentions = (message.mentions.users?.size || 0) + (message.mentions.roles?.size || 0) + (message.mentions.everyone ? 1 : 0);
  const limit = db.get(`automod_mention_limit_${message.guild.id}`) || 5;
  return totalMentions >= limit;
}


function isInviteLink(message) {
  const enabled = getGuildSetting(message.guild.id, 'automod_invite', false);
  if (!enabled) return false;
  const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/)/i;
  const isCmd = false;
  if (isCmd) return false;
  return inviteRegex.test(message.content);
}

function isGenericLink(message) {
  const enabled = getGuildSetting(message.guild.id, 'automod_link', false);
  if (!enabled) return false;
  const mode = db.get(`automod_link_mode_${message.guild.id}`) || 'block_all';
  const text = message.content;
  const urlRegex = /(https?:\/\/|www\.)\S+/i;
  const domains = Array.from(text.matchAll(/https?:\/\/([^\s/]+)|www\.([^\s/]+)/gi)).map((m) => (m[1] || m[2] || '').toLowerCase());
  const urls = Array.from(text.matchAll(/(https?:\/\/\S+|www\.\S+)/gi)).map((m) => m[1] || m[0]);
  if (mode === 'block_invites_only') {
    const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/)/i;
    return inviteRegex.test(text);
  }
  if (!urlRegex.test(text)) return false;
  const allow = (db.get(`automod_link_allow_${message.guild.id}`) || []).map((d) => String(d).toLowerCase());
  const block = (db.get(`automod_link_block_${message.guild.id}`) || []).map((d) => String(d).toLowerCase());
  const allowExt = (db.get(`automod_link_allow_ext_${message.guild.id}`) || []).map((e) => String(e).replace(/^\./, '').toLowerCase());
  const allowGif = db.get(`automod_link_allow_gif_${message.guild.id}`) === true;
  const allowRegex = (db.get(`automod_link_allow_regex_${message.guild.id}`) || []).map((r) => {try {return new RegExp(r, 'i');} catch {return null;}}).filter(Boolean);
  const blockRegex = (db.get(`automod_link_block_regex_${message.guild.id}`) || []).map((r) => {try {return new RegExp(r, 'i');} catch {return null;}}).filter(Boolean);
  const gifHosts = ['tenor.com', 'giphy.com', 'media.tenor.com', 'i.giphy.com', 'media.giphy.com'];

  const isAllowedByExtOrRegex = (u, d) => {
    const low = u.toLowerCase();
    const ext = (low.match(/\.([a-z0-9]{1,10})(?:\?|#|$)/) || [, ''])[1];
    if (allowGif && (ext === 'gif' || gifHosts.some((h) => (d || '').endsWith(h)))) return true;
    if (ext && allowExt.includes(ext)) return true;
    if (allowRegex.some((rx) => rx.test(low))) return true;
    return false;
  };

  if (mode === 'allowlist') {

    for (let i = 0; i < domains.length; i++) {
      const d = domains[i];
      const u = urls[i] || '';
      const okDomain = allow.some((a) => d.endsWith(a));
      const okOther = isAllowedByExtOrRegex(u, d);
      if (!(okDomain || okOther)) return true;
    }
    return false;
  }

  if (domains.length === 0) return false;

  if (blockRegex.length > 0 && urls.some((u) => blockRegex.some((rx) => rx.test(u)))) return true;
  if (block.length > 0 && domains.some((d) => block.some((b) => d.endsWith(b)))) return true;

  for (let i = 0; i < domains.length; i++) {
    const d = domains[i];
    const u = urls[i] || '';
    if (isAllowedByExtOrRegex(u, d) || allow.some((a) => d.endsWith(a))) {

      continue;
    } else {
      return true;
    }
  }
  return false;
}

function hasZalgo(message) {
  const enabled = getGuildSetting(message.guild.id, 'automod_zalgo', false);
  if (!enabled) return false;
  const combiningMarks = /[\u0300-\u036F\u0483-\u0489\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/;
  return combiningMarks.test(message.content);
}

function isAttachmentAbuse(message) {
  const enabled = getGuildSetting(message.guild.id, 'automod_attach', false);
  if (!enabled) return false;
  const limit = db.get(`automod_attach_limit_${message.guild.id}`) || 3;
  const count = message.attachments?.size || 0;
  return count >= limit;
}

function isLongMessage(message) {
  const enabled = getGuildSetting(message.guild.id, 'automod_long', false);
  if (!enabled) return false;
  const maxLen = db.get(`automod_long_limit_${message.guild.id}`) || 1200;
  return (message.content?.length || 0) >= maxLen;
}

module.exports = {
  RateLimiter,
  isSpam,
  hasInsult,
  isCapsAbuse,
  isEmojiAbuse,
  isMentionAbuse,
  isInviteLink,
  isGenericLink,
  hasZalgo,
  isAttachmentAbuse,
  isLongMessage,
  getGuildSetting
};
