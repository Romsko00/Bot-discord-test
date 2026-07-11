const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { isBotOwner, setRolePermissionLevel, setUserPermissionLevel, removeUserPermissionLevel, removeRolePermissionLevel } = require('../../utils/permissionUtils');

module.exports = {
  name: 'allset',
  aliases: ['allremove'],
  description: 'Gère les permissions globales pour un utilisateur ou un rôle',
  category: 'permissions',
  usage: '<@user|@role>',
  level: 7,
  run: async (client, message, args) => {
    if (!isBotOwner(client, message)) return reply(message, errorContainer('**Permission insuffisante** — Bot Owner requis.'));
    const commandName = message.content.split(' ')[0].slice((client.config.prefix?.length) || 1).toLowerCase();
    const isSet = commandName === 'allset';
    if (!args[0]) return reply(message, errorContainer(`**Usage :** \`!${commandName} <@user|@role>\``));
    const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
    if (!member && !role) return reply(message, errorContainer('**Utilisateur ou rôle introuvable.**'));
    try {
      if (isSet) {
        if (member) { setUserPermissionLevel(message.guild.id, member.id, 6); return reply(message, container(txt('## ✅ Permissions Accordées'), sep(), txt(`**${member.user.tag}** a reçu le niveau 6 (toutes permissions).`))); }
        if (role) { setRolePermissionLevel(message.guild.id, role.id, 6); return reply(message, container(txt('## ✅ Permissions Accordées'), sep(), txt(`Le rôle **${role.name}** a reçu le niveau 6.`))); }
      } else {
        if (member) { removeUserPermissionLevel(message.guild.id, member.id); return reply(message, container(txt('## ✅ Permissions Retirées'), sep(), txt(`Permissions retirées à **${member.user.tag}**.`))); }
        if (role) { removeRolePermissionLevel(message.guild.id, role.id); return reply(message, container(txt('## ✅ Permissions Retirées'), sep(), txt(`Permissions retirées au rôle **${role.name}**.`))); }
      }
    } catch (error) { return reply(message, errorContainer(`Erreur : ${error.message}`)); }
  }
};
