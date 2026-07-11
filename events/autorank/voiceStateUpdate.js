const { getConfig, inc, resetWindowIfNeeded, evaluateUserForAutorank } = require('../../utils/autorank');

module.exports = async (client, oldState, newState) => {
  try {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;
    const guildId = guild.id;

    const config = getConfig(guildId);
    if (!config.enabled) return;

    const userId = newState.id;


    if (!client.__arVoiceJoin) client.__arVoiceJoin = new Map();
    const key = `${guildId}:${userId}`;

    if (!oldState.channelId && newState.channelId) {
      client.__arVoiceJoin.set(key, Date.now());
      return;
    }

    if (oldState.channelId && !newState.channelId) {
      const joinedAt = client.__arVoiceJoin.get(key);
      if (joinedAt) {
        const minutes = Math.floor((Date.now() - joinedAt) / 60000);
        client.__arVoiceJoin.delete(key);
        if (minutes > 0) {
          resetWindowIfNeeded(guildId, userId, config.timeWindowDays || 7);
          inc(guildId, userId, { voiceMinutes: minutes });
          const member = guild.members.cache.get(userId);
          if (member) await evaluateUserForAutorank(client, guild, member);
        }
      }
    }


    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      client.__arVoiceJoin.set(key, Date.now());
    }
  } catch (_) {}
};
