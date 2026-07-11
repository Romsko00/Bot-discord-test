const { container, txt, sep, row, btn, reply, errorContainer, noPermContainer, formatNumber, ButtonStyle } = require('../../utils/v2');
const { hasPermissionLevel, AccessLevels } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'addcr',
  aliases: ['addcredits'],
  description: 'Ajouter des crédits à un utilisateur',
  usage: '<@user> <montant>',
  category: 'admin',
  level: 5,
  run: async (client, message, args) => {
    if (!hasPermissionLevel(client, message, 4)) {
      return reply(message, errorContainer('**Permission insuffisante** — Niveau 4 (Admin) requis.'));
    }

    if (!args[0] || !args[1]) {
      return reply(message, errorContainer(`**Usage :** \`${message.prefix || '!'}addcr <@user> <montant>\``));
    }

    const targetId = args[0].replace(/[<@!>]/g, '');
    const amount = parseInt(args[1]);

    if (isNaN(amount) || amount <= 0) {
      return reply(message, errorContainer('**Montant invalide** — Le montant doit être un nombre positif.'));
    }

    let targetUser;
    try {
      targetUser = await client.users.fetch(targetId);
    } catch {
      return reply(message, errorContainer('**Utilisateur introuvable.**'));
    }

    const guildId = message.guild.id;
    const oldBal = db.get(`credits_${guildId}_${targetId}`) || 0;
    const newBal = oldBal + amount;
    db.set(`credits_${guildId}_${targetId}`, newBal);

    const c = container(
      txt('## ✅ Crédits ajoutés'),
      sep(),
      txt([
        `**Destinataire :** ${targetUser} (ID: ${targetId})`,
        `**Montant ajouté :** +${formatNumber(amount)} crédits`,
        `**Nouveau solde :** ${formatNumber(newBal)} crédits`,
        `**Effectué par :** ${message.author}`
      ].join('\n'))
    );
    return reply(message, c);
  }
};
