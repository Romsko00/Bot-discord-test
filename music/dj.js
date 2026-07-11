const { PermissionFlagsBits } = require('discord.js');
const db = require('../../utils/simpledb');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
    name: 'dj',
    aliases: ['djrole'],
    description: 'Gère le rôle DJ pour contrôler la musique',
    usage: '+dj <set|remove|info> [role]',
    category: 'music',
    run: async (client, message, args) => {
        try {
            if (!hasPermissionLevel(client, message, 6)) {
                return message.reply({ content: '<a:_:1483497365863399536> Vous devez avoir le niveau 6 (admin) pour configurer le rôle DJ.', allowedMentions: { repliedUser: false } });
            }

            const action = (args[0] || '').toLowerCase();
            const guildId = message.guild.id;
            const key = `dj_role_${guildId}`;

            if (action === 'info' || !action) {
                const roleId = db.get(key);
                const role = roleId ? message.guild.roles.cache.get(roleId) : null;

                return message.channel.send({
                    components: [container(
                        txt('## 🎧 Configuration DJ'),
                        sep(),
                        txt(role
                            ? `**Rôle DJ actuel :** ${role} (\`${role.name}\`)`
                            : 'Aucun rôle DJ configuré. Tout le monde peut contrôler la musique.\n*Utilisez `+dj set @role` pour configurer.*'
                        )
                    )],
                    flags: FLAGS
                });
            }

            if (action === 'set' || action === 'add') {
                const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
                if (!role) {
                    return message.reply({ content: '<a:_:1483497365863399536> Merci de mentionner un rôle ou de donner son ID.', allowedMentions: { repliedUser: false } });
                }
                db.set(key, role.id);

                return message.channel.send({
                    components: [container(
                        txt('## ✅ Rôle DJ Configuré'),
                        sep(),
                        txt(`**Rôle DJ :** ${role}\nSeuls les membres avec ce rôle (et les admins) pourront contrôler la musique.`)
                    )],
                    flags: FLAGS
                });
            }

            if (action === 'remove' || action === 'delete' || action === 'disable') {
                db.delete(key);
                return message.channel.send({
                    components: [container(
                        txt('## ✅ Rôle DJ Supprimé'),
                        sep(),
                        txt('Tout le monde peut maintenant contrôler la musique.')
                    )],
                    flags: FLAGS
                });
            }

        } catch (error) {
            console.error('[DJ] Erreur:', error);
            return message.reply({ content: '<a:_:1483497365863399536> Une erreur est survenue.', allowedMentions: { repliedUser: false } });
        }
    }
};
