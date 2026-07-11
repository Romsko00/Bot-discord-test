const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'addrole',
  aliases: [],
  description: 'Ajoute un rôle à un utilisateur',
  usage: '<@membre> <@rôle>',

  run: async (client, message, args) => {
    try {
      const isSuperOwner = (client.config.superadmin?.includes(message.author.id))
        || (client.config.owners?.includes(message.author.id))
        || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;

      let hasPermission = isSuperOwner;
      if (!hasPermission) {
        message.member.roles.cache.forEach(role => {
          if (db.get(`modsp_${message.guild.id}_${role.id}`) || db.get(`ownerp_${message.guild.id}_${role.id}`) || db.get(`admin_${message.guild.id}_${role.id}`))
            hasPermission = true;
        });
      }
      if (!hasPermission) return reply(message, errorContainer('**Permission refusée.**'));

      if (args.length < 2) return reply(message, errorContainer('**Usage :** `!addrole @membre @rôle`'));

      const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
      if (!member) return reply(message, errorContainer('**Membre introuvable.**'));

      const roleArgs = args.filter(a => !a.includes(member.id));
      const role = message.mentions.roles.first()
        || message.guild.roles.cache.get(roleArgs[0])
        || message.guild.roles.cache.find(r => r.name === roleArgs.join(' '));
      if (!role) return reply(message, errorContainer(`**Rôle introuvable :** \`${roleArgs.join(' ') || 'rien'}\``));

      if (!isSuperOwner) {
        if (role.position >= message.member.roles.highest.position)
          return reply(message, errorContainer('**Hiérarchie insuffisante.** Vous ne pouvez pas ajouter un rôle égal ou supérieur au vôtre.'));

        const DANGER = ['KickMembers', 'BanMembers', 'ManageWebhooks', 'Administrator', 'ManageChannels', 'ManageGuild', 'MentionEveryone', 'ManageRoles', 'ManageMessages', 'MuteMembers', 'DeafenMembers', 'MoveMembers'];
        if (DANGER.some(p => role.permissions.has(p)))
          return reply(message, errorContainer('**Permission dangereuse.** Ce rôle contient des permissions sensibles.'));
      }

      if (member.roles.cache.has(role.id)) return reply(message, errorContainer(`**${member.user.tag}** possède déjà le rôle **${role.name}**.`));

      const limit = db.get(`limrole_${message.guild.id}_${role.id}`);
      if (typeof limit === 'number') {
        const currentCount = message.guild.members.cache.filter(m => m.roles.cache.has(role.id)).size;
        if (currentCount >= limit) return reply(message, errorContainer(`**Limite atteinte.** Le rôle **${role.name}** est limité à **${limit}** membres.`));
      }

      await member.roles.add(role.id, `Rôle ajouté par ${message.author.tag}`);

      return reply(message, container(
        txt('## ✅ Rôle Ajouté'),
        sep(),
        txt([
          `**Membre :** ${member.user.tag}`,
          `**Rôle :** ${role.name}`,
          `**Ajouté par :** ${message.author.tag}`
        ].join('\n'))
      ));
    } catch (err) {
      console.error('[addrole]', err);
      if (err.code === 50013) return reply(message, errorContainer('Permission manquante pour ajouter ce rôle.'));
      reply(message, errorContainer('Une erreur est survenue.'));
    }
  }
};
