const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
    name: 'report',
    aliases: [],
    description: 'Système de signalement',
    usage: '<@utilisateur> <raison>',

    run: async (client, message, args) => {
        const target = message.mentions.users.first();
        const reason = args.slice(1).join(' ').trim();
        if (!target || !reason) return reply(message, errorContainer('**Usage :** `!report @utilisateur <raison>`'));

        const logContent = [
            '## 🚨 Nouveau Signalement',
            '',
            `**Signaleur :** ${message.author.tag} (\`${message.author.id}\`)`,
            `**Ciblé :** ${target.tag} (\`${target.id}\`)`,
            `**Raison :** ${reason}`,
            `**Salon :** ${message.channel}`
        ].join('\n');

        const logCh = message.guild.channels.cache.get(db.get(`logmod_${message.guild.id}`));
        if (logCh) {
            await logCh.send({ components: [container(txt(logContent))], flags: FLAGS }).catch(() => {});
            return reply(message, container(
                txt('## ✅ Signalement Envoyé'),
                sep(),
                txt('Votre signalement a été transmis aux modérateurs.')
            ));
        }

        try {
            await message.author.send({ components: [container(txt(logContent + '\n\n*Aucun salon log configuré, envoi en DM.*'))], flags: FLAGS });
            return reply(message, container(
                txt('## ✅ Signalement Envoyé (DM)'),
                sep(),
                txt('Aucun salon log configuré — envoi en DM.')
            ));
        } catch {
            return reply(message, errorContainer('Impossible d\'envoyer le signalement (aucun log configuré et DM fermé).'));
        }
    }
};
