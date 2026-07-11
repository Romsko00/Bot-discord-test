const { container, txt, sep, reply } = require('../../utils/v2');
const Casino = require('../../utils/casino');

module.exports = {
  name: 'cstatsdetailed',
  aliases: ['cstats', 'cdetails', 'cprofile'],
  description: 'Affiche les statistiques détaillées du casino',
  usage: '+cstatsdetailed',
  category: 'casino',
  run: async (client, message, args) => {
    const userId = message.author.id;
    const stats = Casino.getDetailedStats(userId);
    const session = Casino.getSessionStats(userId);
    const level = Casino.getLevel(userId);
    const xp = Casino.getXp(userId);
    const xpNeeded = Casino.xpNeededForLevel(level);
    const balance = Casino.getCasinoBalance(userId);
    const bonusStreak = Casino.getBonusStreak(userId);
    const bonusMultiplier = Casino.getBonusMultiplier(userId);
    const roi = stats.totalWagered > 0 ? (((stats.totalPayout - stats.totalWagered) / stats.totalWagered) * 100).toFixed(2) : 0;
    const profitLoss = stats.totalPayout - stats.totalWagered;
    const xpPct = Math.max(0, Math.min(10, Math.floor((xp % xpNeeded) / xpNeeded * 10)));
    const bar = `${'█'.repeat(xpPct)}${'░'.repeat(10 - xpPct)} ${(xpPct*10)}%`;
    const gameStatsLines = stats.gameStats ? Object.entries(stats.gameStats).map(([game, d]) => `**${game}:** ${d.plays} parties | ${d.wins}W | ${d.plays>0?(d.wins/d.plays*100).toFixed(1):0}% | ${d.payout} JTN`) : [];
    const lines = [
      '**💰 Bilan**',
      `Solde: ${balance} | Misé: ${stats.totalWagered} | Gagné: ${stats.totalPayout} | P/L: ${profitLoss>=0?'+':''}${profitLoss} | ROI: ${roi}%`,
      '',
      '**🎮 Jeu**',
      `Parties: ${stats.totalGames} | Victoires: ${stats.totalWon} | Défaites: ${stats.totalLost} | Winrate: ${stats.winRate}% | Mise moy: ${stats.averageBet} JTN`,
      '',
      '**🏆 Records**',
      `Max gain: +${stats.largestWin} JTN | Max perte: -${stats.largestLoss} JTN | Série win: ${stats.longestWinStreak} | Série loss: ${stats.longestLossStreak}`,
      '',
      `**⭐ Niveau ${level}** — XP: ${xp}/${xpNeeded} [${bar}]`,
      `Streak: ${bonusStreak} | Multiplicateur: ${bonusMultiplier.toFixed(2)}x | Jeu fav: ${stats.favoriteGame || 'Aucun'}`,
      '',
      `**📅 Session** — Parties: ${session.gamesPlayed} | Misé: ${session.totalWagered} | Profit: ${session.sessionProfit>=0?'+':''}${session.sessionProfit} JTN`,
      gameStatsLines.length ? '\n**🎲 Stats par jeu**\n' + gameStatsLines.join('\n') : ''
    ].filter(s => s !== '');
    return reply(message, container(txt('## 📊 Statistiques Détaillées Casino'), sep(), txt(lines.join('\n'))));
  }
};
