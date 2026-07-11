const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
    name: 'clear',
    aliases: ['purge', 'clean', 'delete'],
    description: 'Supprimer des messages',
    usage: '<nombre> [membre]',
    level: 4,

    run: async (client, message, args) => {
        try {
            if (!hasPermissionLevel(client, message, 4))
                return message.reply({ components: [errorContainer('**Accès Refusé** — Niveau 4 requis.')], flags: FLAGS });
            if (!message.guild.members.me.permissions.has('ManageMessages'))
                return message.reply({ components: [errorContainer('Je n\'ai pas la permission de gérer les messages.')], flags: FLAGS });

            const amount = parseInt(args[0]);
            if (isNaN(amount) || amount < 1 || amount > 100)
                return message.reply({ components: [errorContainer('**Nombre invalide.** Choisissez entre 1 et 100.')], flags: FLAGS });

            const target = message.mentions.members.first();
            const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
            let deleted;

            if (target) {
                const messages = await message.channel.messages.fetch({ limit: 100 });
                const userMessages = messages.filter(m => m.author.id === target.id && (Date.now() - m.createdTimestamp) < TWO_WEEKS);
                if (userMessages.size === 0)
                    return message.reply({ components: [errorContainer('Aucun message récent de cet utilisateur (moins de 14 jours).')], flags: FLAGS });
                deleted = await message.channel.bulkDelete(Array.from(userMessages.values()).slice(0, amount), true);
            } else {
                const fetched = await message.channel.messages.fetch({ limit: Math.min(amount + 1, 100) });
                const deletable = fetched.filter(m => (Date.now() - m.createdTimestamp) < TWO_WEEKS);
                if (deletable.size === 0)
                    return message.reply({ components: [errorContainer('Aucun message récent à supprimer (moins de 14 jours).')], flags: FLAGS });
                deleted = await message.channel.bulkDelete(Array.from(deletable.values()).slice(0, amount + 1), true);
            }

            const count = (deleted?.size || 0) - (target ? 0 : 1);
            const confirmMsg = await message.channel.send({
                components: [container(
                    txt('## 🗑️ Messages Supprimés'),
                    sep(),
                    txt(target ? `**${count}** message(s) de **${target.user.tag}** supprimés.` : `**${count}** message(s) supprimés dans ${message.channel}.`)
                )],
                flags: FLAGS
            });
            setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);

            const logChannelId = db.get(`logchannel_${message.guild.id}`);
            if (logChannelId) {
                const logCh = message.guild.channels.cache.get(logChannelId);
                if (logCh && logCh.id !== message.channel.id)
                    await logCh.send({
                        components: [container(txt('## 🗑️ Nettoyage'), sep(), txt(`**${count}** messages supprimés dans <#${message.channel.id}> par **${message.author.tag}**${target ? ` (messages de ${target.user.tag})` : ''}.`))],
                        flags: FLAGS
                    }).catch(() => {});
            }
        } catch (err) {
            console.error('[clear]', err);
            message.reply({ components: [errorContainer('Impossible de supprimer les messages (trop anciens ou erreur).')], flags: FLAGS }).catch(() => {});
        }
    }
};
