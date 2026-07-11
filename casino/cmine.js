const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const mining = require('../../utils/mining');
const logger = require('../../utils/logger');

const RARITY_TEXT = { common: 'Commun', uncommon: 'Peu commun', rare: '🔵 Rare', epic: '🟣 Épique', legendary: '🟠 Légendaire', mythic: '✨ Mythique' };

module.exports = {
  name: 'cmine',
  aliases: ['mine', 'miner'],
  description: 'Mine des ressources précieuses',
  usage: '+cmine',
  category: 'casino',
  run: async (client, message, args) => {
    try {
      const userId = message.author.id;
      const result = mining.mine(userId);
      if (!result.ok) return reply(message, errorContainer(result.error));
      if (result.nothing) {
        return reply(message, container(txt('## ⛏️ Mining'), sep(), txt(result.message || 'Rien trouvé... Réessaie !')));
      }
      const level = mining.getMiningLevel(userId);
      const xp = mining.getMiningXP(userId);
      const tool = mining.getEquippedTool(userId);
      const toolInfo = tool ? mining.tools[tool] : null;
      const lines = [
        `Vous avez miné **${result.resource.icon} ${result.resource.name}** !`,
        `**Rareté :** ${RARITY_TEXT[result.resource.rarity] || result.resource.rarity}`,
        `**Valeur :** ${result.resource.value} 💰`,
        `**XP gagnée :** +${result.xpGained}`,
        result.levelUp ? `\n🎉 **Level Up ! Niveau de minage : ${result.newLevel}**` : '',
        result.toolBroken ? `\n💔 **Outil cassé :** ${result.toolName}` : '',
        '',
        `**Stats :** Niveau ${level} | XP ${xp} | Outil: ${toolInfo ? `${toolInfo.icon} ${toolInfo.name}` : 'Aucun'}`
      ].filter(s => s !== '');
      return reply(message, container(txt('## ⛏️ Mining — Ressource trouvée !'), sep(), txt(lines.join('\n'))));
    } catch (error) {
      logger.error('[CMINE] Erreur:', error);
      return reply(message, errorContainer('Une erreur est survenue lors du minage.'));
    }
  }
};
