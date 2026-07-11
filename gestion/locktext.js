const Discord = require("discord.js");
const { hasPermissionLevel } = require('../../utils/permissionUtils');

module.exports = {
    name: "locktext",
    description: "Verrouille le salon textuel pour @everyone",
    category: "gestion",
    run: async (client, message, args) => {
        if (!hasPermissionLevel(client, message, 6)) return message.reply("<a:_:1483497365863399536> Permission insuffisante (niveau 6 requis).");

        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
            message.reply("<:_:1483497431135162539> Salon textuel verrouillé.");
        } catch (e) {
            message.reply("<a:_:1483497365863399536> Erreur lors du verrouillage.");
        }
    }
};
