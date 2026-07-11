const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const admin = require('../../utils/casinoAdmin');
const notify = require('../../utils/casinoNotify');
const Risk = require('../../utils/casinoRisk');
const Jobs = require('../../utils/jobs');
const Items = require('../../utils/items');
const db = require('../../utils/simpledb');
const config = require('../../config.json');

module.exports = {
  name: 'cwheel',
  aliases: ['wheel', 'cfortune'],
  description: 'Roue de la fortune — faites tourner et tentez votre chance',
  usage: '+cwheel <mise>',
  category: 'casino',
  run: async (client, message, args) => {
    if (!message.guild) return;
    const userId = message.author.id, guildId = message.guild.id;
    if (admin.isSuspended(guildId, userId)) return reply(message, errorContainer('Accès casino suspendu.'));
    const allowedCatId = db.get(`casino_category_${guildId}`);
    if (allowedCatId && (!message.channel.parentId || message.channel.parentId !== allowedCatId)) return reply(message, errorContainer('Jeux limités à la catégorie configurée.'));
    const settings = config.CASINO?.WHEEL || { MIN_BET: 10, MAX_BET: 2000, COOLDOWN_MS: 4000, JACKPOT_CUT: 0.03 };
    const rem = Casino.getCooldownRemaining(userId, 'wheel');
    if (rem > 0) return reply(message, errorContainer(`Attends encore ${Casino.formatMs(rem)}.`));
    let bet = parseInt(args[0], 10);
    if (isNaN(bet)) bet = settings.MIN_BET;
    const vip = Casino.getVipActive(userId);
    const maxBet = Risk.getMaxBetWithRisk(userId, Math.floor((settings.MAX_BET || 2000) * (vip ? 1.1 : 1.0)));
    bet = Math.max(settings.MIN_BET, Math.min(maxBet, bet));
    if (!Casino.hasEnoughCasino(userId, bet)) return reply(message, errorContainer(`Fonds insuffisants. Solde: ${Casino.getCasinoBalance(userId)} JTN`));
    Casino.deductCasinoCredits(userId, bet);
    const jpCut = Math.floor(bet * (settings.JACKPOT_CUT || 0.03));
    if (jpCut > 0) try { Casino.addToJackpot(jpCut); } catch {}
    const segments = [
      { label: 'x0', mult: 0, weight: 5 }, { label: 'x0.5', mult: 0.5, weight: 10 }, { label: 'x1', mult: 1, weight: 22 },
      { label: 'x1.5', mult: 1.5, weight: 18 }, { label: 'x2', mult: 2, weight: 14 }, { label: 'x3', mult: 3, weight: 10 },
      { label: 'x5', mult: 5, weight: 6 }, { label: 'x10', mult: 10, weight: 3 }, { label: 'BONUS', mult: 'super', weight: 2 }
    ];
    const uj = Jobs.getUserJob(userId);
    const chanceLvl = Jobs.getSkillLevel(userId, 'chance');
    const boostChance = Items.effectActive(userId, 'boost_win_chance');
    const isCroupier = uj && uj.name === 'croupier';
    const segs = segments.map(s => ({ ...s, weight: (() => { let w = s.weight; if (s.mult !== 0 && chanceLvl >= 50) w = Math.ceil(w * 1.05); if (s.mult !== 0 && isCroupier) w = Math.ceil(w * 1.05); if (s.mult !== 0 && boostChance) w = Math.ceil(w * 1.15); return w; })() }));
    const spread = [];
    segs.forEach(s => { for (let i = 0; i < s.weight; i++) spread.push(s); });
    const picked = spread[Math.floor(Math.random() * spread.length)];
    let totalWin = 0;
    if (picked.mult === 'super') {
      const sup = [{ label: 'x3', mult: 3, weight: 15 }, { label: 'x5', mult: 5, weight: 15 }, { label: 'x10', mult: 10, weight: 10 }, { label: 'x15', mult: 15, weight: 8 }, { label: 'x25', mult: 25, weight: 5 }, { label: 'x50', mult: 50, weight: 2 }];
      const sp2 = [];
      sup.forEach(s => { for (let i = 0; i < s.weight; i++) sp2.push(s); });
      totalWin = Math.floor(bet * sp2[Math.floor(Math.random() * sp2.length)].mult);
    } else {
      totalWin = Math.floor(bet * picked.mult);
    }
    if (Items.effectActive(userId, 'hacker_crack')) { if (Math.random() < 0.10) totalWin = Math.max(totalWin, Math.floor(bet * 1.5)); db.delete(`casino_effect_hacker_crack_${userId}`); }
    const jackpotWon = Casino.tryWinJackpot ? Casino.tryWinJackpot() : 0;
    if (jackpotWon > 0) totalWin += jackpotWon;
    const { penalty } = Risk.getEdgePenalty ? Risk.getEdgePenalty(userId) : { penalty: 0 };
    if (penalty > 0 && totalWin > 0) totalWin = Math.floor(totalWin * (1 - penalty));
    try { Risk.recordPlay && Risk.recordPlay(userId, { bet, payout: totalWin }); } catch {}
    if (totalWin <= 0 && Items.effectActive(userId, 'cancel_next_loss')) { totalWin = bet; db.delete(`casino_effect_cancel_next_loss_${userId}`); }
    if (totalWin > 0) Casino.addCasinoCredits(userId, totalWin);
    Casino.setCooldown(userId, 'wheel', settings.COOLDOWN_MS || 4000);
    const finalBal = Casino.getCasinoBalance(userId);
    try { Casino.grantGameXpWithBonuses && Casino.grantGameXpWithBonuses(userId, { game: 'wheel', bet, win: totalWin > 0, payout: totalWin }); } catch {}
    try { Casino.addHistory(userId, 'wheel', { bet, payout: totalWin, win: totalWin > 0 }); } catch {}
    if (boostChance) db.delete(`casino_effect_boost_win_chance_${userId}`);
    try { if (jackpotWon > 0 || totalWin >= bet * 10) { const emb = notify.buildEmbed('🎡 Cwheel', `${message.author} gros gain! +${totalWin} JTN`); await notify.notify(client, guildId, emb); } } catch {}
    const lines = [
      `**Segment :** ${picked.mult === 'super' ? 'BONUS → Super-Roue' : picked.label}`,
      jackpotWon > 0 ? `💎 **JACKPOT ! +${jackpotWon} JTN**` : '',
      `**Mise :** ${bet} JTN | **Gain :** ${totalWin} JTN | **Solde :** ${finalBal} JTN`
    ].filter(Boolean);
    return reply(message, container(txt(`## 🎡 Roue de la Fortune — ${totalWin > bet ? '🎉 Victoire !' : totalWin === 0 ? '❌ Perdu' : '🎰 Gain'}`), sep(), txt(lines.join('\n'))));
  }
};
