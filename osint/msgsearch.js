const { PermissionFlagsBits } = require('discord.js');
const db = require('../../utils/simpledb');
const { checkOsintPermission } = require('../../utils/osintHelpers');
const EMOJIS = require('../../utils/emojis');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

const COST = 10;
const MAX_FETCH = 200;
const MAX_RESULTS = 25;

module.exports = {
    name: 'msgsearch',
    aliases: ['scraper', 'searchmsg', 'messages', 'scrapemessages'],
    description: 'Recherche des messages dans ce salon par auteur ou mot-clé (scraper OSINT)',
    category: 'osint',
    run: async (client, message, args, prefix) => {
        if (!checkOsintPermission(client, message)) return;

        const guild = message.guild;
        const channel = message.channel;
        if (!guild || !channel) return message.reply({ content: '<a:_:1483497365863399536> Utilisable uniquement dans un salon.', allowedMentions: { repliedUser: false } });

        const me = channel.guild.members.me;
        if (!me?.permissionsIn(channel).has(PermissionFlagsBits.ReadMessageHistory)) {
            return message.reply({ content: '<a:_:1483497365863399536> Je n\'ai pas la permission de lire l\'historique des messages dans ce salon.', allowedMentions: { repliedUser: false } });
        }

        const level = db.get(`guild_${guild.id}_level_${message.author.id}`) || 1;
        const totalCredits = (db.get(`user_credits_${message.author.id}`) || 0) + (db.get(`daily_credits_${message.author.id}`) || 0) + level * 2;

        if (totalCredits < COST) {
            return message.channel.send({
                components: [container(txt('## ❌ Crédits insuffisants'), sep(), txt(`**Coût :** ${COST} crédits\n**Vos crédits :** ${totalCredits} crédits`))],
                flags: FLAGS
            });
        }

        let useLimit = 100;
        let restArgs = args;
        if (args.length > 0) {
            const lastArg = args[args.length - 1];
            const parsed = parseInt(lastArg, 10);
            if (!isNaN(parsed) && parsed >= 10 && parsed <= MAX_FETCH) { useLimit = parsed; restArgs = args.slice(0, -1); }
        }

        let targetUser = null;
        let keyword = null;
        const mention = message.mentions?.users?.first();
        if (mention) {
            targetUser = mention;
            keyword = restArgs.filter(a => a !== mention.id && !a.startsWith('<@')).join(' ').trim() || null;
        } else if (restArgs.length >= 1) {
            const first = restArgs[0];
            if (/^\d{17,19}$/.test(first)) { try { targetUser = await client.users.fetch(first).catch(() => null); } catch {} }
            keyword = targetUser ? restArgs.slice(1).join(' ').trim() || null : restArgs.join(' ').trim() || null;
        }

        if (!targetUser && !keyword) {
            return message.reply({
                content: `**Utilisation :** \`${prefix}msgsearch <@user|userId|mot-clé> [limite]\`\n• Par **auteur** : mentionnez l'utilisateur ou son ID.\n• Par **mot-clé** : tapez le texte à rechercher.\n• **limite** : optionnel, 10-${MAX_FETCH} (défaut 100).`,
                allowedMentions: { repliedUser: false }
            });
        }

        db.subtract(`user_credits_${message.author.id}`, COST);

        const loading = await message.channel.send({
            components: [container(txt('## 🔍 Recherche des messages...'), sep(), txt('Scan de l\'historique en cours...'))],
            flags: FLAGS
        });

        try {
            const fetched = await channel.messages.fetch({ limit: useLimit });
            let filtered = [...fetched.values()].filter(m => !m.author.bot);
            if (targetUser) filtered = filtered.filter(m => m.author.id === targetUser.id);
            if (keyword) { const k = keyword.toLowerCase(); filtered = filtered.filter(m => m.content?.toLowerCase().includes(k)); }
            filtered = filtered.slice(0, MAX_RESULTS);

            const lines = filtered.map(m => {
                const date = m.createdAt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
                const content = (m.content || '').slice(0, 120).replace(/\n/g, ' ') || '(embed/media)';
                return `**${m.author.tag}** (${date})\n${content}`;
            });

            const headerLines = [
                targetUser ? `**Auteur :** ${targetUser.tag} (\`${targetUser.id}\`)` : null,
                keyword ? `**Mot-clé :** \`${keyword}\`` : null,
                `**Salon :** #${channel.name} | **Limite :** ${useLimit} | **Trouvés :** ${filtered.length}`
            ].filter(Boolean);

            await loading.edit({
                components: [container(
                    txt('## 📋 Scraper de messages'),
                    sep(),
                    txt(headerLines.join('\n')),
                    sep(),
                    txt(lines.length ? lines.join('\n\n').slice(0, 3500) : 'Aucun message trouvé pour les critères donnés.')
                )],
                flags: FLAGS
            });
        } catch (err) {
            console.error('[MSGSEARCH]', err);
            await loading.edit({ components: [container(txt('## ❌ Erreur'), sep(), txt('Erreur lors de la recherche.'))], flags: FLAGS }).catch(() => {});
        }
    }
};
