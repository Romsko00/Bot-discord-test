const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');

module.exports = {
  name: 'hug',
  aliases: ['câlin', 'calin'],
  description: 'Faire un câlin à quelqu\'un',
  usage: '<membre>',
  level: 0,
  run: async (client, message, args) => {
    const target = message.mentions.users.first();
    if (!target) return reply(message, errorContainer('Mentionnez quelqu\'un à câliner.'));
    return reply(message, container(
      txt('## 🤗 Câlin'),
      sep(),
      txt(`${message.author} fait un câlin à ${target} ! 🫂`)
    ));
  }
};
