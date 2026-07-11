const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const { v4: uuidv4 } = require('uuid');

const bets = {};

module.exports = {
  name: 'cbet',
  aliases: ['bet', 'pari'],
  description: 'Crée ou participe à un pari public entre joueurs',
  usage: '+cbet create <objectif> <mise> | join <betId> <pour/contre> <mise>',
  category: 'casino',
  run: async (client, message, args) => {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'create') {
      const objective = args[1];
      const betAmount = parseInt(args[2], 10);
      if (!objective || isNaN(betAmount) || betAmount <= 0) return reply(message, errorContainer('**Usage :** `+cbet create <objectif> <mise>`'));
      const userId = message.author.id;
      if (!Casino.hasEnoughCasino(userId, betAmount)) return reply(message, errorContainer(`Fonds insuffisants. Solde: ${Casino.getCasinoBalance(userId)} JTN`));
      Casino.deductCasinoCredits(userId, betAmount);
      const betId = uuidv4().slice(0, 6);
      bets[betId] = { id: betId, creator: userId, objective, amount: betAmount, for: [{ id: userId, amount: betAmount }], against: [], resolved: false };
      return reply(message, container(txt('## 📊 Pari Créé'), sep(), txt([`**ID :** \`${betId}\``, `**Objectif :** ${objective}`, `**Mise :** ${betAmount} JTN`, `Rejoindre: \`+cbet join ${betId} <pour/contre> <mise>\``].join('\n'))));
    }
    if (sub === 'join') {
      const betId = args[1], side = (args[2] || '').toLowerCase(), betAmount = parseInt(args[3], 10);
      if (!betId || !bets[betId]) return reply(message, errorContainer('Pari introuvable.'));
      if (!['pour', 'contre'].includes(side)) return reply(message, errorContainer('Choisis `pour` ou `contre`.'));
      if (isNaN(betAmount) || betAmount <= 0) return reply(message, errorContainer('Mise invalide.'));
      const userId = message.author.id;
      if (!Casino.hasEnoughCasino(userId, betAmount)) return reply(message, errorContainer(`Fonds insuffisants. Solde: ${Casino.getCasinoBalance(userId)} JTN`));
      Casino.deductCasinoCredits(userId, betAmount);
      bets[betId][side].push({ id: userId, amount: betAmount });
      return reply(message, container(txt('## 📊 Participation Enregistrée'), sep(), txt([`**${message.author.username}** mise ${betAmount} JTN **${side}** le pari \`${betId}\`.`].join('\n'))));
    }
    return reply(message, errorContainer('**Usage :** `+cbet create <objectif> <mise>` | `+cbet join <betId> <pour/contre> <mise>`'));
  }
};
