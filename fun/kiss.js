const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');

module.exports = {
  name: 'kiss',
  aliases: ['bisou'],
  description: 'Embrasser quelqu\'un',
  usage: '<membre>',
  level: 0,
  run: async (client, message, args) => {
    const target = message.mentions.users.first();
    if (!target) return reply(message, errorContainer('Mentionnez quelqu\'un à embrasser.'));
    return reply(message, container(
      txt('## 💋 Bisou'),
      sep(),
      txt(`${message.author} embrasse ${target} ! 💋`)
    ));
  }
};
