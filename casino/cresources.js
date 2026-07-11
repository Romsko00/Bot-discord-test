const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const mining = require('../../utils/mining');
const logger = require('../../utils/logger');

module.exports = {
  name: 'cresources',
  aliases: ['resources', 'ressources', 'minventory'],
  description: 'Affiche votre inventaire de ressources minées',
  usage: '+cresources',
  category: 'casino',
  run: async (client, message, args) => {
    try {
      const userId = message.author.id;
      const inventory = mining.getInventory(userId);
      const level = mining.getMiningLevel(userId);
      const xp = mining.getMiningXP(userId);
      const tool = mining.getEquippedTool(userId);
      const toolInfo = tool ? mining.tools[tool] : null;
      let totalValue = 0;
      const resourceLines = [];
      for (const [resourceId, amount] of Object.entries(inventory)) {
        const resource = mining.resources[resourceId];
        const val = resource.value * amount;
        totalValue += val;
        resourceLines.push(`${resource.icon} **${resource.name}** x${amount} — ${val} 💰`);
      }
      return reply(message, container(
        txt('## ⛏️ Inventaire de Ressources'),
        sep(),
        txt([
          `**Niveau :** ${level} (${xp} XP)`,
          `**Outil :** ${toolInfo ? `${toolInfo.icon} ${toolInfo.name}` : 'Aucun'}`,
          `**Valeur totale :** ${totalValue} 💰`,
          '',
          resourceLines.length ? resourceLines.join('\n') : '*Inventaire vide. Utilisez `+cmine` pour miner !*',
          '',
          '*`+csell <ressource> <quantité>` pour vendre*'
        ].join('\n'))
      ));
    } catch (error) {
      logger.error('[CRESOURCES] Erreur:', error);
      return reply(message, errorContainer('Une erreur est survenue.'));
    }
  }
};
