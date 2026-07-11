const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');
const ms = require('ms');

module.exports = {
    name: 'mute',
    aliases: ['silence'],
    description: 'Rendre un membre muet temporairement',
    usage: '<membre> <durée> [raison]',

    run: async (client, message, args) => {
        try {
            if (!hasPermissionLevel(client, message, 5))
                return reply(message, errorContainer('**Permission refusée** — Niveau 5 requis.'));
            if (!message.guild.members.me.permissions.has('ModerateMembers'))
                return reply(message, errorContainer('Je n\'ai pas la permission de mute.'));

            const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
            if (!target) return reply(message, errorContainer('**Membre introuvable.**'));
            if (target.id === message.author.id) return reply(message, errorContainer('Vous ne pouvez pas vous mute vous-même.'));
            if (target.id === client.user.id) return reply(message, errorContainer('Je ne peux pas me mute moi-même.'));
            if (target.roles.highest.position >= message.member.roles.highest.position) return reply(message, errorContainer('**Hiérarchie insuffisante.**'));
            if (!target.moderatable) return reply(message, errorContainer('Je ne peux pas mute ce membre.'));
            if (!args[1]) return reply(message, errorContainer('**Durée requise.** Exemple : `10m`, `1h`, `1d`'));

            const duration = ms(args[1]);
            if (!duration || duration > ms('28d'))
                return reply(message, errorContainer('**Durée invalide** ou supérieure à 28 jours.'));

            const reason = args.slice(2).join(' ') || 'Aucune raison spécifiée';
            const durationStr = args[1];

            try {
                await target.send({
                    components: [container(txt('## 🔇 Vous avez été mis en sourdine'), sep(), txt(`**Serveur :** ${message.guild.name}\n**Durée :** ${durationStr}\n**Raison :** ${reason}\n**Modérateur :** ${message.author.tag}`))],
                    flags: FLAGS
                });
            } catch {}

            await target.timeout(duration, `${message.author.tag} : ${reason}`);

            const sent = await reply(message, container(
                txt('## 🔇 Membre Mis en Sourdine'),
                sep(),
                txt([
                    `**Utilisateur :** ${target.user.tag} (\`${target.id}\`)`,
                    `**Durée :** ${durationStr}`,
                    `**Modérateur :** ${message.author.tag}`,
                    `**Raison :** ${reason}`
                ].join('\n'))
            ));
            setTimeout(() => sent?.delete?.().catch(() => {}), 6000);

            const logChannelId = db.get(`logchannel_${message.guild.id}`);
            if (logChannelId) {
                const logCh = message.guild.channels.cache.get(logChannelId);
                if (logCh) await logCh.send({
                    components: [container(txt('## 🔇 Mute'), sep(), txt(`**Cible :** ${target.user.tag} (\`${target.id}\`)\n**Durée :** ${durationStr}\n**Modérateur :** ${message.author.tag}\n**Raison :** ${reason}`))],
                    flags: FLAGS
                }).catch(() => {});
            }
        } catch (err) {
            console.error('[mute]', err);
            reply(message, errorContainer('Une erreur est survenue lors du mute.'));
        }
    }
};
