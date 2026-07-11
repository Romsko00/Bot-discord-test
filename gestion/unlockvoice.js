const Discord = require("discord.js");
const { hasPermissionLevel } = require('../../utils/permissionUtils');

module.exports = {
    name: "unlockvoice",
    description: "Déverrouille le salon vocal pour @everyone",
    category: "gestion",
    run: async (client, message, args) => {
        if (!hasPermissionLevel(client, message, 6)) return message.reply("<a:_:1483497365863399536> Permission insuffisante (niveau 6 requis).");

        let channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
        if (!channel) {
            if (message.member.voice.channel) {
                channel = message.member.voice.channel;
            } else {
                return message.reply("<a:_:1483497365863399536> Mentionnez un salon vocal ou soyez dans un salon vocal.");
            }
        }

        if (!channel.isVoiceBased()) return message.reply("<a:_:1483497365863399536> Ce n'est pas un salon vocal.");

        try {
            await channel.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: null });
            message.reply(`<:_:1483497387698819185> Salon vocal ${channel.toString()} déverrouillé.`);
        } catch (e) {
            message.reply("<a:_:1483497365863399536> Erreur lors du déverrouillage.");
        }
    }
};
