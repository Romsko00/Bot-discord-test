const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'cbalance',
  aliases: ['cbal', 'cwallet', 'cmoney'],
  description: 'Affiche votre solde de casino',
  usage: '+cbalance [@membre]',
  level: 1,
  run: async (client, message, args) => {
    try {
      const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member;
      const user = target.user;
      const userId = user.id;
      const balance = Casino.getCasinoBalance(userId);
      const level = Casino.getLevel(userId);
      const xp = Casino.getXp(userId);
      const lastClaim = db.get(`casino_last_claim_${userId}`) || 0;
      const streak = db.get(`casino_streak_${userId}`) || 0;
      const stats = Casino.getStats(userId);
      const totalBet = stats.total_bet || 0;
      const totalWon = stats.total_won || 0;
      const gamesPlayed = (stats.bj_plays || 0) + (stats.slots_plays || 0) + (stats.roulette_plays || 0) + (stats.dice_plays || 0) + (stats.flip_plays || 0);
      const nextClaim = lastClaim + 24*60*60*1000;
      const canClaim = Date.now() >= nextClaim;
      const timeUntilClaim = canClaim ? 'Disponible ✅' : `<t:${Math.floor(nextClaim / 1000)}:R>`;
      const totalGames = gamesPlayed || 1;
      const wins = stats.total_wins || 0;
      const winrate = ((wins / totalGames) * 100).toFixed(1);
      const profitLoss = totalWon - totalBet;
      const vipUntil = db.get(`casino_vip_${userId}`);
      const vipActive = vipUntil && (vipUntil === -1 || vipUntil > Date.now());
      const achievements = db.get(`casino_achievements_${userId}`) || {};
      const achCount = Object.keys(achievements).length;
      const lines = [
        `**${user.username}**${vipActive ? ' 💎 VIP' : ''}`,
        '',
        `💰 **Solde :** ${balance.toLocaleString()} JTN`,
        `⭐ **Niveau :** ${level} | XP: ${xp}`,
        '',
        `📈 **Streak :** ${streak} jours | Prochain claim: ${timeUntilClaim}`,
        '',
        `🎮 **Parties :** ${gamesPlayed} | Winrate: ${winrate}%`,
        `📊 **Misé :** ${totalBet} | Gagné: ${totalWon} | P/L: ${profitLoss >= 0 ? '+' : ''}${profitLoss} JTN`,
        achCount > 0 ? `\n🏆 **Succès débloqués :** ${achCount}` : ''
      ].filter(s => s !== '');
      return reply(message, container(txt('## 💰 Portefeuille Casino'), sep(), txt(lines.join('\n'))));
    } catch (error) {
      return reply(message, errorContainer('Impossible de récupérer les informations du portefeuille.'));
    }
  }
};
