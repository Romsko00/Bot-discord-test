const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const Jobs = require('../../utils/jobs');
const Items = require('../../utils/items');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'cflip',
  aliases: ['coin', 'flip'],
  description: 'Pile ou face',
  usage: '+cflip <mise> <pile|face>',
  category: 'casino',
  run: async (client, message, args) => {
    const userId = message.author.id;
    const rem = Casino.getCooldownRemaining(userId, 'coinflip');
    if (rem > 0) return reply(message, errorContainer(`Patiente encore ${Casino.formatMs(rem)} avant de rejouer.`));
    if (args.length < 2) return reply(message, errorContainer('Usage: `+cflip <mise> <pile|face>`'));
    let bet = parseInt(args[0], 10);
    if (isNaN(bet) || bet <= 0) return reply(message, errorContainer('Mise invalide.'));
    const choiceRaw = (args[1] || '').toLowerCase();
    const choice = ['pile', 'p', 'head', 'heads'].includes(choiceRaw) ? 'pile' : ['face', 'f', 'tail', 'tails'].includes(choiceRaw) ? 'face' : null;
    if (!choice) return reply(message, errorContainer('Choisissez `pile` ou `face`.'));
    if (!Casino.hasEnoughCasino(userId, bet)) return reply(message, errorContainer(`Fonds insuffisants. Solde: ${Casino.getCasinoBalance(userId)} JTN`));
    Casino.deductCasinoCredits(userId, bet);
    try { Casino.incStat(userId, 'flip_wagered', bet); } catch {}
    let pWin = 0.5;
    const chanceLvl = Jobs.getSkillLevel(userId, 'chance');
    const uj = Jobs.getUserJob(userId);
    const boostChance = Items.effectActive(userId, 'boost_win_chance');
    if (chanceLvl >= 50) pWin += 0.03;
    if (uj && uj.name === 'croupier') pWin += 0.02;
    if (boostChance) pWin += 0.10;
    pWin = Math.min(0.8, pWin);
    const flip = Math.random() < 0.5 ? 'pile' : 'face';
    const winByProb = Math.random() < pWin;
    const outcome = winByProb ? choice : (flip === choice ? choice : choice === 'pile' ? 'face' : 'pile');
    const multiplier = 1.9;
    let payout = 0, info = '';
    if (outcome === choice) {
      payout = Math.floor(bet * multiplier);
      if (Items.effectActive(userId, 'hacker_crack')) { payout = Math.max(payout, Math.floor(bet * 1.5)); db.delete(`casino_effect_hacker_crack_${userId}`); }
      Casino.addCasinoCredits(userId, payout);
      try { Casino.incStat(userId, 'flip_wins', 1); } catch {}
      info = `Gagné ! x${multiplier.toFixed(2)}`;
    } else {
      if (Items.effectActive(userId, 'cancel_next_loss')) { payout = bet; db.delete(`casino_effect_cancel_next_loss_${userId}`); Casino.addCasinoCredits(userId, payout); info = 'Perdu, mais Anti-tilt actif: remboursé'; }
      else { try { Casino.incStat(userId, 'flip_losses', 1); } catch {} info = 'Perdu.'; }
    }
    try { Casino.incStat(userId, 'flip_games', 1); } catch {}
    Casino.setCooldown(userId, 'coinflip', 8000);
    const win = outcome === choice;
    try { Casino.grantGameXp(userId, { game: 'coinflip', bet, win, payout }); } catch {}
    try { Casino.checkAndGrantAchievements(userId, { game: 'coinflip', bet, win, payout }); } catch {}
    try { Casino.addHistory(userId, 'coinflip', { bet, payout, win }); } catch {}
    if (boostChance) db.delete(`casino_effect_boost_win_chance_${userId}`);
    const emoji = outcome === 'pile' ? '🔵' : '🟡';
    return reply(message, container(
      txt(`## 🪙 Coin Flip — ${win ? '✅ Victoire !' : '❌ Perdu'}`),
      sep(),
      txt([
        `**Résultat :** ${emoji} ${outcome.toUpperCase()} | **Votre choix :** ${choice.toUpperCase()}`,
        `**Mise :** ${bet} JTN | **Gain :** ${payout} JTN | **Solde :** ${Casino.getCasinoBalance(userId)} JTN`,
        `*${info}*`
      ].join('\n'))
    ));
  }
};
