const Discord = require("discord.js");

module.exports = {
    name: "categoryunmute",
    aliases: ["unmutecat", "unlockcategory"],
    description: "Retire les restrictions de la catégorie ou du salon (Reset @everyone)",
    category: "gestion",
    run: async (client, message, args) => {
        if (!hasPermissionLevel(client, message, 6)) return message.reply("<a:_:1483497365863399536> Permission insuffisante (niveau 6 requis).");

        const target = message.channel.parent || message.channel;
        const typeName = target instanceof Discord.CategoryChannel ? "la catégorie" : "le salon";

        try {
            // Reset everyone to null (default)
            await target.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: null, Connect: null });
            message.reply(`<:_:1483497387698819185> ${typeName} **${target.name}** a été déverrouillé (Reset permissions @everyone).`);
        } catch (e) {
            console.error(e);
            message.reply("<a:_:1483497365863399536> Erreur lors du déverrouillage.");
        }
    }
};
