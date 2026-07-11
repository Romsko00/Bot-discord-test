const Discord = require("discord.js");

module.exports = {
    name: "allpfp",
    description: "Affiche les avatars des membres (échantillon)",
    category: "utilitaire",
    run: async (client, message, args) => {
        const msg = await message.reply("Chargement des avatars...");

        const members = await message.guild.members.fetch({ limit: 10 });

        for (const [id, member] of members) {
            message.channel.send({ content: `Avatar de **${member.user.tag}**`, files: [member.user.displayAvatarURL({ size: 1024 })] });
        }

        msg.edit(`Terminé.`);
    }
};
