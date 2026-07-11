const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'nick',
  aliases: ['nickname', 'pseudo', 'setnick'],
  description: 'Change le pseudonyme d\'un utilisateur',
  usage: '<@membre> <nouveau_pseudo|reset>',

  run: async (client, message, args, prefix) => {
    try {
      const isSuperOwner = (client.config.superadmin?.includes(message.author.id))
        || (client.config.owners?.includes(message.author.id))
        || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;

      let hasPermission = isSuperOwner;
      if (!hasPermission) {
        message.member.roles.cache.forEach(role => {
          if (db.get(`modsp_${message.guild.id}_${role.id}`) || db.get(`admin_${message.guild.id}_${role.id}`) || db.get(`ownerp_${message.guild.id}_${role.id}`))
            hasPermission = true;
        });
      }
      if (!hasPermission) return reply(message, errorContainer('**Permission refusée.** Rôle modérateur requis.'));

      if (args.length < 2) return reply(message, container(
        txt('## ✏️ Aide — Pseudo'),
        sep(),
        txt([
          `**Modifier :** \`!nick @membre nouveau_pseudo\``,
          `**Réinitialiser :** \`!nick @membre reset\``
        ].join('\n'))
      ));

      const member = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
      if (!member) return reply(message, errorContainer('**Membre introuvable.**'));
      if (member.id === client.user.id) return reply(message, errorContainer('Je ne peux pas modifier mon propre pseudo.'));

      if (!isSuperOwner && member.roles.highest.position >= message.member.roles.highest.position)
        return reply(message, errorContainer('**Hiérarchie insuffisante.**'));
      if (member.roles.highest.position >= message.guild.members.me.roles.highest.position)
        return reply(message, errorContainer('Ma hiérarchie est trop basse pour modifier ce membre.'));

      const newNickname = args.slice(1).join(' ').replace(/<@!?\d+>/g, '').trim();
      if (!newNickname) return reply(message, errorContainer('**Pseudo requis.** Utilisez `reset` pour réinitialiser.'));
      if (newNickname.toLowerCase() !== 'reset' && newNickname.length > 32)
        return reply(message, errorContainer('**Pseudo trop long.** Maximum 32 caractères.'));

      const oldNickname = member.nickname || member.user.username;
      const isReset = newNickname.toLowerCase() === 'reset';

      await member.setNickname(isReset ? null : newNickname, `Pseudo modifié par ${message.author.tag}`);

      return reply(message, container(
        txt('## ✏️ Pseudo Modifié'),
        sep(),
        txt([
          `**Membre :** ${member.user.tag}`,
          `**Ancien pseudo :** ${oldNickname}`,
          `**Nouveau pseudo :** ${isReset ? member.user.username + ' *(réinitialisé)*' : newNickname}`
        ].join('\n'))
      ));
    } catch (err) {
      console.error('[nick]', err);
      if (err.code === 50013) return reply(message, errorContainer('Permission manquante pour modifier les pseudos.'));
      reply(message, errorContainer('Une erreur est survenue.'));
    }
  }
};
