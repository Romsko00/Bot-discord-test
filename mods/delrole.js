const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'delrole',
  aliases: [],
  description: 'Retire un rôle à un utilisateur',
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
      if (args.length < 2) return reply(message, errorContainer('**Usage :** `!delrole @membre @rôle`'));

      const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
      if (!member) return reply(message, errorContainer('**Membre introuvable.**'));

      const roleArgs = args.filter(a => !a.includes(member.id));
      const role = message.mentions.roles.first()
        || message.guild.roles.cache.get(roleArgs[0])
        || message.guild.roles.cache.find(r => r.name === roleArgs.join(' '));
      if (!role) return reply(message, errorContainer(`**Rôle introuvable :** \`${roleArgs.join(' ') || 'rien'}\``));
      if (!member.roles.cache.has(role.id)) return reply(message, errorContainer(`**${member.user.tag}** n'a pas le rôle **${role.name}**.`));

      await member.roles.remove(role.id, `Rôle retiré par ${message.author.tag}`);

      return reply(message, container(
        txt('## ✅ Rôle Retiré'),
        sep(),
        txt([
          `**Membre :** ${member.user.tag}`,
          `**Rôle :** ${role.name}`,
          `**Retiré par :** ${message.author.tag}`
        ].join('\n'))
      ));
    } catch (err) {
      console.error('[delrole]', err);
      if (err.code === 50013) return reply(message, errorContainer('Permission manquante pour retirer ce rôle.'));
      reply(message, errorContainer('Une erreur est survenue.'));
    }
  }
};
