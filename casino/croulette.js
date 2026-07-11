const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const Casino = require('../../utils/casino');

const PAYOUTS = { rouge: 1, noir: 1, pair: 1, impair: 1, '1-12': 2, '13-24': 2, '25-36': 2, straight: 35 };
const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

module.exports = {
  name: 'croulette',
  aliases: ['roulette', 'crou'],
  description: 'Jouer à la roulette',
  usage: '+croulette <mise> <rouge|noir|pair|impair|1-12|13-24|25-36|0-36>',
  category: 'casino',
  run: async (client, message, args) => {
    const userId = message.author.id;
    const rem = Casino.getCooldownRemaining(userId, 'roulette');
    if (rem > 0) return reply(message, errorContainer(`Attends encore ${Casino.formatMs(rem)}.`));
    let bet = parseInt(args[0], 10);
    if (isNaN(bet) || bet < 10) bet = 10;
    bet = Math.min(bet, 1000);
    if (!Casino.hasEnoughCasino(userId, bet)) return reply(message, errorContainer(`Fonds insuffisants. Solde: ${Casino.getCasinoBalance(userId)} JTN`));
    const choice = args.slice(1).join(' ').toLowerCase();
    if (!choice) return reply(message, errorContainer('Options: `rouge, noir, pair, impair, 0-36, 1-12, 13-24, 25-36`'));
    Casino.deductCasinoCredits(userId, bet);
    const result = Math.floor(Math.random() * 37);
    const isRed = RED_NUMS.has(result);
    const isBlack = result !== 0 && !isRed;
    const isEven = result !== 0 && result % 2 === 0;
    const isOdd = result !== 0 && result % 2 === 1;
    const resultColor = result === 0 ? 'Vert 🟢' : isRed ? 'Rouge 🔴' : 'Noir ⚫';
    let win = false, multiplier = 0;
    if (choice === 'rouge' || choice === 'red') { win = isRed; multiplier = 1; }
    else if (choice === 'noir' || choice === 'black') { win = isBlack; multiplier = 1; }
    else if (choice === 'pair' || choice === 'even') { win = isEven; multiplier = 1; }
    else if (choice === 'impair' || choice === 'odd') { win = isOdd; multiplier = 1; }
    else if (choice === '1-12') { win = result >= 1 && result <= 12; multiplier = 2; }
    else if (choice === '13-24') { win = result >= 13 && result <= 24; multiplier = 2; }
    else if (choice === '25-36') { win = result >= 25 && result <= 36; multiplier = 2; }
    else { const num = parseInt(choice); if (!isNaN(num) && num >= 0 && num <= 36 && num === result) { win = true; multiplier = 35; } }
    const payout = win ? bet * (multiplier + 1) : 0;
    if (win) Casino.addCasinoCredits(userId, payout);
    Casino.setCooldown(userId, 'roulette', 8000);
    try { Casino.grantGameXp(userId, { game: 'roulette', bet, win, payout }); } catch {}
    try { Casino.addHistory(userId, 'roulette', { bet, payout, win }); } catch {}
    const finalBal = Casino.getCasinoBalance(userId);
    return reply(message, container(
      txt(`## 🎡 Roulette — ${win ? '✅ Victoire !' : '❌ Perdu'}`),
      sep(),
      txt([
        `**Résultat :** ${result} (${resultColor})`,
        `**Pari :** ${choice} | **Mise :** ${bet} JTN`,
        win ? `**Gain :** +${payout} JTN (×${multiplier + 1})` : `**Perdu :** ${bet} JTN`,
        `**Solde :** ${finalBal} JTN`
      ].join('\n'))
    ));
  }
};
