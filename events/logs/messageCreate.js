const Discord = require("discord.js");
const { LogSystem } = require("../../utils/logSystem");

module.exports = async (client, message) => {
    try {
        // Ignorer les messages des bots
        if (message.author?.bot) return;
        
        const guild = message?.guild;
        if (!guild) return;

        // Ignorer les commandes (messages commençant par le préfixe ou la mention du bot)
        const prefix = client.config?.prefix || client.config?.DISCORD?.PREFIX || '+';
        const commandRegex = new RegExp(`^(${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|<@!?${client.user.id}>)`);
        
        if (commandRegex.test(message.content)) {
            return; // Ne pas logger les commandes
        }

        // Envoyer un log pour chaque message reçu
        const embed = new Discord.EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('📝 Message reçu')
            .setDescription(`Message de ${message.author.tag} dans <#${message.channelId}>`)
            .addFields(
                { name: '👤 Auteur', value: `${message.author.tag} (${message.author.id})`, inline: true },
                { name: '💬 Salon', value: `<#${message.channelId}>`, inline: true },
                { name: '🆔 Message ID', value: message.id, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Zoom Bot • Logs' });

        // Envoyer via le système de logs
        await LogSystem.sendEventLog(guild, 'MESSAGE', embed);
        
    } catch (e) {
        console.error('Erreur messageCreate logs:', e);
    }
}
