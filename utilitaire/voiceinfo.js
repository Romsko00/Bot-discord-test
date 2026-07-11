const Discord = require('discord.js');
const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'voiceinfo', aliases: ['voc', 'vinfo'],
  description: 'Informations sur les salons vocaux',
  run: async (client, message, args) => {
    let perm = false;
    message.member.roles.cache.forEach(r => { if (db.get(`modsp_${message.guild.id}_${r.id}`) || db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
    const allowed = perm || client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true || db.get(`channelpublic_${message.guild.id}_${message.channel.id}`) === true;
    if (!allowed) return reply(message, errorContainer('Permission refusée.'));
    let streaming = 0, deafened = 0, muted = 0, camera = 0, total = 0;
    const channels = message.guild.channels.cache.filter(c => c.type === Discord.ChannelType.GuildVoice);
    channels.forEach(c => { total += c.members.size; c.members.forEach(m => { if (m.voice.streaming) streaming++; if (m.voice.selfDeaf || m.voice.serverDeaf) deafened++; if (m.voice.selfMute || m.voice.serverMute) muted++; if (m.voice.selfVideo) camera++; }); });
    await reply(message, container(
      txt('## 🎤 Statistiques Vocales'),
      sep(),
      txt([`**En vocal :** ${total}`, `**Micro coupé :** ${muted}`, `**Sourd :** ${deafened}`, `**En stream :** ${streaming}`, `**Caméra :** ${camera}`].join('\n'))
    ));
  }
};
