const Discord = require("discord.js");
const { hasPermissionLevel } = require('../../utils/permissionUtils');

module.exports = {
    name: "syncsalon",
    description: "Synchronise les permissions du salon avec sa catégorie parente",
    category: "gestion",
    run: async (client, message, args) => {
        if (!hasPermissionLevel(client, message, 6)) {
            return message.reply("<a:_:1483497365863399536> Vous n'avez pas la permission (niveau 6 requis) de gérer les salons.");
        }

        if (!message.channel.parent) {
            return message.reply("<a:_:1483497365863399536> Ce salon n'appartient à aucune catégorie.");
        }

        try {
            await message.channel.lockPermissions();
            message.reply("<a:_:1483497369315315786> Les permissions du salon ont été synchronisées avec la catégorie.");
        } catch (e) {
            console.error(e);
            message.reply("<a:_:1483497365863399536> Une erreur est survenue (Manque de permissions ?).");
        }
    }
};
