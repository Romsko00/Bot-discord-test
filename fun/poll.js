const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');

module.exports = {
  name: 'poll',
  aliases: ['sondage'],
  description: 'Créer un sondage',
  usage: '<question> | <option1> | <option2> ...',
  level: 0,
  run: async (client, message, args) => {
    const input = args.join(' ').split('|').map(s => s.trim());
    if (input.length < 3) return reply(message, errorContainer('**Format invalide.** Utilisez : `question | option1 | option2`'));
    const question = input[0];
    const options = input.slice(1, 11);
    const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    const optLines = options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n');
    const msg = await reply(message, container(
      txt('## 📊 Sondage'),
      sep(),
      txt(`**${question}**\n\n${optLines}`),
      sep(),
      txt(`*Sondage de ${message.author.username}*`)
    ));
    for (let i = 0; i < options.length && i < 10; i++) {
      await msg.react(emojis[i]).catch(() => {});
    }
  }
};
