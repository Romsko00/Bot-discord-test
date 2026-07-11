const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');
const EMOJIS = require('../../utils/emojis');

module.exports = {
    name: "antimassmention",
    description: "Active ou désactive l'anti-mass mention.",
    category: "gestion",
    usage: "antimassmention <on/off>",
    run: async (client, message, args) => {
        if (!hasPermissionLevel(client, message, 6)) {
            return message.reply(`${EMOJIS.ERROR} Vous n'avez pas la permission.`);
        }

        const sub = args[0]?.toLowerCase();

        if (sub === "on") {
            db.set(`antimassmention_${message.guild.id}`, true);
            return message.reply(`${EMOJIS.SUCCESS} Anti-mass mention activé.`);
        }

        if (sub === "off") {
            db.delete(`antimassmention_${message.guild.id}`);
            return message.reply(`${EMOJIS.SUCCESS} Anti-mass mention désactivé.`);
        }

        const cur = db.get(`antimassmention_${message.guild.id}`);
        message.reply(`**Configuration Anti-mass mention**\nStatut: ${cur ? `${EMOJIS.ON} Actif` : `${EMOJIS.OFF} Inactif`}\nUtilisation: \`antimassmention on/off\``);
    }
};
