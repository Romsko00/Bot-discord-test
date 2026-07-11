const Discord = require('discord.js');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'suggestsetup',
  aliases: [],
  description: 'Configuration du système de suggestions',
  run: async (client, message, args, prefix, color) => {
    let perm = false;
    message.member.roles.cache.forEach((role) => {
      if (db.get(`admin_${message.guild.id}_${role.id}`)) perm = true;
      if (db.get(`ownerp_${message.guild.id}_${role.id}`)) perm = true;
    });

    if (
      !perm &&
      !client.config.superadmin.includes(message.author.id) &&
      !client.config.owners.includes(message.author.id) &&
      !db.get(`ownermd_${client.user.id}_${message.author.id}`)) {
      return message.reply('<a:_:1483497365863399536> Permission refusée.');
    }

    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
    if (!channel) {
      return message.reply('<a:_:1483497365863399536> Veuillez mentionner un salon valide.');
    }

    db.set(`suggest_channel_${message.guild.id}`, channel.id);


    if (args[1] === 'public') {
      db.set(`suggest_public_${message.guild.id}`, true);
    } else {
      db.set(`suggest_public_${message.guild.id}`, false);
    }

    message.reply(`<a:_:1483497369315315786> Salon de suggestions défini sur ${channel} | Public: ${args[1] === 'public' ? 'Oui' : 'Non'}`);
  }
};
