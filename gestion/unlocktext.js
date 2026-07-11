const Discord = require("discord.js");
const { hasPermissionLevel } = require('../../utils/permissionUtils');

module.exports = {
    name: "unlocktext",
    description: "Déverrouille le salon textuel pour @everyone",
    category: "gestion",
    run: async (client, message, args) => {
        if (!hasPermissionLevel(client, message, 6)) return message.reply("<a:_:1483497365863399536> Permission insuffisante (niveau 6 requis).");

        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
            message.reply("<:_:1483497387698819185> Salon textuel déverrouillé.");
        } catch (e) {
            message.reply("<a:_:1483497365863399536> Erreur lors du déverrouillage.");
        }
    }
};
