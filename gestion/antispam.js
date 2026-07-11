const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');
const EMOJIS = require('../../utils/emojis');

module.exports = {
  name: "antispam",
  description: "Active ou désactive l'anti-spam.",
  category: "gestion",
  usage: "antispam <on/off>",
  run: async (client, message, args) => {
    if (!hasPermissionLevel(client, message, 6)) {
      return message.reply(`${EMOJIS.ERROR} Vous n'avez pas la permission.`);
    }

    const sub = args[0]?.toLowerCase();

    if (sub === "on") {
      db.set(`antispam_${message.guild.id}`, true);
      return message.reply(`${EMOJIS.SUCCESS} Anti-spam activé.`);
    }

    if (sub === "off") {
      db.delete(`antispam_${message.guild.id}`);
      return message.reply(`${EMOJIS.SUCCESS} Anti-spam désactivé.`);
    }

    const cur = db.get(`antispam_${message.guild.id}`);
    message.reply(`**Configuration Anti-spam**\nStatut: ${cur ? `${EMOJIS.ON} Actif` : `${EMOJIS.OFF} Inactif`}\nUtilisation: \`antispam on/off\``);
  }
};
