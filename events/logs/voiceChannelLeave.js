const { LogSystem } = require("../../utils/logSystem");
const { EmbedBuilder } = require("discord.js");

module.exports = async (client, oldState, newState) => {
    try {
        // Vérifier si l'utilisateur a quitté un salon vocal
        if (oldState.channel && !newState.channel) {
            const member = newState.member;
            const channel = oldState.channel;
            const guild = newState.guild;

            const description = `${member} s'est déconnecté du vocal ${channel}`;
            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setDescription(description)
                .setFooter({ text: LogSystem.logTimestamp() });

            const result = await LogSystem.sendEventLog(guild, 'VOICE', embed);
            if (!result) {
                console.warn('[voiceChannelLeave] Salon de logs non configuré pour VOICE');
            }
        }
    } catch (error) {
        console.error('Erreur voiceChannelLeave:', error);
    }
};
