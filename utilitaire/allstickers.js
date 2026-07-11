const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'allstickers',
  description: 'Affiche tous les stickers du serveur',
  category: 'utilitaire',
  run: async (client, message) => {
    await message.guild.stickers.fetch();
    const stickers = message.guild.stickers.cache;
    if (stickers.size === 0) return reply(message, errorContainer('Aucun sticker sur ce serveur.'));
    let description = '';
    for (const [, s] of stickers) { const line = `[${s.name}](${s.url})\n`; if (description.length + line.length > 3900) break; description += line; }
    await reply(message, container(txt(`## 🎨 Stickers (${stickers.size})`), sep(), txt(description || 'Aucun lien affichable.')));
  }
};
