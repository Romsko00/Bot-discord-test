const { container, txt, sep, reply } = require('../../utils/v2');
const Casino = require('../../utils/casino');

module.exports = {
  name: 'cprofilestats',
  aliases: ['profilestats', 'statsprofile'],
  description: 'Affiche les statistiques avancées de ton profil casino',
  usage: '+cprofilestats',
  category: 'casino',
  run: async (client, message, args) => {
    const userId = message.author.id;
    const stats = Casino.getStats(userId);
    const allGames = ['slots', 'roulette', 'blackjack', 'dice', 'flip'];
    const fav = Object.entries(stats).sort((a, b) => b[1] - a[1])[0];
    const roi = ((stats.total_won || 0) / (stats.total_bet || 1) * 100).toFixed(1);
    const luck = (((stats.total_won || 0) / (stats.total_bet || 1)) / 0.95 * 100).toFixed(1);
    const winrates = allGames.map(g => `${g}: ${(((stats[`${g}_wins`] || 0) / (stats[`${g}_plays`] || 1)) * 100).toFixed(1)}%`).join(' | ');
    const lines = [
      `**Jeu favori :** ${fav ? fav[0] : 'Aucun'}`,
      `**ROI global :** ${roi}%`,
      `**Plus gros gain :** ${stats.max_win || 0} JTN`,
      `**Plus grosse perte :** ${stats.max_loss || 0} JTN`,
      `**Heures jouées :** ${((stats.total_plays || 0) * 2 / 60).toFixed(1)}h`,
      `**Luck Index :** ${luck}`,
      '',
      `**Winrates :** ${winrates}`
    ];
    return reply(message, container(txt('## 📊 Statistiques Profil Casino'), sep(), txt(lines.join('\n'))));
  }
};
