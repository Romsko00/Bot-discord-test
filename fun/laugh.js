const { container, txt, sep, reply } = require('../../utils/v2');

module.exports = {
  name: 'laugh',
  aliases: ['lol'],
  description: 'Exprime le rire',
  run: async (client, message) => {
    return reply(message, container(txt('## 😂 Rires'), sep(), txt(`${message.author} rigole ! 😂🤣`)));
  }
};
