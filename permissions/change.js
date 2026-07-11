const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { isBotOwner } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'change',
  description: 'Change le niveau de permission requis pour une commande',
  category: 'permissions',
  usage: '<commande> <niveau 0-9>',
  level: 7,
  run: async (client, message, args) => {
    if (!isBotOwner(client, message)) return reply(message, errorContainer('**Permission insuffisante** — Bot Owner requis.'));
    if (args.length < 2) return reply(message, errorContainer('**Usage :** `!change <commande> <niveau>`'));
    const commandName = args[0].toLowerCase();
    const level = parseInt(args[1]);
    const command = client.commands.get(commandName) || client.aliases?.get(commandName);
    if (!command) return reply(message, errorContainer(`Commande \`${commandName}\` introuvable.`));
    if (isNaN(level) || level < 0 || level > 9) return reply(message, errorContainer('Le niveau doit être entre **0** et **9**.'));
    db.set(`perm_req_${message.guild.id}_${command.name}`, level);
    return reply(message, container(
      txt('## ✅ Permission Modifiée'),
      sep(),
      txt([`**Commande :** \`${command.name}\``, `**Nouveau niveau requis :** ${level}`].join('\n'))
    ));
  }
};
