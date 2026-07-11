const db = require('../../utils/simpledb');
const Casino = require('../../utils/casino');
const CasinoConfig = require('../../utils/casinoConfig');

function getXpRequired(guildId, level) {
  const preset = db.get(`levels_formula_${guildId}`) || 'quadratic';
  switch (preset) {
    case 'linear':       return level * 100;
    case 'progressive':  return level * 50 + level * level * 5;
    case 'hard':         return level * level * level;
    case 'quadratic':
    default:             return level * level * 10;
  }
}

function assignRewards(guild, userId, guildId, newLevel) {
  const member = guild.members.cache.get(userId);
  if (!member) return;
  const rewards = db.get(`level_rewards_${guildId}`) || [];
  for (const { level, roleId } of rewards) {
    if (newLevel >= level && !member.roles.cache.has(roleId)) {
      member.roles.add(roleId).catch(() => {});
    }
  }
}

module.exports = async (client, oldState, newState) => {
  const userId = newState.id;
  const guildId = newState.guild.id;

  if (!oldState.channelId && newState.channelId) {
    db.set(`voice_join_${guildId}_${userId}`, Date.now());
  }

  if (oldState.channelId && !newState.channelId) {
    if (db.get(`levels_enabled_${guildId}`) === false) {
      db.delete(`voice_join_${guildId}_${userId}`);
    } else {
      const joinTime = db.get(`voice_join_${guildId}_${userId}`);
      if (joinTime) {
        const timeSpent = Date.now() - joinTime;
        const minutesSpent = Math.floor(timeSpent / 60000);

        if (minutesSpent >= 1) {
          const voiceXpPerMin = client.config?.LEVELS?.VOICE_XP_PER_MINUTE ?? 2;
          const xpGained = minutesSpent * voiceXpPerMin;
          db.add(`guild_${guildId}_xp_${userId}`, xpGained);
          db.add(`voice_minutes_${guildId}_${userId}`, minutesSpent);
          db.add(`voice_sessions_${guildId}_${userId}`, 1);

          const currentLevel = db.get(`guild_${guildId}_level_${userId}`) || 1;
          const currentXP = db.get(`guild_${guildId}_xp_${userId}`) || 0;
          const xpNeeded = getXpRequired(guildId, currentLevel);

          if (currentXP >= xpNeeded) {
            const newLevel = currentLevel + 1;
            db.set(`guild_${guildId}_level_${userId}`, newLevel);
            db.subtract(`guild_${guildId}_xp_${userId}`, xpNeeded);

            assignRewards(newState.guild, userId, guildId, newLevel);

            const user = client.users.cache.get(userId);
            const chanId = db.get(`levelchannel_${guildId}`);
            const levelChannel = chanId ? client.channels.cache.get(chanId) : null;

            if (levelChannel && user) {
              const { EmbedBuilder } = require('discord.js');
              const levelEmbed = new EmbedBuilder()
                .setTitle('🎉 Niveau Supérieur ! (Vocal)')
                .setDescription(`Félicitations ${user} ! Tu viens de passer au niveau **${newLevel}** grâce à ton activité vocale !`)
                .setColor(client.config?.SETTINGS?.EMBED_COLOR ?? 0x5b58e2)
                .addFields(
                  { name: '📊 Nouveau niveau', value: `${newLevel}`, inline: true },
                  { name: '🎤 XP vocal gagné', value: `${xpGained} XP`, inline: true },
                  { name: '⏱️ Temps passé', value: `${minutesSpent} minutes`, inline: true }
                )
                .setThumbnail(user.displayAvatarURL({ dynamic: true }));
              levelChannel.send({ embeds: [levelEmbed] }).catch(() => {});
            }
          }

          try {
            const cfg = CasinoConfig.getGuildConfig(guildId);
            const voiceCfg = cfg.autoGains?.voice?.[oldState.channelId || newState.channelId];
            if (voiceCfg && minutesSpent > 0) {
              const perMinute = Number(voiceCfg.perMinute || 0);
              const bonusStreaming = Number(voiceCfg.bonusStreaming || 0);
              const bonusCamera = Number(voiceCfg.bonusCamera || 0);
              const maxPerHour = Number(voiceCfg.maxPerHour || 0);
              let gain = perMinute > 0 ? perMinute * minutesSpent : 0;
              if (oldState.streaming && bonusStreaming > 0) gain += bonusStreaming * minutesSpent;
              if (oldState.selfVideo && bonusCamera > 0) gain += bonusCamera * minutesSpent;
              if (gain > 0) {
                const baseKey = `casino_autogain_voice_${guildId}_${userId}`;
                if (maxPerHour > 0) {
                  const hourData = db.get(baseKey + '_hour') || { since: Date.now(), total: 0 };
                  if (Date.now() - hourData.since >= 3_600_000) { hourData.since = Date.now(); hourData.total = 0; }
                  if (hourData.total < maxPerHour) {
                    const actualGain = Math.min(maxPerHour - hourData.total, gain);
                    if (actualGain > 0) { hourData.total += actualGain; db.set(baseKey + '_hour', hourData); Casino.addCasinoCredits(userId, actualGain); }
                  }
                } else { Casino.addCasinoCredits(userId, gain); }
              }
            }
          } catch (_) {}
        }

        db.delete(`voice_join_${guildId}_${userId}`);
      }
    }
  }

  if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    db.set(`voice_join_${guildId}_${userId}`, Date.now());
  }
};
