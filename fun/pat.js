const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');

module.exports = {
  name: 'pat',
  aliases: ['pet', 'caresse'],
  description: 'Caresser quelqu\'un',
  usage: '<membre>',
  level: 0,
  run: async (client, message, args) => {
    const target = message.mentions.users.first();
    if (!target) return reply(message, errorContainer('Mentionnez quelqu\'un à caresser.'));
    return reply(message, container(
      txt('## 🤚 Pat Pat'),
      sep(),
      txt(`${message.author} caresse ${target} ! 🥰`)
    ));
  }
};
