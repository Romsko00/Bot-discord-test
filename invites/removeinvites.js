const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'removeinvites',
  description: 'Retire des invitations à un utilisateur',
  category: 'invites',
  usage: '<@user> <nombre>',
  level: 5,
  run: async (client, message, args) => {
    if (!hasPermissionLevel(client, message, 5)) {
      return reply(message, errorContainer('**Permission insuffisante** — Niveau 5 requis.'));
    }
    const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    if (!member) return reply(message, errorContainer('**Utilisateur introuvable.**'));
    const amount = parseInt(args[1]);
    if (isNaN(amount)) return reply(message, errorContainer('**Nombre invalide.**'));
    const key = `invites_${message.guild.id}_${member.id}`;
    const bonusKey = `bonus_${message.guild.id}_${member.id}`;
    db.set(key, Math.max(0, (db.get(key) || 0) - amount));
    db.set(bonusKey, Math.max(0, (db.get(bonusKey) || 0) - amount));
    return reply(message, container(
      txt('## ✅ Invitations Retirées'),
      sep(),
      txt([`**Membre :** ${member}`, `**Retirées :** -${amount}`, `**Total :** ${db.get(key)}`].join('\n'))
    ));
  }
};
