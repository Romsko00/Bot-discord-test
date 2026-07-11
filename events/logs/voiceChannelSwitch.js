const { EmbedBuilder } = require("discord.js");
const { LogSystem } = require("../../utils/logSystem");

module.exports = async (client, member, oldChannel, newChannel) => {
    try {
        const description = `${member} a changé de salon : ${oldChannel} → ${newChannel}`;
        const embed = new EmbedBuilder()
            .setColor(0xf39c12)
            .setDescription(description)
            .setFooter({ text: LogSystem.logTimestamp() });
        await LogSystem.sendEventLog(member.guild, 'VOICE', embed);
    } catch (error) {
        console.error('Erreur voiceChannelSwitch:', error);
    }
};