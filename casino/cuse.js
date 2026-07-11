const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const Items = require('../../utils/items');

module.exports = {
  name: 'cuse',
  aliases: ['use', 'itemuse'],
  description: 'Utilise un objet du casino',
  usage: '+cuse <objet>',
  category: 'casino',
  run: async (client, message, args) => {
    if (!message.guild) return;
    const uid = message.author.id;
    const name = (args[0] || '').toLowerCase();
    if (!name) return reply(message, errorContainer('Usage: `+cuse <objet>`'));
    const r = Items.use(uid, name);
    if (!r.ok) return reply(message, errorContainer(r.error));
    return reply(message, container(txt('## ✅ Objet Utilisé'), sep(), txt(`Vous avez utilisé **${r.item.name}** !`)));
  }
};
