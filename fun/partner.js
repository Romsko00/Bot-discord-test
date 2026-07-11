const { container, txt, sep, reply } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'partner',
  aliases: ['couple'],
  description: 'Affiche la relation RP d\'un utilisateur',
  run: async (client, message) => {
    const user = message.mentions.users.first() || message.author;
    const partnerId = db.get(`partner_${user.id}`);
    const partner = partnerId ? await message.client.users.fetch(partnerId).catch(() => null) : null;
    const badges = db.get(`badges_${user.id}`) || [];
    const inventory = db.get(`inventory_${user.id}`) || [];
    return reply(message, container(
      txt(`## 💑 Profil Relation — ${user.username}`),
      sep(),
      txt([
        `**Partenaire :** ${partner ? `${partner} (${partner.tag})` : 'Aucun'}`,
        `**Badges :** ${badges.length ? badges.join(' ') : 'Aucun'}`,
        `**Inventaire :** ${inventory.length ? inventory.map(i => `• ${i}`).join(', ') : 'Vide'}`
      ].join('\n'))
    ));
  }
};
