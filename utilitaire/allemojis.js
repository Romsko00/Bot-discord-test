const Discord = require("discord.js");

module.exports = {
    name: "allemojis",
    description: "Affiche tous les emojis du serveur",
    category: "utilitaire",
    run: async (client, message, args) => {
        await message.guild.emojis.fetch();
        const emojis = message.guild.emojis.cache;
        if (emojis.size === 0) return message.reply("Aucun emoji sur ce serveur.");

        const chunks = [];
        let currentChunk = "";

        emojis.forEach(e => {
            if ((currentChunk + e.toString()).length > 2000) {
                chunks.push(currentChunk);
                currentChunk = "";
            }
            currentChunk += e.toString() + " ";
        });
        if (currentChunk) chunks.push(currentChunk);

        for (const chunk of chunks) {
            await message.channel.send(chunk);
        }
    }
};
