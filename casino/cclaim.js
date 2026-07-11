const { container, txt, sep, reply } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const casinoLogger = require('../../utils/casinoLogger');
const db = require('../../utils/simpledb');

function checkDailyAchievements(userId, streak) {
  const achievements = Casino.getAchievements ? Casino.getAchievements(userId) : {};
  if (streak >= 7 && !achievements.streak_7) { try { Casino.unlockAchievement && Casino.unlockAchievement(userId, 'streak_7', { name: 'Une Semaine de Suite', reward: 1000 }); } catch {} }
  if (streak >= 30 && !achievements.streak_30) { try { Casino.unlockAchievement && Casino.unlockAchievement(userId, 'streak_30', { name: 'Marathonien', reward: 5000 }); } catch {} }
  if (streak >= 100 && !achievements.streak_100) { try { Casino.unlockAchievement && Casino.unlockAchievement(userId, 'streak_100', { name: 'Légende Assidue', reward: 25000 }); } catch {} }
}

module.exports = {
  name: 'cclaim',
  aliases: ['cdaily', 'cday', 'daily'],
  description: 'Récupérer vos crédits quotidiens avec bonus de streak',
  usage: '+cclaim [info]',
  category: 'casino',
  run: async (client, message, args) => {
    const userId = message.author.id;

    if (args[0] === 'info') {
      return reply(message, container(
        txt('## 🎁 Système de Claim Quotidien'),
        sep(),
        txt([
          '**💰 Montant de Base :** 500 JTN/jour',
          '**⏰ Fréquence :** Toutes les 24h',
          '**🔥 Streak :** +5% par jour consécutif (max 100%)',
          '**📊 Niveau :** +1% par niveau (max 50%)',
          '**💎 VIP :** +20%',
          '',
          '**🏆 Milestones :** 7j, 30j (+5k JTN), 100j (+25k JTN)'
        ].join('\n'))
      ));
    }

    const result = Casino.claimCasinoDaily(userId);
    if (!result.ok) {
      return reply(message, container(
        txt('## ⏰ Claim Quotidien'),
        sep(),
        txt([`Vous avez déjà récupéré vos crédits aujourd'hui !`, `**Disponible dans :** ${Casino.formatMs(result.remaining)}`].join('\n'))
      ));
    }

    const level = Casino.getLevel(userId);
    const vipActive = db.get(`casino_vip_${userId}`) && (db.get(`casino_vip_${userId}`) === -1 || db.get(`casino_vip_${userId}`) > Date.now());
    let bonusMultiplier = 1;
    const levelBonus = Math.min(level * 0.01, 0.5);
    bonusMultiplier += levelBonus;
    if (vipActive) bonusMultiplier += 0.2;
    const streakBonus = Math.min(result.streak * 0.05, 1.0);
    bonusMultiplier += streakBonus;
    const finalAmount = Math.floor(result.amount * bonusMultiplier);
    const bonusAmount = finalAmount - result.amount;
    if (bonusAmount > 0) Casino.addCasinoCredits(userId, bonusAmount);

    try { casinoLogger.logTransaction('daily_claim', userId, finalAmount, { balance: Casino.getCasinoBalance(userId), reason: 'daily_claim', streak: result.streak }); } catch {}
    checkDailyAchievements(userId, result.streak);

    if (result.streak === 30) Casino.addCasinoCredits(userId, 5000);
    if (result.streak === 100) Casino.addCasinoCredits(userId, 25000);

    const newBalance = Casino.getCasinoBalance(userId);
    const bonusDetails = [];
    if (levelBonus > 0) bonusDetails.push(`📊 Niveau ${level}: +${Math.floor(levelBonus * 100)}%`);
    if (vipActive) bonusDetails.push('💎 VIP: +20%');
    if (streakBonus > 0) bonusDetails.push(`🔥 Série: +${Math.floor(streakBonus * 100)}%`);

    const lines = [
      `🎉 **+${finalAmount.toLocaleString()} JTN** reçus !`,
      `**Nouveau solde :** ${newBalance.toLocaleString()} JTN`,
      `**Série :** ${result.streak} jours 🔥`
    ];
    if (bonusDetails.length) lines.push('', '**Multiplicateurs :**', ...bonusDetails);
    if (result.streak === 7) lines.push('', '🎉 **Milestone 1 semaine !**');
    if (result.streak === 30) lines.push('', '🏆 **Milestone 1 mois ! +5,000 JTN bonus**');
    if (result.streak === 100) lines.push('', '🌟 **Milestone légendaire 100 jours ! +25,000 JTN**');

    return reply(message, container(txt('## 🎁 Bonus Quotidien'), sep(), txt(lines.join('\n'))));
  }
};
