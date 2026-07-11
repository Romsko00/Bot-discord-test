const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const admin = require('../../utils/casinoAdmin');
const Risk = require('../../utils/casinoRisk');
const notify = require('../../utils/casinoNotify');
const db = require('../../utils/simpledb');
const config = require('../../config.json');

module.exports = {
  name: 'cplinko',
  aliases: ['plinko'],
  description: 'Plinko — choisis une colonne et regarde la bille tomber',
  usage: '+cplinko <mise> <colonne 1-8>',
  category: 'casino',
  run: async (client, message, args) => {
    if (!message.guild) return;
    const userId = message.author.id, guildId = message.guild.id;
    if (admin.isSuspended(guildId, userId)) return reply(message, errorContainer('Accès casino suspendu.'));
    const allowedCatId = db.get(`casino_category_${guildId}`);
    if (allowedCatId && (!message.channel.parentId || message.channel.parentId !== allowedCatId)) return reply(message, errorContainer('Jeux limités à la catégorie configurée.'));
    const settings = config.CASINO?.PLINKO || { MIN_BET: 10, MAX_BET: 1500, COOLDOWN_MS: 3500, JACKPOT_CUT: 0.02 };
    const rem = Casino.getCooldownRemaining(userId, 'plinko');
    if (rem > 0) return reply(message, errorContainer(`Attends encore ${Casino.formatMs(rem)}.`));
    let bet = parseInt(args[0], 10);
    if (isNaN(bet)) bet = settings.MIN_BET;
    const vip = Casino.getVipActive(userId);
    const maxBet = Risk.getMaxBetWithRisk(userId, Math.floor((settings.MAX_BET || 1500) * (vip ? 1.1 : 1.0)));
    bet = Math.max(settings.MIN_BET, Math.min(maxBet, bet));
    let col = parseInt(args[1], 10);
    if (isNaN(col) || col < 1 || col > 8) return reply(message, errorContainer('Spécifiez une colonne entre 1 et 8. Ex: `+cplinko 200 5`'));
    if (!Casino.hasEnoughCasino(userId, bet)) return reply(message, errorContainer(`Fonds insuffisants. Solde: ${Casino.getCasinoBalance(userId)} JTN`));
    Casino.deductCasinoCredits(userId, bet);
    const jpCut = Math.floor(bet * (settings.JACKPOT_CUT || 0.02));
    if (jpCut > 0) try { Casino.addToJackpot(jpCut); } catch {}

    const models = {
      1:[{m:0,w:20},{m:0.5,w:25},{m:1,w:25},{m:2,w:18},{m:5,w:8},{m:10,w:4}],
      2:[{m:0,w:18},{m:0.5,w:25},{m:1,w:26},{m:2,w:18},{m:5,w:9},{m:10,w:4}],
      3:[{m:0,w:16},{m:0.5,w:24},{m:1,w:28},{m:2,w:18},{m:5,w:10},{m:10,w:4}],
      4:[{m:0,w:15},{m:0.5,w:22},{m:1,w:30},{m:2,w:20},{m:5,w:9},{m:10,w:4}],
      5:[{m:0,w:15},{m:0.5,w:22},{m:1,w:30},{m:2,w:20},{m:5,w:9},{m:10,w:4}],
      6:[{m:0,w:16},{m:0.5,w:24},{m:1,w:28},{m:2,w:18},{m:5,w:10},{m:10,w:4}],
      7:[{m:0,w:18},{m:0.5,w:25},{m:1,w:26},{m:2,w:18},{m:5,w:9},{m:10,w:4}],
      8:[{m:0,w:20},{m:0.5,w:25},{m:1,w:25},{m:2,w:18},{m:5,w:8},{m:10,w:4}]
    };
    const spread = []; for (const s of models[col]) for (let i = 0; i < s.w; i++) spread.push(s);
    const picked = spread[Math.floor(Math.random() * spread.length)];
    let totalWin = Math.floor(bet * picked.m);
    const jackpotWon = Casino.tryWinJackpot ? Casino.tryWinJackpot() : 0;
    if (jackpotWon > 0) totalWin += jackpotWon;
    const { penalty } = Risk.getEdgePenalty ? Risk.getEdgePenalty(userId) : { penalty: 0 };
    if (penalty > 0 && totalWin > 0) totalWin = Math.floor(totalWin * (1 - penalty));
    try { Risk.recordPlay && Risk.recordPlay(userId, { bet, payout: totalWin }); } catch {}
    if (totalWin > 0) Casino.addCasinoCredits(userId, totalWin);
    Casino.setCooldown(userId, 'plinko', settings.COOLDOWN_MS || 3500);
    try { Casino.grantGameXpWithBonuses && Casino.grantGameXpWithBonuses(userId, { game: 'plinko', bet, win: totalWin > 0, payout: totalWin }); } catch {}
    try { Casino.addHistory(userId, 'plinko', { bet, payout: totalWin, win: totalWin > 0, col }); } catch {}
    const finalBal = Casino.getCasinoBalance(userId);
    try { if (jackpotWon > 0 || totalWin >= bet * 10) { const emb = notify.buildEmbed('🎉 Plinko', `${message.author} a fait un gros gain! +${totalWin} JTN`); await notify.notify(client, guildId, emb); } } catch {}
    return reply(message, container(
      txt(`## 🎯 Plinko — ${totalWin > 0 ? '✅ Gain !' : '❌ Perdu'}`),
      sep(),
      txt([
        `**Colonne :** ${col} | **Multiplicateur :** x${picked.m}`,
        jackpotWon > 0 ? `💎 **JACKPOT ! +${jackpotWon} JTN**` : '',
        `**Mise :** ${bet} JTN | **Gain :** ${totalWin} JTN | **Solde :** ${finalBal} JTN`
      ].filter(Boolean).join('\n'))
    ));
  }
};
