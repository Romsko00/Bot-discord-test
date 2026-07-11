const Discord = require("discord.js");

module.exports = {
    name: "voice",
    description: "Restreint la catégorie ou le salon à un rôle spécifique (Whitelist)",
    category: "gestion",
    usage: "voice <role>",
    run: async (client, message, args) => {
        if (!hasPermissionLevel(client, message, 6)) return message.reply("<a:_:1483497365863399536> Permission insuffisante (niveau 6 requis).");

        const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
        if (!role) return message.reply("<a:_:1483497365863399536> Précisez un rôle.");

        // Cible : Catégorie parente si existe, sinon salon actuel
        const target = message.channel.parent || message.channel;
        const typeName = target instanceof Discord.CategoryChannel ? "la catégorie" : "le salon";

        try {
            // Deny everyone, Allow role
            await target.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false, Connect: false });
            await target.permissionOverwrites.edit(role, { ViewChannel: true, Connect: true });

            // Si c'est une catégorie, on peut vouloir synchroniser les enfants ?
            // Par défaut Discord gère l'héritage sauf si overwrites spécifiques.

            message.reply(`<a:_:1483497369315315786> ${typeName} **${target.name}** est maintenant réservé au rôle **${role.name}**.`);
        } catch (e) {
            console.error(e);
            message.reply("<a:_:1483497365863399536> Erreur lors de la modification des permissions.");
        }
    }
};
