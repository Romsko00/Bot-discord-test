const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const Crafting = require('../../utils/crafting');

const RECIPES = [
  { name: 'Lucky Charm', require: { gold: 10, gem: 2 }, result: 'lucky_charm' },
  { name: 'Jackpot Key', require: { gold: 20, gem: 5 }, result: 'jackpot_key' }
];

module.exports = {
  name: 'ccraft',
  aliases: ['craft', 'crafting'],
  description: 'Fabrique des objets rares avec tes ressources',
  usage: '+ccraft <objet>',
  category: 'casino',
  run: async (client, message, args) => {
    const userId = message.author.id;
    const itemName = (args[0] || '').toLowerCase();
    const recipe = RECIPES.find(r => r.name.toLowerCase() === itemName);
    if (!recipe) {
      const lines = RECIPES.map(r => `**${r.name}** — ${Object.entries(r.require).map(([t, a]) => `${a} ${t}`).join(', ')}`);
      return reply(message, container(txt('## 🔄 Crafting Casino'), sep(), txt(['**Objets craftables :**', ...lines, '', '`+ccraft <objet>` pour fabriquer'].join('\n'))));
    }
    const ok = Crafting.craftItem(userId, recipe);
    if (!ok) return reply(message, errorContainer('Ressources insuffisantes pour fabriquer cet objet.'));
    return reply(message, container(txt('## ✅ Objet Fabriqué !'), sep(), txt(`**${recipe.name}** ajouté à ton inventaire ! 🎁`)));
  }
};
