const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');
const EMOJIS = require('../../utils/emojis');

module.exports = {
    name: "starboard",
    description: "Configure le système de starboard.",
    category: "gestion",
    usage: "starboard <set #channel | off>",
    run: async (client, message, args) => {
        if (!hasPermissionLevel(client, message, 6)) {
            return message.reply(`${EMOJIS.ERROR} Vous n'avez pas la permission.`);
        }

        const sub = args[0]?.toLowerCase();

        if (sub === "off") {
            db.delete(`starboard_channel_${message.guild.id}`);
            return message.reply(`${EMOJIS.SUCCESS} Starboard désactivé.`);
        }

        if (sub === "set") {
            const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
            if (!channel) {
                return message.reply(`${EMOJIS.WARNING} Salon introuvable.`);
            }
            db.set(`starboard_channel_${message.guild.id}`, channel.id);
            return message.reply(`${EMOJIS.SUCCESS} Starboard configuré dans ${channel}.`);
        }

        const cur = db.get(`starboard_channel_${message.guild.id}`);
        message.reply(`**Configuration Starboard**\nSalon: ${cur ? `<#${cur}>` : "Non défini"}\n\nUtilisation: \`starboard set #salon\` ou \`starboard off\``);
    }
};
