const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { isBotOwner } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'unchange',
  description: 'Réinitialise le niveau de permission d\'une commande ou de toutes',
  category: 'permissions',
  usage: '<commande|all>',
  level: 7,
  run: async (client, message, args) => {
    if (!isBotOwner(client, message)) return reply(message, errorContainer('**Permission insuffisante** — Bot Owner requis.'));
    if (!args[0]) return reply(message, errorContainer('**Usage :** `!unchange <commande|all>`'));
    if (args[0].toLowerCase() === 'all') {
      const keys = db.all().filter(d => d.ID.startsWith(`perm_req_${message.guild.id}_`));
      keys.forEach(k => db.delete(k.ID));
      return reply(message, container(txt('## ✅ Permissions Réinitialisées'), sep(), txt(`**${keys.length}** commandes réinitialisées à leur valeur par défaut.`)));
    }
    const commandName = args[0].toLowerCase();
    const command = client.commands.get(commandName) || client.commands.get(client.aliases?.get(commandName));
    const targetName = command ? command.name : commandName;
    db.delete(`perm_req_${message.guild.id}_${targetName}`);
    return reply(message, container(txt('## ✅ Permission Réinitialisée'), sep(), txt(`**Commande :** \`${targetName}\``)));
  }
};
