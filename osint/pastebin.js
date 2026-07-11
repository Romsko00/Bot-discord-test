const axios = require('axios');
const db = require('../../utils/simpledb');
const { checkOsintPermission } = require('../../utils/osintHelpers');
const EMOJIS = require('../../utils/emojis');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
    name: 'pastebin',
    aliases: ['paste', 'leakcheck'],
    description: 'Recherche sur Pastebin',
    run: async (client, message, args) => {
        if (!checkOsintPermission(client, message)) return;

        const cost = 5;
        const level = db.get(`guild_${message.guild.id}_level_${message.author.id}`) || 1;
        const totalCredits = (db.get(`user_credits_${message.author.id}`) || 0) + (db.get(`daily_credits_${message.author.id}`) || 0) + level * 2;

        if (totalCredits < cost) {
            return message.channel.send({
                components: [container(txt('## ❌ Crédits insuffisants'), sep(), txt(`**Coût :** ${cost} crédits\n**Vos crédits :** ${totalCredits} crédits`))],
                flags: FLAGS
            });
        }

        const query = args.join(' ');
        if (!query) return message.reply({ content: '<a:_:1483497365863399536> Veuillez spécifier une recherche (email, username, etc.).', allowedMentions: { repliedUser: false } });
        if (query.length < 3) return message.reply({ content: '<a:_:1483497365863399536> La recherche doit faire au moins 3 caractères.', allowedMentions: { repliedUser: false } });

        db.subtract(`user_credits_${message.author.id}`, cost);

        const loadingMsg = await message.channel.send({
            components: [container(txt('## 🔍 Recherche Pastebin...'), sep(), txt('Scan sur Pastebin, Ghostbin et psbdmp...'))],
            flags: FLAGS
        });

        let allResults = [];

        try {
            const response = await axios.get('https://psbdmp.ws/api/v3/search', { params: { q: query }, timeout: 15000 });
            if (response.data?.data) allResults = allResults.concat(response.data.data.map(r => ({ ...r, source: 'Pastebin' })));
        } catch {}

        try {
            const ghostRes = await axios.get(`https://ghostbin.com/search?q=${encodeURIComponent(query)}`);
            if (Array.isArray(ghostRes.data?.results)) allResults = allResults.concat(ghostRes.data.results.map(r => ({ ...r, source: 'Ghostbin' })));
        } catch {}

        try {
            const dumpzRes = await axios.get(`https://dumpz.org/api/search?q=${encodeURIComponent(query)}`);
            if (Array.isArray(dumpzRes.data?.results)) allResults = allResults.concat(dumpzRes.data.results.map(r => ({ ...r, source: 'Dumpz' })));
        } catch {}

        if (!allResults.length) {
            return loadingMsg.edit({
                components: [container(txt('## ✅ Aucun Résultat'), sep(), txt(`Aucun paste trouvé pour : **${query}**\n*Sources : Pastebin, Ghostbin, Dumpz*`))],
                flags: FLAGS
            });
        }

        const filteredResults = allResults.filter(r => !r.size || r.size < 1024 * 100);
        const lines = [];
        for (const paste of filteredResults.slice(0, 10)) {
            const date = paste.date ? new Date(paste.date).toLocaleDateString('fr-FR') : 'N/A';
            let url = paste.url || (paste.source === 'Pastebin' ? `https://pastebin.com/${paste.id}` : paste.source === 'Ghostbin' ? `https://ghostbin.com/paste/${paste.id}` : `https://dumpz.org/${paste.id}`);
            let content = '';
            try {
                if (paste.id && paste.source === 'Pastebin') { const raw = await axios.get(`https://pastebin.com/raw/${paste.id}`, { timeout: 5000 }); content = String(raw.data).substring(0, 300); }
                else if (paste.id && paste.source === 'Ghostbin') { const raw = await axios.get(`https://ghostbin.com/paste/${paste.id}/raw`, { timeout: 5000 }); content = String(raw.data).substring(0, 300); }
            } catch {}
            lines.push(`**${paste.title || 'Sans titre'}** [${paste.source}] — ${date}\nID: \`${paste.id}\` | [Voir](${url})\n${content ? `\`\`\`\n${content.replace(/`/g, '').slice(0, 200)}\n\`\`\`` : ''}`);
        }

        if (filteredResults.length > 10) {
            try { await message.author.send({ content: `Export résultats pour **${query}** :\n${filteredResults.map(p => `${p.source} | ${p.id} | ${p.title || 'Sans titre'}`).join('\n')}` }); } catch {}
        }

        await loadingMsg.edit({
            components: [container(
                txt(`## 🚨 ${filteredResults.length} résultat(s) trouvé(s)`),
                sep(),
                txt(`**Recherche :** \`${query}\` — *Sources : Pastebin, Ghostbin, Dumpz*`),
                sep(),
                txt(lines.join('\n\n').slice(0, 3500))
            )],
            flags: FLAGS
        });
    }
};
