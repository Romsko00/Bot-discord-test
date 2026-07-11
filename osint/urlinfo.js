const axios = require('axios');
const db = require('../../utils/simpledb');
const { checkOsintPermission } = require('../../utils/osintHelpers');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

const COST = 5;
const TIMEOUT = 15000;

function isValidUrl(str) {
    try {
        const url = new URL(str.startsWith('http') ? str : `https://${str}`);
        return url.hostname && url.hostname.includes('.');
    } catch { return false; }
}

module.exports = {
    name: 'urlinfo',
    aliases: ['url', 'urlinspect', 'urlcheck'],
    description: 'Analyse une URL (domaine, redirections, sécurité, historique)',
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

        const urlInput = (args[0] || '').trim();
        if (!urlInput) return message.reply({ content: `**Utilisation :** \`${prefix}urlinfo <url>\``, allowedMentions: { repliedUser: false } });

        const url = urlInput.startsWith('http') ? urlInput : `https://${urlInput}`;
        if (!isValidUrl(url)) return message.reply({ content: 'URL invalide.', allowedMentions: { repliedUser: false } });

        db.subtract(`user_credits_${message.author.id}`, COST);

        const loading = await message.channel.send({
            components: [container(txt('## 🔍 Analyse de l\'URL...'), sep(), txt(`Analyse de \`${url}\`...`))],
            flags: FLAGS
        });

        let out = `**URL :** \`${url}\`\n\n`;

        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;
            out += `**Domaine :** ${domain}\n**Protocole :** ${urlObj.protocol}\n**Chemin :** ${urlObj.pathname || '/'}\n\n`;

            try {
                const res = await axios.head(url, {
                    timeout: TIMEOUT, maxRedirects: 5, validateStatus: () => true,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                out += `**Statut HTTP :** ${res.status} ${res.statusText || ''}\n`;
                if (res.headers['location']) out += `**Redirection :** ${res.headers['location']}\n`;
                if (res.headers['server']) out += `**Serveur :** ${res.headers['server']}\n`;
                if (res.headers['x-powered-by']) out += `**Powered by :** ${res.headers['x-powered-by']}\n`;
                out += '\n';
            } catch { out += '**Statut HTTP :** Erreur de connexion\n\n'; }

            if (process.env.URLSCAN_API_KEY) {
                try {
                    const scanRes = await axios.get('https://urlscan.io/api/v1/search/', {
                        params: { q: `domain:${domain}` },
                        headers: { 'API-Key': process.env.URLSCAN_API_KEY },
                        timeout: TIMEOUT
                    });
                    const results = scanRes.data?.results || [];
                    if (results.length) {
                        out += '**urlscan.io (scans récents)**\n';
                        results.slice(0, 5).forEach((r, i) => { out += `${i + 1}. ${r.page?.url || 'N/A'} | ${r.task?.visibility || ''}\n`; });
                        out += '\n';
                    }
                } catch {}
            }

            const lookupSources = require('../../utils/lookupSources');
            const domainInfo = await lookupSources.runAllLookups(domain, 'domain');
            (domainInfo.sections || []).forEach((s) => {
                const content = (s.contentPages || [])[0] || '';
                if (content && !content.includes('indisponible')) out += `**${s.name}**\n${content.slice(0, 500)}\n\n`;
            });

            await loading.edit({
                components: [container(txt('## 🔗 URL Info'), sep(), txt(out.slice(0, 3800)))],
                flags: FLAGS
            });
        } catch (err) {
            console.error('[URLINFO]', err);
            await loading.edit({ components: [container(txt('## ❌ Erreur'), sep(), txt('Erreur lors de l\'analyse.'))], flags: FLAGS }).catch(() => {});
        }
    }
};
