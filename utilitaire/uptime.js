const Discord = require("discord.js");
const ms = require("ms");

module.exports = {
    name: "uptime",
    description: "Affiche le temps de fonctionnement du bot",
    category: "utilitaire",
    run: async (client, message, args) => {
        message.reply(`<:_:1483497390798409789> Bot en ligne depuis : **${ms(client.uptime, { long: true })}**`);
    }
};
