const { ChannelType } = require('discord.js');
const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

function canUse(client, message) {
  let perm = false;
  message.member.roles.cache.forEach(r => { if (db.get(`modsp_${message.guild.id}_${r.id}`) || db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
  return perm || client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) || db.get(`channelpublic_${message.guild.id}_${message.channel.id}`);
}

function getBoostBenefits(level) {
  return { 0: 'Aucun', 1: 'Emojis, qualité audio', 2: 'Bannière, vanity URL', 3: '1080p/60fps' }[level] || 'Aucun';
}
function getPeakHours() {
  const h = new Date().getHours();
  if (h >= 18 && h <= 23) return '🌇 Soirée';
  if (h >= 12 && h <= 17) return '🌤️ Après-midi';
  if (h >= 8 && h <= 11) return '🌅 Matin';
  return '🌃 Nuit (Très bas)';
}

module.exports = {
  name: 'vc',
  aliases: ['voice', 'voc', 'voicestats'],
  category: 'info',
  description: 'Affiche les statistiques vocales du serveur',
  usage: '',

  run: async (client, message) => {
    if (!canUse(client, message)) return reply(message, errorContainer('**Permission refusée.**'));
    await message.guild.members.fetch().catch(() => {});
    try {
      const voiceChannels = message.guild.channels.cache.filter(ch => ch.type === ChannelType.GuildVoice);
      let totalInVoice = 0, streaming = 0, video = 0, muted = 0, deafened = 0;
      voiceChannels.forEach(ch => {
        totalInVoice += ch.members.size;
        ch.members.forEach(m => {
          if (m.voice.streaming) streaming++;
          if (m.voice.selfVideo) video++;
          if (m.voice.selfMute || m.voice.serverMute) muted++;
          if (m.voice.selfDeaf || m.voice.serverDeaf) deafened++;
        });
      });
      const totalMembers = message.guild.memberCount;
      const online = message.guild.members.cache.filter(m => ['online', 'idle', 'dnd'].includes(m.presence?.status)).size;
      const boostLevel = message.guild.premiumTier;
      const boostCount = message.guild.premiumSubscriptionCount;
      const voicePct = totalInVoice > 0 ? (totalInVoice / totalMembers * 100).toFixed(1) : '0.0';
      const onlinePct = (online / totalMembers * 100).toFixed(1);

      return reply(message, container(
        txt(`## 🎤 Statistiques Vocales — ${message.guild.name}`),
        sep(),
        txt([
          `**👥 Membres :** ${totalMembers.toLocaleString()} (${online.toLocaleString()} en ligne — ${onlinePct}%)`,
          `**🔊 En vocal :** ${totalInVoice.toLocaleString()} (${voicePct}%) — ${voiceChannels.size} salons`,
          `**🎥 Stream :** ${streaming} · **📹 Caméra :** ${video} · **🔇 Muets :** ${muted} · **🔕 Sourds :** ${deafened}`,
          `**💎 Boost :** Niv. ${boostLevel} (${boostCount} boosts) — ${getBoostBenefits(boostLevel)}`,
          `**⏰ Période :** ${getPeakHours()}`
        ].join('\n'))
      ));
    } catch (e) {
      console.error('[vc]', e);
      reply(message, errorContainer('Erreur lors du calcul des statistiques.'));
    }
  },

  detailed: {
    name: 'vcdetail', aliases: ['voicedetail', 'vcd'], description: 'Statistiques vocales détaillées',
    run: async (client, message) => {
      if (!canUse(client, message)) return reply(message, errorContainer('**Permission refusée.**'));
      try {
        const voiceChannels = message.guild.channels.cache.filter(ch => ch.type === ChannelType.GuildVoice).sort((a, b) => b.members.size - a.members.size);
        if (!voiceChannels.size) return reply(message, container(txt('Aucun salon vocal trouvé.')));
        const lines = [];
        let shown = 0;
        voiceChannels.forEach(ch => {
          if (shown >= 10) return;
          const s = ch.members.filter(m => m.voice.streaming).size;
          const v = ch.members.filter(m => m.voice.selfVideo).size;
          lines.push(`**🔊 ${ch.name}** (${ch.members.size}) — ${s} stream · ${v} caméra`);
          shown++;
        });
        return reply(message, container(txt(`## 📊 Vocaux Détaillés — ${voiceChannels.size} salons`), sep(), txt(lines.join('\n'))));
      } catch (e) { reply(message, errorContainer('Erreur d\'analyse.')); }
    }
  }
};
