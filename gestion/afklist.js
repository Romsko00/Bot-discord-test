const db = require('../../utils/simpledb');
const { container, txt, sep, reply } = require('../../utils/v2');

module.exports = {
  name: 'afklist',
  aliases: ['listafk', 'afks'],
  category: 'gestion',
  description: 'Affiche la liste des membres actuellement AFK sur le serveur',
  usage: '+afklist',
  run: async (client, message) => {
    if (!message.guild) return;
    const allAfk = db.all() || [];
    const prefix = `afk_${message.guild.id}_`;
    const guildAfk = allAfk.filter(item => (item.ID || item.key || '').startsWith(prefix));
    if (!guildAfk.length) return reply(message, container(txt('## 💤 Liste AFK'), sep(), txt('Aucun membre n\'est actuellement AFK.')));
    const now = Date.now();
    const lines = [];
    for (const item of guildAfk) {
      const key = item.ID || item.key;
      const data = item.data || item.value || {};
      const userId = key.slice(prefix.length);
      const member = await message.guild.members.fetch(userId).catch(() => null);
      if (!member) { db.delete(key); continue; }
      const ms = now - (data.since || now);
      const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000);
      const dur = h > 0 ? `${h}h ${m}m` : `${m}m`;
      lines.push(`• **${member.user.username}** — ${data.reason || 'AFK'} — depuis ${dur}`);
    }
    return reply(message, container(
      txt(`## 💤 Membres AFK (${lines.length})`),
      sep(),
      txt(lines.join('\n') || 'Aucun membre AFK.')
    ));
  }
};
