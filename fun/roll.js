const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');

module.exports = {
  name: 'roll',
  aliases: ['dice', 'de'],
  description: 'Lancer un dé',
  usage: '[nombre de faces]',
  level: 0,
  run: async (client, message, args) => {
    const faces = parseInt(args[0]) || 6;
    if (faces < 2 || faces > 100) return reply(message, errorContainer('Le dé doit avoir entre 2 et 100 faces.'));
    const result = Math.floor(Math.random() * faces) + 1;
    return reply(message, container(
      txt('## 🎲 Lancer de Dé'),
      sep(),
      txt([`**Dé :** D${faces}`, `**Résultat :** ${result}`].join('\n'))
    ));
  }
};
