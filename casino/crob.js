const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const criminalSystem = require('../../utils/criminalSystem');
const logger = require('../../utils/logger');

module.exports = {
  name: 'crob',
  aliases: ['rob', 'voler', 'steal'],
  description: 'Tente de voler un utilisateur (métier: Voleur requis)',
  usage: '+crob @utilisateur',
  category: 'casino',
  run: async (client, message, args) => {
    try {
      const robberId = message.author.id;
      const target = message.mentions.users.first();
      if (!target) return reply(message, errorContainer('Mentionnez un utilisateur à voler. Usage: `+crob @utilisateur`'));
      if (target.bot) return reply(message, errorContainer('Vous ne pouvez pas voler un bot.'));
      const result = await criminalSystem.rob(robberId, target.id, message.guild);
      if (!result.ok) return reply(message, errorContainer(result.error));
      const stats = criminalSystem.getStats(robberId);
      const lines = result.success
        ? [`🥷 **Cible :** ${target}`, `💰 **Butin :** ${result.stolen} JTN`, '', result.message, '', `Total volé: ${stats.totalRobbed} JTN`]
        : [`⚖️ **Amende :** ${result.penalty} JTN`, `🚔 **Prison :** ${Math.ceil(result.jailTime / 60000)} min`, '', result.message];
      return reply(message, container(txt(`## ${result.success ? '🥷 Vol Réussi !' : '🚔 Vol Échoué !'}`), sep(), txt(lines.join('\n'))));
    } catch (error) {
      logger.error('[CROB] Erreur:', error);
      return reply(message, errorContainer('Une erreur est survenue.'));
    }
  }
};
