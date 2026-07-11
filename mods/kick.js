const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
    name: 'kick',
    aliases: ['expulser'],
    description: 'Expulser un membre du serveur',
    usage: '<membre> [raison]',

    run: async (client, message, args) => {
        try {
            if (!hasPermissionLevel(client, message, 5))
                return reply(message, errorContainer('**Permission refusée** — Niveau 5 requis.'));
            if (!message.guild.members.me.permissions.has('KickMembers'))
                return reply(message, errorContainer('Je n\'ai pas la permission d\'expulser.'));

            const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
            if (!target) return reply(message, errorContainer('**Membre introuvable.**'));
            if (target.id === message.author.id) return reply(message, errorContainer('Vous ne pouvez pas vous expulser vous-même.'));
            if (target.id === client.user.id) return reply(message, errorContainer('Je ne peux pas m\'expulser moi-même.'));
            if (target.roles.highest.position >= message.member.roles.highest.position) return reply(message, errorContainer('**Hiérarchie insuffisante.**'));
            if (!target.kickable) return reply(message, errorContainer('Je ne peux pas expulser ce membre.'));

            const reason = args.slice(1).join(' ') || 'Aucune raison spécifiée';

            try {
                await target.send({
                    components: [container(txt('## 👢 Vous avez été expulsé'), sep(), txt(`**Serveur :** ${message.guild.name}\n**Raison :** ${reason}\n**Modérateur :** ${message.author.tag}`))],
                    flags: FLAGS
                });
            } catch {}

            await target.kick(`${message.author.tag} : ${reason}`);

            const sent = await reply(message, container(
                txt('## 👢 Membre Expulsé'),
                sep(),
                txt([
                    `**Utilisateur :** ${target.user.tag} (\`${target.id}\`)`,
                    `**Modérateur :** ${message.author.tag}`,
                    `**Raison :** ${reason}`
                ].join('\n'))
            ));
            setTimeout(() => sent?.delete?.().catch(() => {}), 6000);

            const logChannelId = db.get(`logchannel_${message.guild.id}`);
            if (logChannelId) {
                const logCh = message.guild.channels.cache.get(logChannelId);
                if (logCh) await logCh.send({
                    components: [container(txt('## 👢 Expulsion'), sep(), txt(`**Cible :** ${target.user.tag} (\`${target.id}\`)\n**Modérateur :** ${message.author.tag}\n**Raison :** ${reason}`))],
                    flags: FLAGS
                }).catch(() => {});
            }
        } catch (err) {
            console.error('[kick]', err);
            reply(message, errorContainer('Une erreur est survenue lors de l\'expulsion.'));
        }
    }
};
