const Discord = require('discord.js');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'supg',
  aliases: ['delcat', 'deletecategory', 'supG'],
  category: 'gestion',
  description: 'Supprime une catégorie complète (et tous les salons dedans).',
  usage: '+supg <ID_categorie> | +supg ici',
  run: async (client, message, args, prefix, color) => {

    let perm = false;
    message.member?.roles?.cache?.forEach((role) => {
      if (db.get(`modsp_${message.guild.id}_${role.id}`)) perm = true;
      if (db.get(`admin_${message.guild.id}_${role.id}`)) perm = true;
      if (db.get(`ownerp_${message.guild.id}_${role.id}`)) perm = true;
    });

    const canUse = perm ||
      client.config.superadmin && client.config.superadmin.includes(message.author.id) ||
      client.config.owners && client.config.owners.includes(message.author.id) ||
      db.get(`ownermd_${client.user.id}_${message.author.id}`) ||
      db.get(`channelpublic_${message.guild.id}_${message.channel.id}`);

    if (!canUse) {
      return message.reply({ content: '<a:_:1483497365863399536> Vous n\'avez pas la permission d\'utiliser cette commande.' });
    }

    const me = message.guild.members.me || (await message.guild.members.fetchMe().catch(() => null));
    const botCanManage = me && message.guild.members.me.permissions.has(Discord.PermissionsBitField.Flags.ManageChannels);
    if (!botCanManage) {
      return message.reply('<a:_:1483497365863399536> Je n\'ai pas la permission de gérer les salons (ManageChannels).');
    }

    let targetId = (args[0] || '').trim();

    if (!targetId || targetId.toLowerCase() === 'ici') {
      targetId = message.channel?.parentId || '';
    }

    if (!/^\d{15,20}$/.test(targetId || '')) {
      return message.reply('<a:_:1483497365863399536> Veuillez fournir un ID de catégorie valide ou utiliser `' + prefix + 'supg ici`.');
    }

    const category = message.guild.channels.cache.get(targetId);
    if (!category || category.type !== Discord.ChannelType.GuildCategory) {
      return message.reply('<a:_:1483497365863399536> Catégorie introuvable. Assurez-vous d\'avoir fourni un ID de catégorie.');
    }

    try {
      const children = message.guild.channels.cache.
        filter((ch) => ch.parentId === category.id).
        sort((a, b) => a.rawPosition - b.rawPosition);

      const infoMsg = await message.channel.send(`🗑️ Suppression de la catégorie **${category.name}** et de ${children.size} salon(s)...`);

      let deleted = 0;
      let failed = 0;

      for (const ch of children.values()) {
        try {
          await ch.delete(`Commande ${prefix || ''}supg par ${message.author.tag}`);
          deleted++;
        } catch (e) {
          failed++;
        }
      }


      await category.delete(`Commande ${prefix || ''}supg par ${message.author.tag}`);

      await infoMsg.edit(`<a:_:1483497369315315786> Catégorie supprimée. Salons supprimés: ${deleted}${failed ? ` | Échecs: ${failed}` : ''}`);
    } catch (e) {
      return message.reply(`<a:_:1483497365863399536> Impossible de supprimer la catégorie: ${e.message || e}`);
    }
  }
};
