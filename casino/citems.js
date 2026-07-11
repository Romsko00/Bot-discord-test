const { container, txt, sep, reply } = require('../../utils/v2');
const Items = require('../../utils/evolutiveItems');

module.exports = {
  name: 'citems',
  aliases: ['items', 'objets'],
  description: 'Affiche et améliore tes objets évolutifs casino',
  usage: '+citems',
  category: 'casino',
  run: async (client, message, args) => {
    const userId = message.author.id;
    const all = Items.getAllItems(userId);
    const entries = Object.entries(all);
    const lines = entries.length
      ? entries.map(([id, item]) => `**Lucky Charm lvl ${item.level}**\nXP: ${item.xp}/${item.level * 100} • Effet: +${item.level}% gains slots${item.level >= 10 ? ' ⭐ Spécial débloqué !' : ''}`)
      : ['Aucun objet évolutif pour le moment.'];
    return reply(message, container(txt('## 🎁 Objets Évolutifs Casino'), sep(), txt(['*Utilise tes objets pour les faire monter de niveau !*', '', lines.join('\n\n')].join('\n'))));
  }
};
