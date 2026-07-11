const Discord = require("discord.js");
const { hasPermissionLevel } = require('../../utils/permissionUtils');

module.exports = {
  name: "topic",
  description: "Change le sujet du salon actuel",
  category: "gestion",
  run: async (client, message, args) => {
    if (!hasPermissionLevel(client, message, 6)) {
      return message.reply("<a:_:1483497365863399536> Vous n'avez pas la permission (niveau 6 requis) de gérer les salons.");
    }

    const topic = args.join(" ");
    if (!topic) return message.reply("<a:_:1483497365863399536> Précisez le nouveau sujet.");

    try {
      await message.channel.setTopic(topic);
      message.reply(`<a:_:1483497369315315786> Sujet du salon mis à jour.`);
    } catch (e) {
      message.reply("<a:_:1483497365863399536> Impossible de modifier le sujet (Manque de permissions ?)");
    }
  }
};
