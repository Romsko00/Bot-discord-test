const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'channelinfo',
  aliases: ['ci', 'channel'],
  description: 'Affiche les informations d\'un salon',
  usage: '[salon]',
  level: 0,
  run: async (client, message, args) => {
    try {
      const channel = message.mentions.channels.first() ||
                     message.guild.channels.cache.get(args[0]) ||
                     message.channel;

      const type = {
        0: 'Salon Textuel',
        2: 'Salon Vocal',
        4: 'Catégorie',
        5: 'Annonces',
        13: 'Stage',
        15: 'Forum'
      }[channel.type] || 'Inconnu';

      const lines = [
        `## #${channel.name}`,
        '',
        '**Informations**',
        `• **ID :** ${channel.id}`,
        `• **Type :** ${type}`,
        `• **Catégorie :** ${channel.parent?.name || 'Aucune'}`,
        `• **Position :** ${channel.position}`,
        '',
        '**Propriétés**',
        `• **NSFW :** ${channel.nsfw ? 'Oui' : 'Non'}`,
        `• **Slowmode :** ${channel.rateLimitPerUser || 0}s`,
        `• **Créé :** <t:${Math.floor(channel.createdTimestamp / 1000)}:R>`
      ];

      if (channel.topic) {
        lines.push('', `**Description**\n${channel.topic.substring(0, 500)}`);
      }

      await message.reply({
        components: [container(txt(lines.join('\n')))],
        flags: FLAGS
      });

    } catch (error) {
      await message.reply({
        components: [container(txt('## ❌ Erreur\n\nImpossible de récupérer les informations du salon.'))],
        flags: FLAGS
      });
    }
  }
};
