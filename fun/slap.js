const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');

module.exports = {
  name: 'slap',
  aliases: ['gifle'],
  description: 'Gifler quelqu\'un',
  usage: '<membre>',
  level: 0,
  run: async (client, message, args) => {
    const target = message.mentions.users.first();
    if (!target) return reply(message, errorContainer('Mentionnez quelqu\'un à gifler.'));
    return reply(message, container(
      txt('## 👋 Gifle !'),
      sep(),
      txt(`${message.author} gifle ${target} ! 💥`)
    ));
  }
};
