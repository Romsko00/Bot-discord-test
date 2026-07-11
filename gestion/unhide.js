const { PermissionsBitField } = require('discord.js');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'unhide',
  aliases: ['montrer'],
  description: 'Montre un salon caché',
  level: 3,

  run: async (client, message, args) => {
    if (!hasPermissionLevel(client, message, 2))
      return reply(message, errorContainer('**Permission refusée** — Niveau 2 requis.'));
    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return reply(message, errorContainer('Permission `ManageChannels` manquante.'));

    const ch = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]) || message.channel;
    if (!ch) return reply(message, errorContainer('**Salon introuvable.**'));
    if (ch.permissionsFor(message.guild.roles.everyone).has(PermissionsBitField.Flags.ViewChannel))
      return reply(message, errorContainer('Ce salon est **déjà visible**.'));

    try {
      await ch.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: true });
      reply(message, container(txt('## 👁️ Salon Révélé'), sep(), txt(`**Salon :** ${ch}\n**Modérateur :** ${message.author}`)));
      const logCh = message.guild.channels.cache.get(db.get(`${message.guild.id}.modlog`));
      if (logCh) logCh.send({ components: [container(txt(`## 👁️ Salon Révélé\n**Salon :** ${ch}\n**Par :** ${message.author.tag}`))], flags: FLAGS }).catch(() => {});
    } catch (e) {
      console.error('[unhide]', e);
      reply(message, errorContainer('Une erreur s\'est produite.'));
    }
  }
};
