const { LogSystem } = require("../../utils/logSystem");
const { EmbedBuilder } = require("discord.js");

module.exports = async (client, oldState, newState) => {
    try {
        // Vérifier si l'utilisateur a rejoint un salon vocal
        if (!oldState.channel && newState.channel) {
            const member = newState.member;
            const channel = newState.channel;
            const guild = newState.guild;

            const description = `${member} s'est connecté au vocal ${channel}`;
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setDescription(description)
                .setFooter({ text: LogSystem.logTimestamp() });

            const result = await LogSystem.sendEventLog(guild, 'VOICE', embed);
            if (!result) {
                console.warn('[voiceChannelJoin] Salon de logs non configuré pour VOICE');
            }
        }
    } catch (error) {
        console.error('Erreur voiceChannelJoin:', error);
    }
};
