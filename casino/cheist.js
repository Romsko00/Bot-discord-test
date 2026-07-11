const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const criminalSystem = require('../../utils/criminalSystem');
const logger = require('../../utils/logger');

module.exports = {
  name: 'cheist',
  aliases: ['heist', 'braquer', 'braquage'],
  description: 'Tente de braquer la banque (métier: Voleur requis)',
  usage: '+cheist',
  category: 'casino',
  run: async (client, message, args) => {
    try {
      const userId = message.author.id;
      const result = await criminalSystem.heist(userId);
      if (!result.ok) return reply(message, errorContainer(result.error));
      const stats = criminalSystem.getStats(userId);
      const lines = result.success
        ? [`💰 **Butin :** ${result.stolen} JTN`, `🔧 **Équipement :** -${result.equipmentCost} JTN`, `✅ **Profit Net :** ${result.profit} JTN`]
        : [`🔧 **Équipement perdu :** ${result.equipmentCost} JTN`, `⚖️ **Amende :** ${result.penalty} JTN`, `🚔 **Prison :** ${Math.ceil(result.jailTime / 60000)} minutes`];
      lines.push('', result.message, '', `**Stats :** Total volé: ${stats.totalRobbed} JTN | Braqué: ${stats.totalHeisted} JTN | ${stats.inJail ? '🚔 En prison' : '🆓 Libre'}`);
      return reply(message, container(txt(`## ${result.success ? '💰 Braquage Réussi !' : '🚔 Braquage Échoué !'}`), sep(), txt(lines.join('\n'))));
    } catch (error) {
      logger.error('[CHEIST] Erreur:', error);
      return reply(message, errorContainer('Une erreur est survenue.'));
    }
  }
};
