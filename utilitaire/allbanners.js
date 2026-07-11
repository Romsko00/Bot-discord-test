const Discord = require("discord.js");

module.exports = {
    name: "allbanners",
    description: "Affiche les bannières des membres (échantillon)",
    category: "utilitaire",
    run: async (client, message, args) => {
        const msg = await message.reply("Chargement des bannières... (Cela peut prendre du temps)");

        // On ne peut pas fetch TOUT le serveur si gros.
        // On fetch le cache ou les 100 premiers.
        const members = await message.guild.members.fetch({ limit: 20 });

        let count = 0;
        for (const [id, member] of members) {
            if (count > 10) break;
            try {
                const user = await client.users.fetch(member.id, { force: true });
                if (user.banner) {
                    const url = user.bannerURL({ size: 1024, extension: 'png' });
                    await message.channel.send({ content: `Bannière de **${user.tag}**`, files: [url] });
                    count++;
                }
            } catch (e) { }
        }

        msg.edit(`Terminé. ${count} bannières trouvées dans l'échantillon.`);
    }
};
