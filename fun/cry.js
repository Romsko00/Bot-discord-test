const { container, txt, sep, reply } = require('../../utils/v2');

module.exports = {
  name: 'cry',
  aliases: [],
  description: 'Exprime les pleurs',
  run: async (client, message) => {
    return reply(message, container(txt('## 😭 Pleurs'), sep(), txt(`${message.author} pleure... 😭`)));
  }
};
