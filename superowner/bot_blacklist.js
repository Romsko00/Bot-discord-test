const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'bot_blacklist',
  aliases: ['blbot', 'unblbot', 'clearblbots'],
  category: 'superowner',
  level: 9,
  run: async (client, message, args) => {
    const isSuper = client.config.superadmin?.includes(message.author.id);
    if (!isSuper) return reply(message, errorContainer('**Permission insuffisante** — Superadmin requis.'));
    const commandName = message.content.split(' ')[0].slice((client.config.prefix?.length) || 1).toLowerCase();

    if (commandName === 'clearblbots') {
      const type = args[0];
      if (!['here', 'all'].includes(type)) return reply(message, errorContainer('**Usage :** `!clearblbots <here|all>`'));
      const prefix = type === 'all' ? 'blbot_global_' : `blbot_${message.guild.id}_`;
      const keys = db.all().filter(d => d.ID.startsWith(prefix));
      keys.forEach(k => db.delete(k.ID));
      return reply(message, container(txt('## ✅ Blacklist Vidée'), sep(), txt(`**${keys.length}** entrées supprimées (${type === 'all' ? 'Globale' : 'Locale'}).`)));
    }

    const type = args[0], target = message.mentions.users.first() || client.users.cache.get(args[1]);
    if (!target || !['here', 'all'].includes(type)) return reply(message, errorContainer(`**Usage :** \`!${commandName} <here|all> <@user>\``));
    const key = type === 'all' ? `blbot_global_${target.id}` : `blbot_${message.guild.id}_${target.id}`;

    if (commandName === 'blbot') {
      db.set(key, true);
      return reply(message, container(txt('## 🚫 Bot Blacklisté'), sep(), txt([`**Utilisateur :** ${target.tag}`, `**Portée :** ${type === 'all' ? 'Globale' : 'Locale'}`].join('\n'))));
    } else if (commandName === 'unblbot') {
      db.delete(key);
      return reply(message, container(txt('## ✅ Blacklist Retirée'), sep(), txt([`**Utilisateur :** ${target.tag}`, `**Portée :** ${type === 'all' ? 'Globale' : 'Locale'}`].join('\n'))));
    }
  }
};
