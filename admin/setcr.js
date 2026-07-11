const { container, txt, sep, reply, errorContainer, formatNumber } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'setcr',
  aliases: ['setcredits'],
  description: 'Définir les crédits d\'un utilisateur',
  usage: '<@user> <montant>',
  category: 'admin',
  level: 5,
  run: async (client, message, args) => {
    if (!hasPermissionLevel(client, message, 4)) {
      return reply(message, errorContainer('**Permission insuffisante** — Niveau 4 (Admin) requis.'));
    }
    if (!args[0] || !args[1]) {
      return reply(message, errorContainer('**Usage :** `!setcr <@user> <montant>`'));
    }

    const targetUser = message.mentions.users.first() || await client.users.fetch(args[0].replace(/[<@!>]/g, '')).catch(() => null);
    if (!targetUser) return reply(message, errorContainer('**Utilisateur introuvable.**'));

    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 0) return reply(message, errorContainer('**Montant invalide** — Doit être un nombre positif.'));

    const guildId = message.guild.id;
    const oldBal = db.get(`credits_${guildId}_${targetUser.id}`) || 0;
    db.set(`credits_${guildId}_${targetUser.id}`, amount);

    return reply(message, container(
      txt('## ✅ Crédits définis'),
      sep(),
      txt([
        `**Utilisateur :** ${targetUser} (${targetUser.id})`,
        `**Ancien solde :** ${formatNumber(oldBal)} crédits`,
        `**Nouveau solde :** ${formatNumber(amount)} crédits`,
        `**Effectué par :** ${message.author}`
      ].join('\n'))
    ));
  }
};
