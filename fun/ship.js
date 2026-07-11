const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');

module.exports = {
  name: 'ship',
  aliases: ['compat'],
  description: 'Calculer la compatibilité amoureuse',
  usage: '<membre1> <membre2>',
  level: 0,
  run: async (client, message, args) => {
    const user1 = message.mentions.users.first() || message.author;
    const user2 = message.mentions.users.last();
    if (!user2 || user1.id === user2.id) return reply(message, errorContainer('Mentionnez deux personnes différentes.'));
    const percentage = Math.floor(Math.random() * 101);
    const hearts = '❤️'.repeat(Math.floor(percentage / 20));
    let label = percentage < 25 ? 'Pas d\'affinité...' : percentage < 50 ? 'Amitié possible' : percentage < 75 ? 'Belle compatibilité' : 'Match parfait !';
    return reply(message, container(
      txt('## ❤️ Compatibilité Amoureuse'),
      sep(),
      txt([`${user1} ❤️ ${user2}`, `**Score :** ${percentage}% ${hearts}`, `**Résultat :** ${label}`].join('\n'))
    ));
  }
};
