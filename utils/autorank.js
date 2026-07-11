const db = require('./simpledb');
const { EmbedBuilder } = require('discord.js');

function getConfig(guildId) {
  return db.get(`autorank_config_${guildId}`) || {
    enabled: false,
    allowedChannels: [],
    requiredMentionUserId: null,
    requiredMessageText: null,
    useRegex: false,
    thresholds: {
      messages: 0,
      words: 0,
      chars: 0,
      attachments: 0,
      links: 0,
      mentions: 0,
      voiceMinutes: 0,
      daysSinceJoin: 0,
      reactionsGiven: 0,
      reactionsReceived: 0
    },
    timeWindowDays: 7,
    rolesToGrant: [],
    logChannelId: null,
    successMessage: 'Félicitations {user} ! Tu as obtenu le rôle {roles}.'
  };
}

function setConfig(guildId, patch) {
  const current = getConfig(guildId);
  const next = { ...current, ...patch };
  if (patch.thresholds) next.thresholds = { ...current.thresholds, ...patch.thresholds };
  if (patch.allowedChannels) next.allowedChannels = Array.from(new Set(patch.allowedChannels));
  if (patch.rolesToGrant) next.rolesToGrant = Array.from(new Set(patch.rolesToGrant));
  db.set(`autorank_config_${guildId}`, next);
  return next;
}

function getStats(guildId, userId) {
  const stats = db.get(`autorank_stats_${guildId}_${userId}`) || {
    since: Date.now(),
    messages: 0,
    words: 0,
    chars: 0,
    attachments: 0,
    links: 0,
    mentions: 0,
    voiceMinutes: 0,
    reactionsGiven: 0,
    reactionsReceived: 0,
    specialMessages: 0
  };
  return stats;
}

function resetWindowIfNeeded(guildId, userId, timeWindowDays) {
  const stats = getStats(guildId, userId);
  const windowMs = Math.max(1, timeWindowDays) * 24 * 60 * 60 * 1000;
  if (Date.now() - stats.since > windowMs) {
    db.set(`autorank_stats_${guildId}_${userId}`, {
      since: Date.now(),
      messages: 0,
      words: 0,
      chars: 0,
      attachments: 0,
      links: 0,
      mentions: 0,
      voiceMinutes: 0,
      reactionsGiven: 0,
      reactionsReceived: 0,
      specialMessages: 0
    });
  }
}

function inc(guildId, userId, patch) {
  const stats = getStats(guildId, userId);
  const next = { ...stats };
  for (const [k, v] of Object.entries(patch)) {
    next[k] = Math.max(0, (next[k] || 0) + (v || 0));
  }
  db.set(`autorank_stats_${guildId}_${userId}`, next);
  return next;
}

function passesRequiredMessage(config, message) {
  if (!config.requiredMessageText && !config.requiredMentionUserId) return true;
  let contentOk = true;
  if (config.requiredMessageText) {
    if (config.useRegex) {
      try {
        const re = new RegExp(config.requiredMessageText, 'i');
        contentOk = re.test(message.content);
      } catch (_) {contentOk = false;}
    } else {
      contentOk = message.content.toLowerCase().includes(String(config.requiredMessageText).toLowerCase());
    }
  }
  let mentionOk = true;
  if (config.requiredMentionUserId) {
    mentionOk = message.mentions?.users?.has(config.requiredMentionUserId) || false;
  }
  return contentOk && mentionOk;
}

async function evaluateUserForAutorank(client, guild, member) {
  const guildId = guild.id;
  const userId = member.id;
  const config = getConfig(guildId);
  if (!config.enabled) return false;

  resetWindowIfNeeded(guildId, userId, config.timeWindowDays);
  const stats = getStats(guildId, userId);

  const th = config.thresholds || {};
  const meets =
  stats.messages >= (th.messages || 0) &&
  stats.words >= (th.words || 0) &&
  stats.chars >= (th.chars || 0) &&
  stats.attachments >= (th.attachments || 0) &&
  stats.links >= (th.links || 0) &&
  stats.mentions >= (th.mentions || 0) &&
  stats.voiceMinutes >= (th.voiceMinutes || 0);



  if ((config.requiredMessageText || config.requiredMentionUserId) && (stats.specialMessages || 0) <= 0) {
    return false;
  }

  const daysSinceJoinReq = th.daysSinceJoin || 0;
  let daysOk = true;
  if (daysSinceJoinReq > 0) {
    const joinedAt = member.joinedAt || member.joinedTimestamp ? new Date(member.joinedTimestamp || member.joinedAt) : null;
    if (joinedAt) {
      const days = Math.floor((Date.now() - joinedAt.getTime()) / (24 * 60 * 60 * 1000));
      daysOk = days >= daysSinceJoinReq;
    }
  }

  if (!(meets && daysOk)) return false;


  const grantedKey = `autorank_granted_${guildId}_${userId}_${stats.since}`;
  if (db.get(grantedKey)) return false;

  const rolesToGrant = (config.rolesToGrant || []).filter((r) => !member.roles.cache.has(r));
  if (rolesToGrant.length === 0) {
    db.set(grantedKey, true);
    return false;
  }

  try {
    for (const roleId of rolesToGrant) {
      await member.roles.add(roleId).catch(() => {});
    }
  } catch (_) {}

  db.set(grantedKey, true);


  const rolesMention = rolesToGrant.map((r) => `<@&${r}>`).join(', ');
  const msg = (config.successMessage || '').replace('{user}', `<@${userId}>`).replace('{roles}', rolesMention);
  const logChannel = config.logChannelId ? guild.channels.cache.get(config.logChannelId) : null;
  const embed = new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(msg || `Autorank -> ${member} : ${rolesMention}`).setTimestamp();
  try {(logChannel || guild.systemChannel)?.send({ embeds: [embed] });} catch (_) {}
  return true;
}

module.exports = {
  getConfig,
  setConfig,
  getStats,
  inc,
  evaluateUserForAutorank,
  resetWindowIfNeeded,
  passesRequiredMessage
};
