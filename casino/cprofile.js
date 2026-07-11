const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'cprofile',
  aliases: ['profile', 'profil', 'casino-profile'],
  description: 'Affiche ta carte de profil casino personnalisée',
  usage: '+cprofile [@user]',
  category: 'casino',
  run: async (client, message) => {
    const user = message.mentions.users.first() || message.author;
    const userId = user.id;
    try {
      const { drawProfileCard } = require('../../utils/canvas/profileCard');
      const level = Casino.getLevel(userId);
      const xp = Casino.getXp(userId);
      const xpNeeded = Casino.xpNeededForLevel(level);
      const prestige = db.get(`casino_prestige_${userId}`) || 0;
      const vip = Casino.getVipActive(userId);
      const balance = Casino.getCasinoBalance(userId);
      const streak = db.get(`casino_streak_${userId}`) || 0;
      const title = db.get(`casino_title_${userId}`) || '';
      const background = db.get(`casino_bg_${userId}`) || null;
      const badges = db.get(`casino_badges_${userId}`) || [];
      const effects = db.get(`casino_effects_${userId}`) || [];
      const frame = db.get(`casino_frame_${userId}`) || null;
      const buffer = await drawProfileCard({ avatarURL: user.displayAvatarURL({ format: 'png', size: 256 }), username: user.username, userId, level, xp, xpNeeded, prestige, vip, balance, streak, title, background, badges, effects, frame, equipped: {} });
      await message.channel.send({ content: `🎭 Profil de **${user.username}**`, files: [{ attachment: buffer, name: 'profile.png' }] });
    } catch (e) {
      const level = Casino.getLevel(userId);
      const xp = Casino.getXp(userId);
      const balance = Casino.getCasinoBalance(userId);
      const prestige = db.get(`casino_prestige_${userId}`) || 0;
      const streak = db.get(`casino_streak_${userId}`) || 0;
      const vip = Casino.getVipActive(userId);
      return reply(message, container(txt(`## 🎭 Profil — ${user.username}`), sep(), txt([`**Niveau :** ${level} | **XP :** ${xp}`, `**Solde :** ${balance} JTN`, `**Prestige :** ${prestige} | **Streak :** ${streak}`, vip ? '💎 **VIP Actif**' : ''].filter(Boolean).join('\n'))));
    }
  }
};
