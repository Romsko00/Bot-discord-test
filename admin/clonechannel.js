const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'clonechannel',
  aliases: ['clone', 'duplicate'],
  description: 'Clone un salon Discord avec ses paramètres',
  usage: '[#salon] [nouveau-nom]',
  category: 'admin',
  level: 5,
  run: async (client, message, args) => {
    if (!hasPermissionLevel(client, message, 4)) {
      return reply(message, errorContainer('**Permission insuffisante** — Niveau 4 requis.'));
    }

    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]) || message.channel;
    const newName = args.slice(1).join(' ') || `${channel.name}-copy`;

    const loadMsg = await reply(message, container(txt('## ⏳ Clonage en cours...'), sep(), txt(`Clonage de **#${channel.name}**...`)));

    try {
      const newChannel = await channel.clone({ name: newName, reason: `Cloné par ${message.author.tag}` });

      const c = container(
        txt('## ✅ Salon Cloné'),
        sep(),
        txt([
          `**Salon original :** ${channel}`,
          `**Nouveau salon :** ${newChannel}`,
          `**Nom :** \`${newChannel.name}\``,
          `**Effectué par :** ${message.author}`
        ].join('\n'))
      );

      const { FLAGS } = require('../../utils/v2');
      await loadMsg.edit({ components: [c], flags: FLAGS });

      const logChannelId = db.get(`logmod_${message.guild.id}`);
      if (logChannelId) {
        const logCh = message.guild.channels.cache.get(logChannelId);
        if (logCh) logCh.send({ components: [c], flags: FLAGS });
      }
    } catch (error) {
      console.error(error);
      const { FLAGS } = require('../../utils/v2');
      await loadMsg.edit({ components: [errorContainer(`**Erreur de clonage :** \`${error.message}\``)], flags: FLAGS });
    }
  }
};
