const { container, txt, sep, reply } = require('../../utils/v2');

module.exports = {
  name: 'coinflip',
  aliases: ['flip', 'cf', 'pile', 'face'],
  description: 'Lance une pièce',
  usage: '[pile/face]',
  level: 0,
  run: async (client, message, args) => {
    const choices = ['pile', 'face'];
    const result = choices[Math.floor(Math.random() * 2)];
    const userChoice = args[0]?.toLowerCase();
    const validChoice = choices.includes(userChoice);

    let lines = [`**Résultat :** ${result}`];
    if (validChoice) {
      const win = userChoice === result;
      lines.unshift(`**Votre choix :** ${userChoice}`);
      lines.push(win ? '✅ **Victoire !**' : '❌ **Défaite**');
    }

    return reply(message, container(txt('## 🪙 Pile ou Face'), sep(), txt(lines.join('\n'))));
  }
};
