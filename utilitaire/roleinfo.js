const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'roleinfo',
  aliases: ['ri', 'role'],
  description: 'Affiche les informations d\'un rôle',
  usage: '<rôle>',
  level: 0,
  run: async (client, message, args) => {
    try {
      const role = message.mentions.roles.first() ||
                   message.guild.roles.cache.get(args[0]) ||
                   message.guild.roles.cache.find(r => r.name.toLowerCase() === args.join(' ').toLowerCase());

      if (!role) {
        return message.reply({
          components: [container(txt('## ❌ Rôle Introuvable\n\nVeuillez mentionner un rôle valide.'))],
          flags: FLAGS
        });
      }

      const permissions = role.permissions.toArray().slice(0, 10).join(', ') || 'Aucune';
      const members = role.members.size;

      const lines = [
        `## ${role.name}`,
        '',
        '**Informations**',
        `• **ID :** ${role.id}`,
        `• **Couleur :** ${role.hexColor}`,
        `• **Position :** ${role.position}`,
        `• **Membres :** ${members}`,
        '',
        '**Propriétés**',
        `• **Mentionnable :** ${role.mentionable ? 'Oui' : 'Non'}`,
        `• **Affiché séparément :** ${role.hoist ? 'Oui' : 'Non'}`,
        `• **Géré :** ${role.managed ? 'Oui' : 'Non'}`,
        '',
        `**Permissions Clés**\n${permissions}`,
        '',
        `*Créé le ${role.createdAt.toLocaleDateString('fr-FR')}*`
      ];

      await message.reply({
        components: [container(txt(lines.join('\n')))],
        flags: FLAGS
      });

    } catch (error) {
      await message.reply({
        components: [container(txt('## ❌ Erreur\n\nImpossible de récupérer les informations du rôle.'))],
        flags: FLAGS
      });
    }
  }
};
