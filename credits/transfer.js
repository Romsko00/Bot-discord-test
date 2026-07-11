const { container, txt, sep, reply, errorContainer, formatNumber } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'transfer',
  aliases: ['pay', 'give'],
  description: 'Transfère des crédits à un autre utilisateur',
  usage: '<@user> <montant>',
  level: 1,
  run: async (client, message, args) => {
    const target = message.mentions.users.first();
    const amount = parseInt(args[1], 10);
    if (!target) return reply(message, errorContainer('**Usage :** `!transfer <@user> <montant>`'));
    if (!amount || amount <= 0) return reply(message, errorContainer('**Montant invalide** — doit être positif.'));
    if (target.id === message.author.id) return reply(message, errorContainer('Vous ne pouvez pas vous transférer des crédits à vous-même.'));

    const guildId = message.guild.id;
    const fromKey = `credits_${guildId}_${message.author.id}`;
    const toKey = `credits_${guildId}_${target.id}`;
    const fromBal = db.get(fromKey) || 0;
    if (fromBal < amount) return reply(message, errorContainer(`**Solde insuffisant** — vous avez ${formatNumber(fromBal)} crédits.`));

    db.subtract(fromKey, amount);
    db.add(toKey, amount);

    return reply(message, container(
      txt('## ✅ Transfert Effectué'),
      sep(),
      txt([
        `**Expéditeur :** ${message.author} (${formatNumber(fromBal - amount)} crédits restants)`,
        `**Destinataire :** ${target}`,
        `**Montant transféré :** ${formatNumber(amount)} crédits`
      ].join('\n'))
    ));
  }
};
