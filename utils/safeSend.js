const logger = require('../utils/logger');

function hasPerms(memberMe, channel, needsEmbed) {
  try {
    if (!channel || !memberMe) return false;
    const perms = memberMe.permissionsIn(channel);
    return perms.has('ViewChannel') && perms.has('SendMessages') && (!needsEmbed || perms.has('EmbedLinks'));
  } catch (_) {return false;}
}

function findFallback(guild, needsEmbed) {
  try {
    const me = guild.members.me;

    const sys = guild.systemChannel;
    if (sys && hasPerms(me, sys, needsEmbed)) return sys;

    const c = guild.channels.cache.find((ch) => ch.isTextBased?.() && hasPerms(me, ch, needsEmbed));
    return c || null;
  } catch (_) {return null;}
}











async function safeSend(client, guild, preferredChannelId, payload, needsEmbed = false, contextTag = 'SAFE') {
  try {
    const me = guild.members.me;
    let channel = null;
    
    // Essayer d'obtenir le salon préféré
    if (preferredChannelId) {
      try {
        channel = guild.channels.cache.get(preferredChannelId);
        if (!channel) {
          channel = await client.channels.fetch(preferredChannelId).catch(() => null);
        }
      } catch (err) {
        logger.debug && logger.debug(`[${contextTag}] Failed to fetch channel ${preferredChannelId}: ${err?.message}`);
        channel = null;
      }
    }
    
    // Vérifier les permissions
    if (!hasPerms(me, channel, needsEmbed)) channel = null;
    
    // Chercher un salon de secours
    if (!channel) channel = findFallback(guild, needsEmbed);
    
    if (!channel) {
      try {logger.warn && logger.warn(`[${contextTag}] No sendable channel in guild ${guild.id}`);} catch (_) {}
      return false;
    }
    
    await channel.send(payload);
    return true;
  } catch (err) {
    try {logger.error && logger.error(`[${contextTag}] Error sending message: ${err?.message || err}`);} catch (_) {}
    return false;
  }
}

module.exports = { safeSend, hasPerms, findFallback };
