const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const admin = require('../../utils/casinoAdmin');
const notify = require('../../utils/casinoNotify');
const Risk = require('../../utils/casinoRisk');
const db = require('../../utils/simpledb');
const config = require('../../config.json');

module.exports = {
  name: 'cslotsplus',
  aliases: ['slotsplus', 'csp'],
  description: 'Slots avancés 5x3/5x4 avec lignes, wilds, scatters et free spins',
  usage: '+cslotsplus <mise> [lignes]',
  category: 'casino',
  run: async (client, message, args) => {
    if (!message.guild) return;
    const userId = message.author.id, guildId = message.guild.id;
    if (admin.isSuspended(guildId, userId)) return reply(message, errorContainer('Accès casino suspendu.'));
    const allowedCatId = db.get(`casino_category_${guildId}`);
    if (allowedCatId && (!message.channel.parentId || message.channel.parentId !== allowedCatId)) return reply(message, errorContainer('Jeux limités à la catégorie configurée.'));
    const settings = config.CASINO?.SLOTSPLUS || { MIN_BET: 20, MAX_BET: 5000, COOLDOWN_MS: 5000, JACKPOT_CUT: 0.04, BONUS_CHANCE: 0.05 };
    const cd = Casino.getCooldownRemaining(userId, 'slotsplus');
    if (cd > 0) return reply(message, errorContainer(`Attends encore ${Casino.formatMs(cd)}.`));
    let bet = parseInt(args[0], 10);
    if (isNaN(bet)) bet = settings.MIN_BET;
    const vip = Casino.getVipActive(userId);
    const maxBet = Risk.getMaxBetWithRisk(userId, Math.floor((settings.MAX_BET || 5000) * (vip ? 1.1 : 1.0)));
    bet = Math.max(settings.MIN_BET, Math.min(maxBet, bet));
    let lines = parseInt(args[1], 10);
    if (isNaN(lines)) lines = 10;
    lines = Math.max(5, Math.min(25, lines));
    const rows = lines >= 20 ? 4 : 3, cols = 5;
    if (!Casino.hasEnoughCasino(userId, bet)) return reply(message, errorContainer(`Fonds insuffisants. Solde: ${Casino.getCasinoBalance(userId)} JTN`));
    Casino.deductCasinoCredits(userId, bet);
    const jpCut = Math.floor(bet * (settings.JACKPOT_CUT || 0.04));
    if (jpCut > 0) try { Casino.addToGuildJackpot(guildId, jpCut); } catch {}
    const symbols = [
      { sym: '🍒', w: 40, pay: [0, 0, 2, 6, 12] }, { sym: '🍋', w: 34, pay: [0, 0, 3, 8, 16] },
      { sym: '🍇', w: 26, pay: [0, 0, 6, 14, 30] }, { sym: '💎', w: 12, pay: [0, 0, 15, 40, 100] },
      { sym: '7️⃣', w: 6, pay: [0, 0, 25, 80, 200] }, { sym: 'W', w: 10, pay: [0, 0, 0, 0, 0] }, { sym: 'S', w: 6, pay: [0, 0, 0, 0, 0] }
    ];
    const strip = [];
    for (const s of symbols) for (let i = 0; i < s.w; i++) strip.push(s.sym);
    const spinCol = () => strip[Math.floor(Math.random() * strip.length)];
    const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => spinCol()));
    const payTable = symbols.reduce((m, s) => { m[s.sym] = s.pay; return m; }, {});
    const isWild = x => x === 'W', isScatter = x => x === 'S';
    const lineDefs = rows === 3 ? [
      [[0,0],[0,1],[0,2],[0,3],[0,4]], [[1,0],[1,1],[1,2],[1,3],[1,4]], [[2,0],[2,1],[2,2],[2,3],[2,4]],
      [[0,0],[1,1],[2,2],[1,3],[0,4]], [[2,0],[1,1],[0,2],[1,3],[2,4]]
    ] : [
      [[0,0],[0,1],[0,2],[0,3],[0,4]], [[1,0],[1,1],[1,2],[1,3],[1,4]], [[2,0],[2,1],[2,2],[2,3],[2,4]], [[3,0],[3,1],[3,2],[3,3],[3,4]],
      [[0,0],[1,1],[2,2],[1,3],[0,4]], [[3,0],[2,1],[1,2],[2,3],[3,4]]
    ];
    const evaluateLine = def => {
      let chainSym = null, count = 0;
      for (const [r, c] of def) {
        const s = grid[r][c];
        if (isScatter(s)) return 0;
        if (count === 0) { chainSym = isWild(s) ? null : s; count = 1; }
        else { if (chainSym == null && !isWild(s)) chainSym = s; if (isWild(s) || s === chainSym) count++; else break; }
      }
      if (!chainSym) return 0;
      const pays = payTable[chainSym] || [0,0,0,0,0];
      if (count >= 5) return Math.floor(bet * (pays[4] || 0));
      if (count === 4) return Math.floor(bet * (pays[3] || 0));
      if (count === 3) return Math.floor(bet * (pays[2] || 0));
      return 0;
    };
    let scatterCount = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (grid[r][c] === 'S') scatterCount++;
    let totalWin = 0; const lineHits = [];
    lineDefs.slice(0, lines).forEach((ln, idx) => { const w = evaluateLine(ln); if (w > 0) { totalWin += w; lineHits.push({ idx: idx+1, win: w }); } });
    let freeSpins = 0;
    if (scatterCount >= 3) { freeSpins = 5 + Math.floor(Math.random() * 8); totalWin += Math.floor(bet * (0.5 + 0.2 * (scatterCount-3))); }
    let bonusNote = '';
    if (Math.random() < (settings.BONUS_CHANCE || 0.05)) {
      const pool = []; [[2,60],[3,25],[5,10],[10,5]].forEach(([m,w]) => { for (let k=0;k<w;k++) pool.push(m); });
      const pick = pool[Math.floor(Math.random()*pool.length)];
      totalWin += Math.floor(bet*pick); bonusNote = `🎁 Bonus: x${pick}`;
    }
    let guildJpWin = 0;
    try { guildJpWin = Casino.tryWinGuildJackpot(guildId) || 0; } catch {}
    if (guildJpWin > 0) totalWin += guildJpWin;
    const { penalty } = Risk.getEdgePenalty ? Risk.getEdgePenalty(userId) : { penalty: 0 };
    if (penalty > 0 && totalWin > 0) totalWin = Math.floor(totalWin * (1-penalty));
    try { Risk.recordPlay && Risk.recordPlay(userId, { bet, payout: totalWin }); } catch {}
    if (totalWin > 0) Casino.addCasinoCredits(userId, totalWin);
    Casino.setCooldown(userId, 'slotsplus', settings.COOLDOWN_MS || 5000);
    try { Casino.grantGameXpWithBonuses && Casino.grantGameXpWithBonuses(userId, { game: 'slots', bet, win: totalWin > 0, payout: totalWin }); } catch {}
    try { Casino.addHistory(userId, 'slotsplus', { bet, payout: totalWin, win: totalWin > 0, lines, rows }); } catch {}
    try { if (totalWin >= bet*10 || guildJpWin > 0) { const emb = notify.buildEmbed('🎉 Slots+', `${message.author} a réalisé un gros gain! +${totalWin} JTN`); await notify.notify(client, guildId, emb); } } catch {}
    const finalBal = Casino.getCasinoBalance(userId);
    const gridStr = '```\n' + grid.map(r => r.join(' | ')).join('\n') + '\n```';
    const hitsText = lineHits.length ? lineHits.map(h => `L${h.idx}: +${h.win}`).join(', ') : 'Aucune';
    return reply(message, container(
      txt(`## 🎰 Slots+ — ${totalWin > 0 ? '✅ Gain !' : '❌ Perdu'}`),
      sep(),
      txt([gridStr, `**Mise:** ${bet} | **Gain:** ${totalWin} | **Solde:** ${finalBal} JTN`, `**Lignes:** ${hitsText} | **Free Spins:** ${freeSpins}`, guildJpWin > 0 ? `💎 **JACKPOT SERVEUR ! +${guildJpWin} JTN**` : '', bonusNote].filter(Boolean).join('\n'))
    ));
  }
};
