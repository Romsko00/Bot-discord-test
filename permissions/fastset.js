const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { isBotOwner, setRolePermissionLevel, setUserPermissionLevel } = require('../../utils/permissionUtils');

module.exports = {
  name: 'fastset',
  description: 'Attribue rapidement un niveau de permission à un utilisateur ou un rôle',
  category: 'permissions',
  usage: '<@user/@role> <niveau_debut> <niveau_fin>',
  level: 7,
  run: async (client, message, args) => {
    if (!isBotOwner(client, message)) return reply(message, errorContainer('**Permission insuffisante** — Bot Owner requis.'));
    if (args.length < 3) return reply(message, errorContainer('**Usage :** `!fastset <@user/@role> <niveau_debut> <niveau_fin>`'));
    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
    if (!target) return reply(message, errorContainer('**Cible introuvable.**'));
    const start = parseInt(args[1]), end = parseInt(args[2]);
    if (isNaN(start) || isNaN(end) || start < 1 || end > 9 || start > end) return reply(message, errorContainer('Niveaux invalides (1-9, début ≤ fin).'));
    try {
      if (target.user) { setUserPermissionLevel(message.guild.id, target.id, end); return reply(message, container(txt('## ✅ Permission Définie'), sep(), txt([`**Utilisateur :** ${target.user.tag}`, `**Niveau :** ${end} (plage ${start}–${end})`].join('\n')))); }
      else { setRolePermissionLevel(message.guild.id, target.id, end); return reply(message, container(txt('## ✅ Permission Définie'), sep(), txt([`**Rôle :** ${target.name}`, `**Niveau :** ${end} (plage ${start}–${end})`].join('\n')))); }
    } catch (error) { return reply(message, errorContainer(`Erreur : ${error.message}`)); }
  }
};
