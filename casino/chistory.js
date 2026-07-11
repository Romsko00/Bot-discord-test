const { container, txt, sep, reply } = require('../../utils/v2');
const Casino = require('../../utils/casino');

const GAME_ALIASES = {
  slots: ['slots', 'cslots', 'slot'],
  blackjack: ['blackjack', 'cblackjack', 'bj', 'c21', 'cbj'],
  roulette: ['roulette', 'croulette'],
  dice: ['dice', 'cdice', 'hilo'],
  coinflip: ['coinflip', 'cflip', 'flip', 'coin']
};

function resolveGame(input) {
  if (!input) return null;
  const q = input.toLowerCase();
  for (const [game, aliases] of Object.entries(GAME_ALIASES)) { if (aliases.includes(q)) return game; }
  return null;
}

module.exports = {
  name: 'chistory',
  aliases: ['casino-history', 'casinolog'],
  description: 'Historique des parties de casino',
  usage: '+chistory [jeu] [@user]',
  category: 'casino',
  run: async (client, message, args) => {
    const target = message.mentions.users.first() || message.author;
    const userId = target.id;
    const game = resolveGame(args[0]);
    const games = game ? [game] : ['slots', 'blackjack', 'roulette', 'dice', 'coinflip'];
    const sections = [];
    for (const g of games) {
      const hist = Casino.getHistory(userId, g, 10);
      if (!hist.length) continue;
      sections.push(`**${g.toUpperCase()} :**`);
      hist.forEach((e, i) => {
        const when = new Date(e.ts).toLocaleString('fr-FR');
        sections.push(`${i+1}) ${when} — Mise ${e.bet} → Gain ${e.payout} ${e.win ? '✅' : '❌'}`);
      });
    }
    return reply(message, container(
      txt(`## 🧾 Historique Casino — ${target.username}`),
      sep(),
      txt(sections.length > 0 ? sections.join('\n') : 'Aucune partie récente.')
    ));
  }
};
