const db = require('../../utils/simpledb');
const { container, txt, sep, reply, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'level', aliases: ['lv', 'levell'],
  description: "Affiche le niveau d'un utilisateur", level: 0,
  run: async (client, message, args) => {
    const user = message.mentions.users.first() || client.users.cache.get(args[0]) || message.author;
    const guildId = message.guild.id, userId = user.id;
    const level = db.get(`guild_${guildId}_level_${userId}`) || 1;
    const xp = db.get(`guild_${guildId}_xp_${userId}`) || 0;
    const messages = db.get(`msg_${guildId}_${userId}`) || 0;
    const xpNeeded = level * client.config.LEVELS.XP_REQUIRED_PER_LEVEL;
    const credits = client.CreditLevelSystem.getUserCredits(userId, guildId);
    const allUsers = db.all().filter(d => d.ID.startsWith(`guild_${guildId}_level_`));
    const sorted = allUsers.sort((a, b) => { const lA = a.data, xA = db.get(`guild_${guildId}_xp_${a.ID.split('_')[3]}`) || 0, lB = b.data, xB = db.get(`guild_${guildId}_xp_${b.ID.split('_')[3]}`) || 0; return lA !== lB ? lB - lA : xB - xA; });
    const rank = sorted.findIndex(u => u.ID.split('_')[3] === userId) + 1;
    const discount = Math.min(level * client.config.CREDITS.LEVEL_MULTIPLIER * 100, client.config.CREDITS.MAX_LEVEL_DISCOUNT * 100);
    await reply(message, container(
      txt(`## 📊 Profil de ${user.username}`),
      sep(),
      txt([`📈 **Niveau :** ${level}`, `⭐ **XP :** ${xp}/${xpNeeded}`, `🏆 **Rang :** #${rank}`, `💬 **Messages :** ${messages}`, `💰 **Crédits :** ${credits}`, `🎯 **Réduction P1 :** ${discount}%`].join('\n'))
    ));
  }
};
