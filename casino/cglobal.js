const { container, txt, sep, reply } = require('../../utils/v2');
const GlobalCasino = require('../../utils/globalCasino');

module.exports = {
  name: 'cglobal',
  aliases: ['global', 'worldcasino'],
  description: 'Stats et classements du casino multi-serveurs',
  usage: '+cglobal',
  category: 'casino',
  run: async (client, message) => {
    const stats = GlobalCasino.getGlobalStats();
    const leaderboard = GlobalCasino.getGlobalLeaderboard();
    const lb = leaderboard.length > 0 ? leaderboard.slice(0, 10).map((u, i) => `**#${i+1}** <@${u.id}> — ${u.jtn} JTN`).join('\n') : 'Aucune donnée.';
    return reply(message, container(
      txt('## 🌍 Casino Multi-Serveurs'),
      sep(),
      txt([`**Total JTN :** ${stats.totalJTN} | **Joueurs :** ${stats.totalPlayers} | **Jackpot mondial :** ${stats.jackpot}`, '', '**🏆 Classement mondial :**', lb].join('\n'))
    ));
  }
};
