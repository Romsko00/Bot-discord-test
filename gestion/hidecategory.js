const Discord = require('discord.js');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'hidecategory',
  aliases: ["cachercategorie"],
  description: 'Cache une catégorie',
  run: async (client, message, args, prefix, color) => {
    if (
      !client.config.superadmin.includes(message.author.id) &&
      !client.config.owners.includes(message.author.id) &&
      db.get(`ownermd_${client.user.id}_${message.author.id}`) !== true) {
      return message.reply("<a:_:1483497365863399536> Vous n'avez pas la permission d'utiliser cette commande.");
    }

    const isSuperadmin = Array.isArray(client.config.superadmin) && client.config.superadmin.includes(message.author.id);
    if (!isSuperadmin && !hasPermissionLevel(client, message, 6)) {
      return message.reply("<a:_:1483497365863399536> Vous n'avez pas la permission de gérer les salons.");
    }

    const category = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);

    if (!category || category.type !== Discord.ChannelType.GuildCategory) {
      return message.reply("<a:_:1483497365863399536> Veuillez mentionner une catégorie valide.");
    }

    try {
      const channels = message.guild.channels.cache.filter((ch) => ch.parentId === category.id);

      let successCount = 0;
      let errorCount = 0;

      for (const [id, channel] of channels) {
        try {
          await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
            ViewChannel: false
          });
          successCount++;
        } catch (error) {
          console.error(`Erreur avec le salon ${channel.name}:`, error);
          errorCount++;
        }
      }

      message.reply(`<a:_:1483497369315315786> Catégorie **${category.name}** masquée !\n• Salons masqués: ${successCount}\n• Erreurs: ${errorCount}`);

    } catch (error) {
      console.error(error);
      message.reply("<a:_:1483497365863399536> Une erreur s'est produite lors du masquage de la catégorie.");
    }
  }
};
