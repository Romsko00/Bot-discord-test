const db = require('../../utils/simpledb');
const { checkOsintPermission } = require('../../utils/osintHelpers');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

const COST = 5;

const PLATFORMS = [
    { name: 'Instagram', url: (u) => `https://www.instagram.com/${u}/`, check: (u) => /^[a-zA-Z0-9._]+$/.test(u) && u.length <= 30 },
    { name: 'Twitter/X', url: (u) => `https://twitter.com/${u}`, check: () => true },
    { name: 'GitHub', url: (u) => `https://github.com/${u}`, check: () => true },
    { name: 'Twitch', url: (u) => `https://www.twitch.tv/${u}`, check: () => true },
    { name: 'YouTube', url: (u) => `https://www.youtube.com/@${u}`, check: () => true },
    { name: 'TikTok', url: (u) => `https://www.tiktok.com/@${u}`, check: () => true },
    { name: 'Reddit', url: (u) => `https://www.reddit.com/user/${u}`, check: () => true },
    { name: 'Steam', url: (u) => `https://steamcommunity.com/id/${u}`, check: () => true },
    { name: 'Spotify', url: (u) => `https://open.spotify.com/user/${u}`, check: () => true },
    { name: 'LinkedIn', url: (u) => `https://www.linkedin.com/in/${u}`, check: () => true }
];

module.exports = {
    name: 'socialsearch',
    aliases: ['social', 'socialcheck', 'usernamecheck'],
    description: 'Vérifie la disponibilité d\'un username sur plusieurs réseaux (liens directs)',
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
        if (!username) return message.reply({ content: `**Utilisation :** \`${prefix}socialsearch <pseudo>\``, allowedMentions: { repliedUser: false } });

        db.subtract(`user_credits_${message.author.id}`, COST);

        const loading = await message.channel.send({
            components: [container(txt('## 🔍 Recherche des profils...'), sep(), txt(`Scan pour \`${username}\`...`))],
            flags: FLAGS
        });

        const lines = PLATFORMS
            .filter(p => p.check(username))
            .map(p => `**${p.name}** — ${p.url(username)}`);

        await loading.edit({
            components: [container(
                txt(`## 🌐 Social Search : ${username}`),
                sep(),
                txt('Liens directs vers les profils possibles (à vérifier manuellement) :'),
                sep(),
                txt(lines.join('\n'))
            )],
            flags: FLAGS
        });
    }
};
