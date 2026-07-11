const { EmbedBuilder } = require("discord.js");
const { LogSystem } = require("../../utils/logSystem");

module.exports = async (client, oldMessage, newMessage) => {
    try {
        if (oldMessage?.partial) {
            try { oldMessage = await oldMessage.fetch(); } catch (_) {}
        }
        if (newMessage?.partial) {
            try { newMessage = await newMessage.fetch(); } catch (_) {}
        }

        const guild = oldMessage?.guild || newMessage?.guild;
        if (!guild) return;

        const author = oldMessage?.author || newMessage?.author;
        if (author?.bot) return;

        const before = oldMessage?.content ?? '';
        const after = newMessage?.content ?? '';
        if (before === after) return;

        const channelId = oldMessage?.channelId || newMessage?.channelId;
        const beforeShort = (before || '').slice(0, 500);
        const afterShort = (after || '').slice(0, 500);

        const desc = [
            `**Message modifié**`,
            `Auteur : ${author} (${author.id})`,
            `Salon : <#${channelId}>`,
            `Avant : ${beforeShort || '—'}`,
            `Après : ${afterShort || '—'}`
        ].join('\n');

        const embed = new EmbedBuilder()
            .setColor(0xf39c12)
            .setDescription(desc)
            .setFooter({ text: LogSystem.logTimestamp() });

        const result = await LogSystem.sendEventLog(guild, 'MESSAGE', embed);
        if (!result) {
            console.warn('[messageUpdate] Salon de logs non configuré pour MESSAGE');
        }
    } catch (e) {
        console.error('Erreur messageUpdate:', e);
    }
}