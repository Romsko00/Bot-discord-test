const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const mining = require('../../utils/mining');
const Casino = require('../../utils/casino');
const logger = require('../../utils/logger');

module.exports = {
  name: 'cminingshop',
  aliases: ['miningshop', 'mineshop'],
  description: 'Boutique d\'outils de minage',
  usage: '+cminingshop [acheter <outil>]',
  category: 'casino',
  run: async (client, message, args) => {
    try {
      const userId = message.author.id;
      const sub = (args[0] || '').toLowerCase();
      if (sub === 'acheter' || sub === 'buy') {
        const toolId = args[1];
        if (!toolId) return reply(message, errorContainer('Spécifiez un outil. Ex: `+cminingshop acheter wooden_pickaxe`'));
        const result = mining.buyTool(userId, toolId);
        if (!result.ok) return reply(message, errorContainer(result.error));
        return reply(message, container(
          txt('## ✅ Achat Réussi'),
          sep(),
          txt([`**${result.tool.icon} ${result.tool.name}** acheté !`, `Prix: ${result.tool.price} 💰 | Durabilité: ${result.tool.durability === -1 ? '∞' : result.tool.durability} | Efficacité: x${result.tool.efficiency}`].join('\n'))
        ));
      }
      const balance = Casino.getCasinoBalance(userId);
      const ownedTools = mining.getOwnedTools(userId);
      const ownedIds = ownedTools.map(t => t.id);
      const toolLines = Object.entries(mining.tools).map(([toolId, tool]) => {
        const owned = ownedIds.includes(toolId);
        return [`${tool.icon} **${tool.name}** ${owned ? '✅ Possédé' : ''}`, `Prix: ${tool.price} 💰 | Durabilité: ${tool.durability === -1 ? '∞' : tool.durability} | x${tool.efficiency} | +${(tool.bonusDropRate * 100).toFixed(0)}% drop | ID: \`${toolId}\``].join('\n');
      });
      return reply(message, container(
        txt('## 🛒 Boutique d\'Outils de Minage'),
        sep(),
        txt([`**Votre solde :** ${balance} 💰`, '', ...toolLines, '', '`+cminingshop acheter <id>` pour acheter'].join('\n'))
      ));
    } catch (error) {
      logger.error('[CMININGSHOP] Erreur:', error);
      return reply(message, errorContainer('Une erreur est survenue.'));
    }
  }
};
