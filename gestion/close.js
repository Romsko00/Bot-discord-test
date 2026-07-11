const db = require('../../utils/simpledb');
const { logTicketTranscript, sendTicketLog } = require('./ticket');

module.exports = {
    name: 'close',
    category: 'gestion',
    description: 'Ferme le ticket actuel',
    aliases: ['fermer'],

    run: async (client, message, args) => {
        const config = db.get(`ticket_config_${message.guild.id}`) || {};
        const types  = db.get(`ticket_types_${message.guild.id}`) || [];

        const isInTicketCategory =
            (config.categoryId && message.channel.parentId === config.categoryId) ||
            types.some(t => t.categoryId && message.channel.parentId === t.categoryId);

        if (!config.categoryId && types.every(t => !t.categoryId)) {
            return message.reply('<a:_:1483497365863399536> Système de tickets non configuré.');
        }

        if (!isInTicketCategory) {
            return message.reply('<a:close:1452687498886254747> Cette commande peut uniquement être utilisée dans un ticket.');
        }

        await message.reply('<a:close:1452687498886254747> Fermeture du ticket dans 5 secondes — génération du transcript en cours...');

        await sendTicketLog(message.guild, 'closed', message.author, {
            channel: message.channel,
            ticketName: message.channel.name
        });

        await logTicketTranscript(message.channel, message.guild, message.author);

        setTimeout(() => {
            message.channel.delete().catch(err => {
                console.error(`Erreur lors de la suppression du ticket ${message.channel.name}:`, err);
            });
        }, 5000);
    }
};
