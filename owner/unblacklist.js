const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { isBotOwner } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'unblacklist',
  description: 'Retire un utilisateur de la blacklist',
  category: 'owner',
  usage: '<@user|id>',
  level: 7,
  run: async (client, message, args) => {
    if (!isBotOwner(client, message)) return reply(message, errorContainer('**Permission insuffisante** — Bot Owner requis.'));
    const user = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
    if (!user) return reply(message, errorContainer('**Utilisateur introuvable.**'));
    if (!db.get(`blmd_${client.user.id}_${user.id}`)) return reply(message, errorContainer(`**${user.tag}** n'est pas blacklisté.`));
    db.delete(`blmd_${client.user.id}_${user.id}`);
    let unbannedCount = 0;
    client.guilds.cache.forEach(g => { try { g.bans.remove(user.id).then(() => unbannedCount++).catch(() => {}); } catch {} });
    return reply(message, container(
      txt('## ✅ Blacklist Retirée'),
      sep(),
      txt([`**Utilisateur :** ${user.tag} (${user.id})`, `**Serveurs déban :** ${unbannedCount}`].join('\n'))
    ));
  }
};
