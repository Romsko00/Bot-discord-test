const { removeRolePermissionLevel, isBotOwner } = require('../../utils/permissionUtils');
const EMOJIS = require('../../utils/emojis');
const db = require('../../utils/simpledb');

module.exports = {
    name: 'delperm',
    description: 'Supprime un niveau de permission d\'un rôle.',
    category: 'gestion',
    usage: 'delperm <@role>',
    aliases: ['delpermission'],
    run: async (client, message, args) => {
        if (!isBotOwner(client, message)) {
            return message.reply(`${EMOJIS.ERROR} Seuls les propriétaires du bot peuvent supprimer des permissions.`);
        }

        if (args.length < 1) {
            return message.reply(`${EMOJIS.WARNING} Utilisation: \`delperm @rôle\``);
        }

        const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
        if (!role) {
            return message.reply(`${EMOJIS.ERROR} Rôle introuvable.`);
        }

        const currentLevel = db.get(`permlevel_${message.guild.id}_${role.id}`);
        if (!currentLevel) {
            return message.reply(`${EMOJIS.WARNING} Ce rôle n'a pas de niveau de permission défini.`);
        }

        try {
            removeRolePermissionLevel(message.guild.id, role.id);
            await message.reply(`${EMOJIS.SUCCESS} Niveau de permission retiré du rôle **${role.name}**.`);
        } catch (error) {
            await message.reply(`${EMOJIS.ERROR} Erreur: ${error.message}`);
        }
    }
};
