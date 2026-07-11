const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { isBotOwner } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'changeall',
  description: 'Change toutes les commandes d\'un niveau vers un autre',
  category: 'permissions',
  usage: '<ancien_niveau> <nouveau_niveau>',
  level: 7,
  run: async (client, message, args) => {
    if (!isBotOwner(client, message)) return reply(message, errorContainer('**Permission insuffisante** — Bot Owner requis.'));
    if (args.length < 2) return reply(message, errorContainer('**Usage :** `!changeall <ancien_niveau> <nouveau_niveau>`'));
    const oldLevel = parseInt(args[0]), newLevel = parseInt(args[1]);
    if (isNaN(oldLevel) || isNaN(newLevel)) return reply(message, errorContainer('**Niveaux invalides.**'));
    let count = 0;
    client.commands.forEach(cmd => {
      const dbLevel = db.get(`perm_req_${message.guild.id}_${cmd.name}`);
      const defaultLevel = cmd.level ?? cmd.requiredLevel ?? cmd.permissionLevel ?? 0;
      const currentLevel = (dbLevel !== null && dbLevel !== undefined) ? dbLevel : defaultLevel;
      if (currentLevel === oldLevel) { db.set(`perm_req_${message.guild.id}_${cmd.name}`, newLevel); count++; }
    });
    return reply(message, container(
      txt('## ✅ Permissions Modifiées'),
      sep(),
      txt([`**${count}** commandes déplacées du niveau **${oldLevel}** → **${newLevel}**.`].join('\n'))
    ));
  }
};
