const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');
const Casino = require('../../utils/casino');
const admin = require('../../utils/casinoAdmin');
const { hasPermissionLevel } = require('../../utils/permissionUtils');

function GB_KEY(guildId) { return `casino_gbank_balance_${guildId}`; }

module.exports = {
  name: 'guildbank',
  aliases: ['gbank', 'cgb'],
  description: 'Banque de guilde — dépôt/retrait et état',
  usage: '+guildbank status | +guildbank deposit <montant> | +guildbank withdraw <montant>',
  category: 'casino',
  run: async (client, message, args) => {
    if (!message.guild) return;
    const guildId = message.guild.id, userId = message.author.id;
    if (admin.isSuspended(guildId, userId)) return reply(message, errorContainer('Accès casino suspendu.'));
    const sub = (args[0] || '').toLowerCase();
    if (!['status', 'deposit', 'withdraw'].includes(sub)) return reply(message, errorContainer('Usage: `+guildbank status` | `+guildbank deposit <montant>` | `+guildbank withdraw <montant>`'));
    const bal = db.get(GB_KEY(guildId)) || 0;
    if (sub === 'status') {
      return reply(message, container(txt('## 🏦 Banque de Guilde'), sep(), txt(`**Solde :** ${bal} JTN`)));
    }
    let amount = parseInt(args[1], 10);
    if (isNaN(amount) || amount <= 0) return reply(message, errorContainer('Montant invalide.'));
    if (sub === 'deposit') {
      if (!Casino.hasEnoughCasino(userId, amount)) return reply(message, errorContainer(`Fonds insuffisants. Solde: ${Casino.getCasinoBalance(userId)} JTN`));
      Casino.deductCasinoCredits(userId, amount);
      db.add(GB_KEY(guildId), amount);
      return reply(message, container(txt('## ✅ Dépôt Effectué'), sep(), txt([`Déposé **${amount} JTN** à la banque de guilde.`, `**Solde banque :** ${db.get(GB_KEY(guildId))} JTN`].join('\n'))));
    }
    if (sub === 'withdraw') {
      const isManager = hasPermissionLevel(client, message, 6);
      const isOwner = client.config?.owners && client.config.owners.includes(userId);
      if (!isManager && !isOwner) return reply(message, errorContainer('Permission requise: Gérer le serveur.'));
      if (bal < amount) return reply(message, errorContainer('Solde insuffisant dans la banque.'));
      db.subtract(GB_KEY(guildId), amount);
      Casino.addCasinoCredits(userId, amount);
      return reply(message, container(txt('## ✅ Retrait Effectué'), sep(), txt([`Retiré **${amount} JTN** de la banque.`, `**Solde banque :** ${db.get(GB_KEY(guildId))} JTN`].join('\n'))));
    }
  }
};
