const axios = require('axios');
const db = require('../../utils/simpledb');
const { checkOsintPermission } = require('../../utils/osintHelpers');
const EMOJIS = require('../../utils/emojis');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
    name: 'breach',
    aliases: ['hibp', 'breachcheck'],
    description: 'Recherche de breaches de données',
    run: async (client, message, args) => {
        if (!checkOsintPermission(client, message)) return;

        const cost = 5;
        const level = db.get(`guild_${message.guild.id}_level_${message.author.id}`) || 1;
        const totalCredits = (db.get(`user_credits_${message.author.id}`) || 0) + (db.get(`daily_credits_${message.author.id}`) || 0) + level * 2;

        const query = args[0];
        if (!query) return message.reply({ content: '<a:_:1483497365863399536> Veuillez spécifier un email ou username.', allowedMentions: { repliedUser: false } });

        if (totalCredits < cost) {
            return message.channel.send({
                components: [container(
                    txt('## ❌ Crédits insuffisants'),
                    sep(),
                    txt(`**Coût :** ${cost} crédits\n**Vos crédits :** ${totalCredits} crédits`)
                )],
                flags: FLAGS
            });
        }
        db.subtract(`user_credits_${message.author.id}`, cost);

        const { SnusbaseAPI } = require('../../utils/snusbase');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isEmail = emailRegex.test(query);

        const loadingMsg = await message.channel.send({
            components: [container(txt('## 🔍 Recherche en cours...'), sep(), txt('Scan des bases de fuites de données...'))],
            flags: FLAGS
        });

        let hibpBreaches = [];
        let snusResults = [];

        if (isEmail) {
            try {
                const response = await axios.get(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(query)}`, {
                    headers: { 'User-Agent': 'Discord-Bot-Breach-Check', 'hibp-api-key': process.env.HIBP_API_KEY || '' },
                    timeout: 10000
                });
                hibpBreaches = response.data;
            } catch (error) {
                if (error.response?.status !== 404) console.error('HIBP error:', error);
            }
        }

        try {
            const snusbase = new SnusbaseAPI();
            const snusData = isEmail ? await snusbase.searchEmail(query) : await snusbase.searchUsername(query);
            snusResults = snusData.results || [];
        } catch (error) { console.error('Snusbase error:', error); }

        const found = hibpBreaches.length > 0 || snusResults.length > 0;
        const lines = [`**Recherche pour :** \`${query}\``, `**Sources :** HIBP, Snusbase`, ''];

        if (hibpBreaches.length > 0) {
            lines.push(`**${EMOJIS.BUG} Fuites HIBP (${hibpBreaches.length}) :**`);
            hibpBreaches.slice(0, 8).forEach(b => {
                lines.push(`• **${b.Name}** (${b.BreachDate}) — ${b.PwnCount.toLocaleString()} comptes\n  Types: ${b.DataClasses.slice(0, 3).join(', ')}`);
            });
            lines.push('');
        }

        if (snusResults.length > 0) {
            lines.push(`**${EMOJIS.BUG} Résultats Snusbase (${snusResults.length}) :**`);
            snusResults.slice(0, 5).forEach((r, i) => {
                lines.push(`**${i + 1}.** ${r.username || r.email || 'N/A'} | Hash: ${r.hash ? r.hash.substring(0, 16) + '...' : 'N/A'} | IP: ${r.lastip || 'N/A'} | Source: ${r.database || 'N/A'}`);
            });
            lines.push('');
        }

        if (found) {
            lines.push('**🛡️ Recommandations :**\n• Changez vos mots de passe\n• Activez la 2FA\n• Surveillez vos comptes');
        }

        await loadingMsg.edit({
            components: [container(
                txt(found ? '## 🚨 Fuites de données détectées' : '## ✅ Aucune fuite trouvée'),
                sep(),
                txt(lines.join('\n').slice(0, 3800))
            )],
            flags: FLAGS
        });
    }
};
