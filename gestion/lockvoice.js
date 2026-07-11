const Discord = require("discord.js");
const { hasPermissionLevel } = require('../../utils/permissionUtils');

module.exports = {
    name: "lockvoice",
    description: "Verrouille le salon vocal pour @everyone (Empêche la connexion)",
    category: "gestion",
    run: async (client, message, args) => {
        if (!hasPermissionLevel(client, message, 6)) return message.reply("<a:_:1483497365863399536> Permission insuffisante (niveau 6 requis).");

        // Si on est dans un salon textuel mais on veut lock un vocal ?
        // On suppose que la commande est lancée DANS le salon ou que l'argument est le salon
        // Mais lockvoice dans un salon textuel n'a pas de sens.
        // On vérifie si c'est un vocal, ou si on mentionne un vocal.

        let channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
        if (!channel) {
            // Essayons de voir si l'auteur est dans un vocal
            if (message.member.voice.channel) {
                channel = message.member.voice.channel;
            } else {
                return message.reply("<a:_:1483497365863399536> Mentionnez un salon vocal ou soyez dans un salon vocal.");
            }
        }

        if (!channel.isVoiceBased()) return message.reply("<a:_:1483497365863399536> Ce n'est pas un salon vocal.");

        try {
            await channel.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: false });
            message.reply(`<:_:1483497431135162539> Salon vocal ${channel.toString()} verrouillé.`);
        } catch (e) {
            message.reply("<a:_:1483497365863399536> Erreur lors du verrouillage.");
        }
    }
};
