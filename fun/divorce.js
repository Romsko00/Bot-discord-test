const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'divorce',
  aliases: ['breakup'],
  description: "Divorce d'un mariage RP",
  run: async (client, message) => {
    const aKey = `partner_${message.author.id}`;
    const partnerId = db.get(aKey);
    if (!partnerId) return reply(message, errorContainer('Tu n\'as pas de partenaire.'));
    db.delete(aKey); db.delete(`partner_${partnerId}`);
    try {
      const ab = db.get(`badges_${message.author.id}`) || []; db.set(`badges_${message.author.id}`, ab.filter(b => b !== '💍'));
      const bb = db.get(`badges_${partnerId}`) || []; db.set(`badges_${partnerId}`, bb.filter(b => b !== '💍'));
    } catch {}
    return reply(message, container(txt('## 💔 Divorce'), sep(), txt(`${message.author} est maintenant célibataire.`)));
  }
};
