const { ChannelType, PermissionsBitField } = require('discord.js');
const db = require('../../utils/simpledb');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'hideall',
  aliases: ['cachertout'],
  description: 'Cache tous les salons',
  category: 'gestion',
  run: async (client, message) => {
    const isOwner = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!isOwner) return reply(message, errorContainer("Vous n'avez pas la permission d'utiliser cette commande."));
    if (!hasPermissionLevel(client, message, 6)) return reply(message, errorContainer('Vous devez être administrateur pour utiliser cette commande.'));
    const loadMsg = await message.channel.send({ components: [container(txt('## ⏳ Masquage en cours…'), sep(), txt('Masquage de tous les salons en cours...'))], flags: FLAGS });
    try {
      const channels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText && c.permissionsFor(message.guild.roles.everyone).has(PermissionsBitField.Flags.ViewChannel));
      let successCount = 0, errorCount = 0;
      for (const [, channel] of channels) {
        try { await channel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false }); successCount++; }
        catch (e) { console.error(`Erreur salon ${channel.name}:`, e); errorCount++; }
      }
      await loadMsg.edit({ components: [container(txt('## ✅ Masquage Terminé'), sep(), txt(`• Salons masqués: **${successCount}**\n• Erreurs: **${errorCount}**`))], flags: FLAGS }).catch(()=>{});
      const logChannelId = db.get(`${message.guild.id}.modlog`);
      if (logChannelId) { const logChannel = message.guild.channels.cache.get(logChannelId); if (logChannel) logChannel.send({ components: [container(txt('## 🔒 Masquage de Tous les Salons'), sep(), txt(`**Modérateur:** ${message.author}\n**Salons masqués:** ${successCount}\n**Erreurs:** ${errorCount}`))], flags: FLAGS }).catch(()=>{}); }
    } catch (e) { console.error(e); await loadMsg.edit({ components: [errorContainer("Une erreur s'est produite.")], flags: FLAGS }).catch(()=>{}); }
  }
};
