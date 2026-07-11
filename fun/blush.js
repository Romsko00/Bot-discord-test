const { container, txt, sep, reply } = require('../../utils/v2');

module.exports = {
  name: 'blush',
  aliases: [],
  description: 'Exprime la gêne/rougeur',
  run: async (client, message) => {
    const target = message.mentions.users.first();
    const who = target ? `${target}` : `${message.author}`;
    return reply(message, container(txt('## 😳 Rougeur'), sep(), txt(`${who} rougit... 😳`)));
  }
};
