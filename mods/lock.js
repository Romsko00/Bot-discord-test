const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');

module.exports = {
  name: 'lock',
  aliases: ['verrouiller'],
  description: 'Verrouiller un salon',
  usage: '[salon]',
  level: 4,

  run: async (client, message, args) => {
    try {
      if (!hasPermissionLevel(client, message, 6))
        return reply(message, errorContainer('**Accès Refusé** — Niveau 6 requis.'));

      const channel = message.mentions.channels.first()
        || message.guild.channels.cache.get(args[0])
        || message.channel;

      if (!channel.permissionsFor(message.guild.members.me).has('ManageChannels'))
        return reply(message, errorContainer('Je n\'ai pas la permission de gérer ce salon.'));

      await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });

      return reply(message, container(
        txt('## 🔒 Salon Verrouillé'),
        sep(),
        txt(`Le salon ${channel} est maintenant **verrouillé**.\nUtilisez \`!unlock\` pour le déverrouiller.`)
      ));
    } catch (err) {
      console.error('[lock]', err);
      reply(message, errorContainer('Une erreur est survenue.'));
    }
  }
};
