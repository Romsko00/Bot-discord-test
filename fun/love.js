const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { searchGif } = require('../../utils/giphy');

module.exports = {
  name: 'love',
  aliases: ['shippercent'],
  description: 'Test de compatibilité amoureuse avec GIF',
  run: async (client, message) => {
    const users = message.mentions.users;
    const u1 = users.at(0);
    const u2 = users.at(1);
    if (!u1 || !u2) return reply(message, errorContainer('Tu dois mentionner deux utilisateurs.'));
    const percent = Math.floor(Math.random() * 101);
    let term = percent >= 80 ? 'romantic love anime' : percent >= 50 ? 'cute heart anime' : 'funny breakup fail';
    const gif = await searchGif(term).catch(() => null);
    const components = [container(
      txt('## ❤️ Test de Compatibilité'),
      sep(),
      txt([`${u1} ❤ ${u2}`, `**Taux d'amour :** ${percent}%`].join('\n'))
    )];
    if (gif) components.push({ type: 12, items: [{ media: { url: gif } }] });
    return reply(message, container(
      txt('## ❤️ Test de Compatibilité'),
      sep(),
      txt([`${u1} ❤ ${u2}`, `**Taux d'amour :** ${percent}%`].join('\n'))
    ));
  }
};
