const { PermissionsBitField } = require('discord.js');
const db = require('../../utils/simpledb');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'hide',
  aliases: ['cacher'],
  description: 'Cache un salon',
  level: 3,
  category: 'gestion',
  run: async (client, message, args) => {
    if (!hasPermissionLevel(client, message, 2)) return reply(message, errorContainer("Vous n'avez pas la permission d'utiliser cette commande."));
    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels)) return reply(message, errorContainer("Je n'ai pas la permission de gérer les salons."));
    const targetChannel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]) || message.channel;
    if (!targetChannel) return reply(message, errorContainer('Salon introuvable.'));
    if (!targetChannel.permissionsFor(message.guild.roles.everyone).has(PermissionsBitField.Flags.ViewChannel)) return reply(message, errorContainer('Ce salon est déjà caché.'));
    try {
      await targetChannel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false });
      reply(message, container(txt('## ✅ Salon Caché'), sep(), txt(`Le salon ${targetChannel} a été caché avec succès.`)));
      const logChannelId = db.get(`${message.guild.id}.modlog`);
      if (logChannelId) { const logChannel = message.guild.channels.cache.get(logChannelId); if (logChannel) logChannel.send({ components: [container(txt('## 🔒 Salon Caché'), sep(), txt(`**Salon:** ${targetChannel}\n**Modérateur:** ${message.author}`))], flags: FLAGS }).catch(()=>{}); }
    } catch (e) { console.error(e); reply(message, errorContainer("Une erreur s'est produite lors du masquage du salon.")); }
  }
};
