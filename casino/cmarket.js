const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const Market = require('../../utils/market');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'cmarket',
  aliases: ['market', 'marche'],
  description: 'Marché entre joueurs casino (achat/vente objets, crédits)',
  usage: '+cmarket | +cmarket sell <objet> <prix>',
  category: 'casino',
  run: async (client, message, args) => {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'sell') {
      const itemName = args[1];
      const price = parseInt(args[2], 10);
      if (!itemName || isNaN(price) || price <= 0) return reply(message, errorContainer('**Usage :** `+cmarket sell <objet> <prix>`'));
      Market.addOffer({ id: uuidv4().slice(0, 6), type: 'item', name: itemName, price, seller: message.author.id, sold: false });
      return reply(message, container(txt('## ✅ Offre Ajoutée'), sep(), txt(`**${itemName}** mis en vente à **${price} JTN** !`)));
    }
    const offers = Market.getOffers().filter(o => !o.sold);
    const lines = offers.length
      ? offers.map(o => `${o.type === 'item' ? '🎁' : '💰'} **${o.name}** — ${o.price} JTN — Vendeur: <@${o.seller}>`)
      : ['Aucune offre pour le moment.'];
    return reply(message, container(txt('## 💼 Marché Casino'), sep(), txt(lines.join('\n'))));
  }
};
