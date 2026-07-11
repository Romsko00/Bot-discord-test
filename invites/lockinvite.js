const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'lockinvite',
  description: 'Bloque/Débloque la création d\'invitations sur le serveur',
  category: 'invites',
  usage: '<on|off>',
  level: 6,
  run: async (client, message, args) => {
    if (!hasPermissionLevel(client, message, 6)) {
      return reply(message, errorContainer('**Permission insuffisante** — Niveau 6 requis.'));
    }
    const sub = args[0]?.toLowerCase();
    const everyoneRole = message.guild.roles.everyone;
    if (sub === 'on') {
      try {
        await everyoneRole.setPermissions(everyoneRole.permissions.remove(PermissionFlagsBits.CreateInstantInvite));
        return reply(message, container(txt('## 🔒 Invitations Verrouillées'), sep(), txt('La création d\'invitations est désactivée pour @everyone.')));
      } catch { return reply(message, errorContainer('Impossible de modifier les permissions.')); }
    } else if (sub === 'off') {
      try {
        await everyoneRole.setPermissions(everyoneRole.permissions.add(PermissionFlagsBits.CreateInstantInvite));
        return reply(message, container(txt('## 🔓 Invitations Déverrouillées'), sep(), txt('La création d\'invitations est activée pour @everyone.')));
      } catch { return reply(message, errorContainer('Impossible de modifier les permissions.')); }
    } else {
      return reply(message, errorContainer('**Usage :** `!lockinvite on` (bloquer) ou `!lockinvite off` (débloquer)'));
    }
  }
};
