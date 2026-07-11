const { container, txt, sep, reply, errorContainer, formatNumber } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'top',
  aliases: ['levels'],
  description: 'Affiche le top 10 des membres les plus actifs',
  level: 0,
  run: async (client, message) => {
    try {
      const guildId = message.guild.id;
      const serverXpData = db.all().filter(d => d.ID.startsWith(`guild_${guildId}_xp_`)).sort((a, b) => (b.data || 0) - (a.data || 0));
      if (!serverXpData.length) return reply(message, container(txt('## 🏆 Top 10'), sep(), txt('Personne n\'a encore gagné d\'XP sur ce serveur.')));
      const top10 = serverXpData.slice(0, 10);
      const medals = ['🥇', '🥈', '🥉'];
      const lines = top10.map((entry, i) => {
        const userId = entry.ID.split('_')[3];
        const memberUser = message.guild.members.cache.get(userId)?.user;
        const displayName = memberUser ? memberUser.username : `Utilisateur Inconnu (${userId})`;
        const xp = entry.data || 0;
        const level = db.get(`guild_${guildId}_level_${userId}`) || 1;
        const messages = db.get(`msg_${guildId}_${userId}`) || 0;
        const medal = i < 3 ? medals[i] : `**#${i + 1}**`;
        return `${medal} **${displayName}**\n↳ Niveau **${level}** • ${formatNumber(xp)} XP • ${formatNumber(messages)} msgs`;
      }).join('\n\n');
      return reply(message, container(
        txt(`## 🏆 Classement — ${message.guild.name}`),
        sep(),
        txt(lines)
      ));
    } catch (error) {
      console.error('Erreur top:', error);
      return reply(message, errorContainer('Erreur lors de la génération du classement.'));
    }
  }
};
