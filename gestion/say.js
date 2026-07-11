const Discord = require('discord.js');
const db = require('../../utils/simpledb');
const { hasPermissionLevel } = require('../../utils/permissionUtils');

module.exports = {
  name: 'say',
  aliases: [],
  description: 'Fait parler le bot',
  run: async (client, message, args, prefix, color) => {

    await message.delete().catch(() => { });


    let hasPermission = false;


    for (const role of message.member.roles.cache.values()) {
      if (db.get(`admin_${message.guild.id}_${role.id}`) || db.get(`ownerp_${message.guild.id}_${role.id}`)) {
        hasPermission = true;
        break;
      }
    }


    if (
      !client.config.superadmin.includes(message.author.id) &&
      !client.config.owners.includes(message.author.id) &&
      !db.get(`ownermd_${client.user.id}_${message.author.id}`) &&
      !hasPermission) {
      return;
    }


    const toSay = args.join(" ");
    if (!toSay) return;


    const discordInviteRegex = /discord\.gg\/[a-zA-Z0-9]+|discordapp\.com\/invite\/[a-zA-Z0-9]+/gi;
    if (discordInviteRegex.test(toSay)) {
      return message.channel.send("<a:_:1483497365863399536> Les liens d'invitation Discord ne sont pas autorisés.").
        then((msg) => setTimeout(() => msg.delete().catch(() => { }), 5000));
    }


    const urlRegex = /https?:\/\/[^\s]+/gi;
    if (urlRegex.test(toSay)) {
      return message.channel.send("<a:_:1483497365863399536> Les liens ne sont pas autorisés.").
        then((msg) => setTimeout(() => msg.delete().catch(() => { }), 5000));
    }


    if ((toSay.includes("@everyone") || toSay.includes("@here")) &&
      !hasPermissionLevel(client, message, 5)) {
      return message.channel.send("<a:_:1483497365863399536> Vous n'avez pas la permission de mentionner everyone/here.").
        then((msg) => setTimeout(() => msg.delete().catch(() => { }), 5000));
    }


    try {
      await message.channel.send(toSay);
    } catch (error) {
      console.error("Erreur lors de l'envoi du message say:", error);
      message.channel.send("<a:_:1483497365863399536> Une erreur s'est produite lors de l'envoi du message.").
        then((msg) => setTimeout(() => msg.delete().catch(() => { }), 5000));
    }
  }
};
