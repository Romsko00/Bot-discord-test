const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const mining = require('../../utils/mining');
const logger = require('../../utils/logger');

module.exports = {
  name: 'csell',
  aliases: ['sell', 'vendre'],
  description: 'Vend des ressources minées',
  usage: '+csell <ressource> <quantité>',
  category: 'casino',
  run: async (client, message, args) => {
    try {
      const userId = message.author.id;
      if (args.length < 2) return reply(message, errorContainer('**Usage :** `+csell <ressource> <quantité>`\nEx: `+csell coal 10`'));
      const resourceId = args[0].toLowerCase();
      const amount = parseInt(args[1]);
      if (isNaN(amount) || amount <= 0) return reply(message, errorContainer('Quantité invalide.'));
      const result = mining.sellResource(userId, resourceId, amount);
      if (!result.ok) return reply(message, errorContainer(result.error));
      return reply(message, container(
        txt('## 💰 Vente Réussie'),
        sep(),
        txt([
          `Vendu **${result.amount}x ${result.resource.icon} ${result.resource.name}**`,
          `Prix unitaire: ${result.resource.value} 💰 | Total: **${result.totalValue} 💰**`
        ].join('\n'))
      ));
    } catch (error) {
      logger.error('[CSELL] Erreur:', error);
      return reply(message, errorContainer('Une erreur est survenue.'));
    }
  }
};
