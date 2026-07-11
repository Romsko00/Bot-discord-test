const Discord = require("discord.js");

module.exports = {
    name: "unlockall",
    description: "Déverrouille tous les salons",
    category: "gestion",
    run: async (client, message, args) => {
        if (!client.config.owners.includes(message.author.id) && message.author.id !== message.guild.ownerId) return message.reply("<a:_:1483497365863399536> Permission insuffisante.");

        const msg = await message.reply("<:_:1483497387698819185> Déverrouillage de tous les salons en cours...");
        const channels = message.guild.channels.cache.filter(c => c.manageable);
        const everyone = message.guild.roles.everyone;

        let count = 0;
        for (const [id, channel] of channels) {
            try {
                if (channel.isTextBased()) await channel.permissionOverwrites.edit(everyone, { SendMessages: null });
                if (channel.isVoiceBased()) await channel.permissionOverwrites.edit(everyone, { Connect: null });
                count++;
            } catch (e) { }
        }

        msg.edit(`<:_:1483497387698819185> **${count}** salons déverrouillés.`);
    }
};
