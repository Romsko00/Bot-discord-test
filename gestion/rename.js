const { PermissionFlagsBits } = require('discord.js');
const db = require('../../utils/simpledb');

module.exports = {
    name: 'rename',
    aliases: ['renommer'],
    category: 'gestion',
    description: 'Renomme le salon ticket actuel',
    usage: 'rename <nouveau_nom>',

    run: async (client, message, args) => {
        const config = db.get(`ticket_config_${message.guild.id}`) || {};
        const types  = db.get(`ticket_types_${message.guild.id}`) || [];

        const isInTicketCategory =
            (config.categoryId && message.channel.parentId === config.categoryId) ||
            types.some(t => t.categoryId && message.channel.parentId === t.categoryId);

        if (!isInTicketCategory) {
            return message.reply('<a:close:1452687498886254747> Cette commande peut uniquement être utilisée dans un ticket.');
        }

        const isStaff = message.member.permissions.has(PermissionFlagsBits.ManageChannels);
        const isTicketStaff = config.staffRoles && message.member.roles.cache.some(r => config.staffRoles.includes(r.id));
        const isOwner = client.config.owners && client.config.owners.includes(message.author.id);
        const isSuperAdmin = client.config.superadmin && client.config.superadmin.includes(message.author.id);

        if (!isStaff && !isTicketStaff && !isOwner && !isSuperAdmin) {
            return message.reply('<a:_:1483497365863399536> Vous n\'avez pas la permission de renommer ce ticket.');
        }

        if (!args[0]) {
            return message.reply('<a:close:1452687498886254747> Veuillez spécifier le nouveau nom du ticket.');
        }

        const newName = args.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');

        if (!newName) {
            return message.reply('<a:close:1452687498886254747> Nom invalide. Utilisez uniquement des lettres, chiffres et tirets.');
        }

        try {
            const oldName = message.channel.name;
            await message.channel.setName(`ticket-${newName}`);
            message.reply(`<a:_:1483497369315315786> Ticket renommé : \`${oldName}\` ➔ \`ticket-${newName}\``);
        } catch (error) {
            console.error('Erreur lors du renommage du ticket:', error);
            message.reply('<a:_:1483497365863399536> Erreur lors du renommage. Vérifiez mes permissions.');
        }
    }
};
