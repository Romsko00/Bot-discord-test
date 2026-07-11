const { container, txt, sep, reply, errorContainer, formatDate } = require('../../utils/v2');
const { isBotOwner } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'blacklistinfo',
  description: 'Affiche des infos sur un utilisateur blacklisté',
  category: 'owner',
  usage: '<@user|id>',
  level: 7,
  run: async (client, message, args) => {
    if (!isBotOwner(client, message)) return reply(message, errorContainer('**Permission insuffisante** — Bot Owner requis.'));
    const user = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
    if (!user) return reply(message, errorContainer('**Utilisateur introuvable.**'));
    const blData = db.get(`blmd_${client.user.id}_${user.id}`);
    if (!blData) return reply(message, errorContainer(`**${user.tag}** n'est pas dans la blacklist.`));
    return reply(message, container(
      txt('## 🚫 Dossier Blacklist'),
      sep(),
      txt([
        `**Utilisateur :** ${user.tag} (${user.id})`,
        `**Date d'ajout :** ${blData.date ? formatDate(blData.date) : 'Inconnue'}`,
        `**Raison :** ${blData.reason || 'Aucune raison spécifiée'}`,
        `**Auteur :** ${blData.author ? `<@${blData.author}>` : 'Inconnu'}`
      ].join('\n'))
    ));
  }
};
