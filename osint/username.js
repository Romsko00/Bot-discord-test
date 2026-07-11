const axios = require('axios');
const db = require('../../utils/simpledb');
const { checkOsintPermission } = require('../../utils/osintHelpers');
const EMOJIS = require('../../utils/emojis');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

const COST = 5;
const TIMEOUT = 12000;

module.exports = {
    name: 'username',
    aliases: ['usercheck', 'namesearch', 'socialcheck'],
    description: 'Recherche un username sur plusieurs sources (fuites, pastes, réseaux)',
    category: 'osint',
    run: async (client, message, args, prefix) => {
        if (!checkOsintPermission(client, message)) return;

        const level = db.get(`guild_${message.guild?.id}_level_${message.author.id}`) || 1;
        const totalCredits = (db.get(`user_credits_${message.author.id}`) || 0) + (db.get(`daily_credits_${message.author.id}`) || 0) + level * 2;

        if (totalCredits < COST) {
            return message.channel.send({
                components: [container(txt('## ❌ Crédits insuffisants'), sep(), txt(`**Coût :** ${COST} crédits\n**Vos crédits :** ${totalCredits} crédits`))],
                flags: FLAGS
            });
        }

        const username = (args[0] || '').trim().replace(/^@/, '');
        if (!username) return message.reply({ content: `**Utilisation :** \`${prefix}username <pseudo>\``, allowedMentions: { repliedUser: false } });

        db.subtract(`user_credits_${message.author.id}`, COST);

        const loading = await message.channel.send({
            components: [container(txt('## 🔍 Recherche du username...'), sep(), txt(`Scan de \`${username}\`...`))],
            flags: FLAGS
        });

        let out = '';

        try {
            const lookupSources = require('../../utils/lookupSources');
            const { sections } = await lookupSources.runAllLookups(username, 'username');
            sections.forEach(s => { out += `**${s.name}**\n${(s.contentPages || [])[0] || '—'}\n\n`; });

            const ghCheck = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}`, {
                timeout: TIMEOUT, headers: { 'User-Agent': 'Discord-OSINT-Bot' }
            }).then(r => r.data).catch(() => null);

            if (ghCheck?.login) {
                out += '**GitHub**\n';
                out += `Profil: ${ghCheck.html_url || 'N/A'} | Repos: ${ghCheck.public_repos ?? 'N/A'} | Followers: ${ghCheck.followers ?? 'N/A'}\n`;
                if (ghCheck.name) out += `Nom: ${ghCheck.name}\n`;
                if (ghCheck.company) out += `Company: ${ghCheck.company}\n`;
            }

            await loading.edit({
                components: [container(
                    txt(`## 👤 Username : ${username}`),
                    sep(),
                    txt((out || 'Aucun résultat.').slice(0, 3800))
                )],
                flags: FLAGS
            });
        } catch (err) {
            console.error('[USERNAME]', err);
            await loading.edit({ components: [container(txt('## ❌ Erreur'), sep(), txt('Erreur lors de la recherche.'))], flags: FLAGS }).catch(() => {});
        }
    }
};
