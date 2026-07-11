const { container, txt, sep, reply } = require('../../utils/v2');
const Items = require('../../utils/items');

module.exports = {
  name: 'cinventory',
  aliases: ['cinv', 'inventory', 'inv'],
  description: 'Inventaire des objets du casino',
  usage: '+cinventory',
  category: 'casino',
  run: async (client, message) => {
    if (!message.guild) return;
    const uid = message.author.id;
    const inv = Items.getInventory(uid);
    const list = Object.entries(inv);
    return reply(message, container(
      txt('## 🎒 Inventaire'),
      sep(),
      txt(list.length > 0 ? list.map(([k, v]) => `• **${k}** × ${v}`).join('\n') : 'Inventaire vide.')
    ));
  }
};
