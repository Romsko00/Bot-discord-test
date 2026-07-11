const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');

const responses = ['Oui','Non','Peut-être','Certainement','Absolument pas','Je ne pense pas','C\'est probable','C\'est peu probable','Sans aucun doute','Mes sources disent non','Les perspectives sont bonnes','Ne compte pas là-dessus','Demande plus tard','Mieux vaut ne pas te le dire','Impossible de prédire','Concentre-toi et redemande','C\'est certain','C\'est décidément ainsi','Très douteux','Essaie encore'];

module.exports = {
  name: '8ball',
  aliases: ['8b', 'ball'],
  description: 'Posez une question à la boule magique',
  usage: '<question>',
  level: 0,
  run: async (client, message, args) => {
    if (!args.length) return reply(message, errorContainer('Posez une question à la boule magique.'));
    const question = args.join(' ');
    const answer = responses[Math.floor(Math.random() * responses.length)];
    return reply(message, container(
      txt('## 🎱 8-Ball'),
      sep(),
      txt(`**Question :** ${question.length > 256 ? question.slice(0, 253) + '...' : question}`),
      sep(),
      txt(`**Réponse :** ${answer}`)
    ));
  }
};
