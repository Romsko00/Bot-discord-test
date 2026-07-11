const { container, txt, sep, reply, FLAGS } = require('../../utils/v2');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, SectionBuilder, ThumbnailBuilder } = require('discord.js');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'pic',
  aliases: ['pp'],
  level: 0,
  description: "Affiche la photo de profil d'un utilisateur Discord.",
  run: async (client, message, args) => {
    let perm = false;
    message.member.roles.cache.forEach(role => {
      if (db.get(`modsp_${message.guild.id}_${role.id}`)) perm = true;
      if (db.get(`ownerp_${message.guild.id}_${role.id}`)) perm = true;
      if (db.get(`admin_${message.guild.id}_${role.id}`)) perm = true;
    });
    const allowed = (client.config.superadmin?.includes(message.author.id)) || (client.config.owners?.includes(message.author.id)) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true || perm || db.get(`channelpublic_${message.guild.id}_${message.channel.id}`) === true;
    if (!allowed) return;
    const user = message.mentions.users.first() || client.users.cache.get(args[0]) || message.author;
    const avatarUrl = user.displayAvatarURL({ dynamic: true, size: 4096 });
    await reply(message, container(txt(`## 🖼️ ${user.username}`), sep(), txt(`[Voir en taille réelle](${avatarUrl})\n${avatarUrl}`)));
  }
};
