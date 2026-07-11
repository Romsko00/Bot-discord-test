const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');
const EMOJIS = require('../../utils/emojis');

module.exports = {
    name: "antibot",
    description: "Active ou désactive l'anti-bot.",
    category: "gestion",
    usage: "antibot <on/off/max>",
    run: async (client, message, args) => {
        if (!hasPermissionLevel(client, message, 6)) {
            return message.reply(`${EMOJIS.ERROR} Vous n'avez pas la permission.`);
        }

        const sub = args[0]?.toLowerCase();

        if (sub === "on") {
            db.set(`bot_${message.guild.id}`, true);
            db.set(`botsanction_${message.guild.id}`, "kick");
            return message.reply(`${EMOJIS.SUCCESS} Anti-bot activé (Sanction: Kick).`);
        }

        if (sub === "max") {
            db.set(`bot_${message.guild.id}`, true);
            db.set(`botsanction_${message.guild.id}`, "ban");
            return message.reply(`${EMOJIS.SUCCESS} Anti-bot activé au maximum (Sanction: Ban).`);
        }

        if (sub === "off") {
            db.delete(`bot_${message.guild.id}`);
            return message.reply(`${EMOJIS.SUCCESS} Anti-bot désactivé.`);
        }

        const cur = db.get(`bot_${message.guild.id}`);
        message.reply(`**Configuration Anti-bot**\nStatut: ${cur ? `${EMOJIS.ON} Actif` : `${EMOJIS.OFF} Inactif`}\nUtilisation: \`antibot on/off/max\``);
    }
};
