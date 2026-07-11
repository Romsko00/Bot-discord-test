const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const casinoLogger = require('../../utils/casinoLogger');
const db = require('../../utils/simpledb');
const { hasPermissionLevel } = require('../../utils/permissionUtils');

module.exports = {
  name: 'cstats',
  aliases: ['casino-stats', 'casinostats'],
  description: 'Affiche les statistiques détaillées du casino',
  usage: '+cstats [user|global|logs]',
  category: 'casino',
  run: async (client, message, args) => {
    const type = (args[0] || 'user').toLowerCase();
    if (type === 'global' || type === 'server') return showGlobalStats(client, message);
    if (type === 'logs') return showLogsStats(client, message);
    return showUserStats(client, message);
  }
};

async function showUserStats(client, message) {
  const userId = message.author.id;
  const balance = Casino.getCasinoBalance(userId);
  const xp = Casino.getXp(userId);
  const level = Casino.getLevel(userId);
  const stats = Casino.getStats(userId);
  const achievements = Casino.getAchievements ? Casino.getAchievements(userId) : {};
  const totalGames = Object.values(stats).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
  const gameBreakdown = Object.entries(stats).filter(([_, count]) => count > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([game, count]) => `• ${game}: ${count}`).join('\n') || 'Aucune partie jouée.';
  const recentGames = casinoLogger.readLogs ? casinoLogger.readLogs('game', { userId, limit: 10 }) : [];
  const totalWagered = recentGames.reduce((sum, g) => sum + (g.bet || 0), 0);
  const totalWon = recentGames.reduce((sum, g) => sum + (g.payout || 0), 0);
  const winRate = recentGames.length > 0 ? ((recentGames.filter(g => g.win).length / recentGames.length) * 100).toFixed(1) : '0.0';
  const streak = db.get(`casino_streak_${userId}`) || 0;
  const lastClaim = db.get(`casino_lastclaim_${userId}`) || 0;
  const canClaimIn = Math.max(0, 24 * 60 * 60 * 1000 - (Date.now() - lastClaim));
  const canClaimText = canClaimIn > 0 ? `Dans ${Math.floor(canClaimIn / 3600000)}h ${Math.floor((canClaimIn % 3600000) / 60000)}m` : 'Maintenant !';
  return reply(message, container(
    txt(`## 📊 Stats Casino — ${message.author.username}`),
    sep(),
    txt([
      `💰 **Solde :** ${balance.toLocaleString()} JTN | **Misé :** ${totalWagered.toLocaleString()} | **Gagné :** ${totalWon.toLocaleString()}`,
      `📈 **Niveau :** ${level} | **XP :** ${xp} | **Streak :** ${streak}j | **Succès :** ${Object.keys(achievements).length}`,
      `🎮 **Parties :** ${totalGames} | **Winrate :** ${winRate}% | **Claim :** ${canClaimText}`,
      '',
      '**🎯 Jeux favoris :**',
      gameBreakdown
    ].join('\n'))
  ));
}

async function showGlobalStats(client, message) {
  const all = db.all();
  let totalBalance = 0, playerCount = 0;
  const topPlayers = [];
  for (const row of all) {
    const key = row.ID || row.key;
    if (key && key.startsWith('casino_credits_')) {
      const balance = Number(row.data || row.value) || 0;
      totalBalance += balance;
      playerCount++;
      topPlayers.push({ userId: key.replace('casino_credits_', ''), balance });
    }
  }
  topPlayers.sort((a, b) => b.balance - a.balance);
  const top5 = topPlayers.slice(0, 5).map((p, i) => `**#${i+1}** <@${p.userId}> — ${p.balance.toLocaleString()} JTN`).join('\n') || 'Aucun joueur.';
  const gameStats = casinoLogger.getStats ? casinoLogger.getStats('game', 7) : {};
  const jackpot = Casino.getJackpot();
  return reply(message, container(
    txt('## 📊 Stats Globales — Casino'),
    sep(),
    txt([
      `👥 **Joueurs :** ${playerCount} | **JTN total :** ${totalBalance.toLocaleString()} | **Jackpot :** ${jackpot.toLocaleString()}`,
      `📈 **Parties (7j) :** ${gameStats?.totalEntries || 0} | **Joueurs uniques :** ${gameStats?.uniqueUsers || 0}`,
      '',
      '**🏆 Top 5 Joueurs :**',
      top5
    ].join('\n'))
  ));
}

async function showLogsStats(client, message) {
  const isAdmin = hasPermissionLevel(client, message, 6) || client.config.owners?.includes(message.author.id) || client.config.superadmin?.includes(message.author.id);
  if (!isAdmin) return reply(message, errorContainer('Cette section est réservée aux administrateurs.'));
  const categories = ['game', 'transaction', 'shop', 'job', 'team', 'achievement', 'security', 'error'];
  const stats = {};
  for (const cat of categories) { try { stats[cat] = casinoLogger.getStats ? casinoLogger.getStats(cat, 7) : {}; } catch { stats[cat] = {}; } }
  const lines = categories.map(c => `• **${c} :** ${stats[c]?.totalEntries || 0} entrées — ${stats[c]?.uniqueUsers || 0} utilisateurs`);
  return reply(message, container(txt('## 📋 Stats Logs Casino (7j)'), sep(), txt(lines.join('\n'))));
}
