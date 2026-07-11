const { EmbedBuilder } = require("discord.js");
const { LogSystem } = require("../../utils/logSystem");

module.exports = async (client, oldState, newState) => {
    try {
        const guild = newState.guild;
        const member = newState.member;
        const channel = newState.channel;

        if (!guild || !member) return;

        if (oldState.mute !== newState.mute) {
            const description = newState.mute
                ? `${member} s'est muté dans ${channel}`
                : `${member} s'est démuté dans ${channel}`;
            const embed = new EmbedBuilder()
                .setColor(newState.mute ? 0xff6b6b : 0x51cf66)
                .setDescription(description)
                .setFooter({ text: LogSystem.logTimestamp() });
            await LogSystem.sendEventLog(guild, 'VOICE', embed);
        }

        if (oldState.deaf !== newState.deaf) {
            const description = newState.deaf
                ? `${member} s'est assourdi dans ${channel}`
                : `${member} s'est désassourdi dans ${channel}`;
            const embed = new EmbedBuilder()
                .setColor(newState.deaf ? 0xff6b6b : 0x51cf66)
                .setDescription(description)
                .setFooter({ text: LogSystem.logTimestamp() });
            await LogSystem.sendEventLog(guild, 'VOICE', embed);
        }
    } catch (error) {
        console.error('Erreur voiceStateUpdate:', error);
    }
};
