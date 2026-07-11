const Casino = require('../../utils/casino');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'cdice',
  aliases: ['dice'],
  description: 'Joue aux dés (Hi-Lo) — parie si le résultat sera plus haut ou plus bas',
  usage: '<mise> <plus|moins> <seuil 1-99>',
  category: 'casino',
  run: async (client, message, args) => {
    const userId = message.author.id;

    const rem = Casino.getCooldownRemaining(userId, 'dice');
    if (rem > 0) return reply(message, errorContainer(`⏱️ Attends encore **${Casino.formatMs(rem)}**.`));

    if (args.length < 3) return reply(message, errorContainer(
      '**Usage :** `!cdice <mise> <plus|moins> <seuil 1-99>`\n**Exemple :** `!cdice 200 plus 60` → vous pariez que le dé > 60'
    ));

    let bet = parseInt(args[0], 10);
    if (isNaN(bet) || bet <= 0) return reply(message, errorContainer('**Mise invalide.** Entrez un nombre positif.'));

    const direction = (args[1] || '').toLowerCase();
    if (!['plus', 'moins', 'more', 'less', '>', '<'].includes(direction))
      return reply(message, errorContainer('**Direction invalide.** Choisissez `plus` ou `moins`.'));

    let threshold = parseInt(args[2], 10);
    if (isNaN(threshold) || threshold < 1 || threshold > 99)
      return reply(message, errorContainer('**Seuil invalide.** La valeur doit être entre 1 et 99.'));

    if (!Casino.hasEnoughCasino(userId, bet)) {
      const bal = Casino.getCasinoBalance(userId);
      return reply(message, errorContainer(`**Fonds insuffisants.** Solde actuel : **${bal} JTN**\nUtilisez \`!cclaim\` pour récupérer des jetons.`));
    }

    Casino.deductCasinoCredits(userId, bet);

    const roll = Math.floor(Math.random() * 100) + 1;

    const isPlus = ['plus', 'more', '>'].includes(direction);
    const chance = isPlus ? (100 - threshold) / 100 : (threshold - 1) / 100;
    const safeChance = Math.max(0.01, Math.min(0.99, chance));
    const multiplier = Math.max(1.01, (1 / safeChance) * 0.95);
    const win = isPlus ? roll > threshold : roll < threshold;

    let payout = 0;
    if (win) {
      payout = Math.floor(bet * multiplier);
      Casino.addCasinoCredits(userId, payout);
      Casino.incStat?.(userId, 'dice_wins', 1);
    } else {
      Casino.incStat?.(userId, 'dice_losses', 1);
    }

    Casino.incStat?.(userId, 'dice_games', 1);
    Casino.setCooldown(userId, 'dice', 10000);

    const xpRes = Casino.grantGameXp(userId, { game: 'dice', bet, win, payout });
    Casino.checkAndGrantAchievements?.(userId, { game: 'dice', bet, win, payout });
    Casino.addHistory(userId, 'dice', { bet, payout, win });

    const finalBal = Casino.getCasinoBalance(userId);
    const netGain = win ? payout - bet : -bet;
    const levelUpNote = xpRes?.levelUp ? ` • 🆙 Niveau ${xpRes.level} atteint !` : '';

    const dirLabel = isPlus ? `> ${threshold}` : `< ${threshold}`;
    const resultEmoji = win ? '✅' : '❌';
    const resultLabel = win ? `Gagné ! (×${multiplier.toFixed(2)})` : 'Perdu';
    const gainLabel = win ? `+${payout} JTN` : `-${bet} JTN`;

    return reply(message, container(
      txt(`## 🎲 Dés — Mise : ${bet} JTN sur ${dirLabel}`),
      sep(),
      txt(`🎲 **Résultat du dé : ${roll}**`),
      sep(),
      txt([
        `**Résultat :** ${resultEmoji} ${resultLabel}`,
        `**Gain :** ${gainLabel}`,
        `**Solde :** ${finalBal} JTN${levelUpNote}`
      ].join('\n'))
    ));
  }
};
