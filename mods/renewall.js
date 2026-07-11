const renewCommand = require('./renew');

module.exports = {
  name: 'renewall',
  aliases: ['nukeall'],
  description: 'Recrée tous les salons du serveur (DANGER)',
  usage: '',

  run: async (client, message, args, prefix, color) => {
    const newArgs = ['all', ...args];
    await renewCommand.run(client, message, newArgs, prefix, color);
  }
};
