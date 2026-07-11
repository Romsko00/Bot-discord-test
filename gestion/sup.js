const Discord = require('discord.js');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'sup',
  aliases: ['delchan', 'deletechannel'],
  category: 'gestion',
  description: 'Supprime le salon où la commande est exécutée.',
  usage: '+sup',
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
    const botCanManage = me && message.channel.permissionsFor(me).has(Discord.PermissionsBitField.Flags.ManageChannels);
    if (!botCanManage) {
      return message.reply('<a:_:1483497365863399536> Je n\'ai pas la permission de gérer les salons (ManageChannels).');
    }


    if (!message.guild || !message.channel || message.channel.type === Discord.ChannelType.DM) {
      return message.reply('<a:_:1483497365863399536> Cette commande ne peut être utilisée que dans un salon de serveur.');
    }

    try {

      await message.channel.send('🗑️ Suppression du salon dans 3 secondes...');
      setTimeout(() => {
        message.channel.delete(`Commande ${prefix || ''}sup par ${message.author.tag}`).catch(() => { });
      }, 3000);
    } catch (e) {
      return message.reply(`<a:_:1483497365863399536> Impossible de supprimer ce salon: ${e.message || e}`);
    }
  }
};
