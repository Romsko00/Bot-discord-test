const Discord = require("discord.js");
const { hasPermissionLevel } = require('../../utils/permissionUtils');

module.exports = {
    name: "unhidetext",
    description: "Affiche le salon textuel pour @everyone",
    category: "gestion",
    run: async (client, message, args) => {
        if (!hasPermissionLevel(client, message, 6)) return message.reply("<a:_:1483497365863399536> Permission insuffisante (niveau 6 requis).");

        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: null });
            message.reply("👁️ Salon affiché.");
        } catch (e) {
            message.reply("<a:_:1483497365863399536> Erreur lors de l'affichage.");
        }
    }
};
