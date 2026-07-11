const db = require('../../utils/simpledb');
const { container, txt, sep, reply } = require('../../utils/v2');

module.exports = {
  name: 'afk',
  aliases: [],
  category: 'gestion',
  description: 'Définit votre statut AFK avec une raison optionnelle',
  usage: '+afk [raison]',
  run: async (client, message, args) => {
    if (!message.guild) return;
    const reason = args.length > 0 ? args.join(' ').slice(0, 200) : 'AFK';
    const key = `afk_${message.guild.id}_${message.author.id}`;
    const now = Date.now();
    db.set(key, { reason, since: now, username: message.author.username, guildId: message.guild.id });
    if (message.member.voice.channel) {
      try { await message.member.voice.disconnect('AFK activé'); } catch {}
    }
    if (message.deletable && message.channel.permissionsFor(message.guild.members.me)?.has('ManageMessages')) {
      message.delete().catch(() => {});
    }
    return reply(message, container(
      txt('## 💤 AFK Activé'),
      sep(),
      txt([`**${message.author}** est maintenant AFK.`, `**Raison :** ${reason}`, `**Depuis :** <t:${Math.floor(now/1000)}:R>`].join('\n'))
    ));
  }
};
