const axios = require('axios');
const db = require('../../utils/simpledb');
const { checkOsintPermission } = require('../../utils/osintHelpers');
const EMOJIS = require('../../utils/emojis');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

const COST = 5;
const TIMEOUT = 12000;

function detectHashType(hash) {
    if (!hash || typeof hash !== 'string') return null;
    const h = hash.trim();
    if (/^[a-fA-F0-9]{32}$/.test(h)) return 'md5';
    if (/^[a-fA-F0-9]{40}$/.test(h)) return 'sha1';
    if (/^[a-fA-F0-9]{64}$/.test(h)) return 'sha256';
    return null;
}

module.exports = {
    name: 'hashlookup',
    aliases: ['hash', 'decrypt_hash', 'hashcheck'],
    description: 'Identifie et recherche un hash (MD5, SHA1, SHA256) dans des bases de fuites',
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

        const hash = (args[0] || '').trim();
        if (!hash) return message.reply({ content: `**Utilisation :** \`${prefix}hashlookup <hash>\` (MD5, SHA1 ou SHA256).`, allowedMentions: { repliedUser: false } });

        const type = detectHashType(hash);
        if (!type) return message.reply({ content: 'Hash non reconnu. Utilisez un MD5 (32 car. hex), SHA1 (40) ou SHA256 (64).', allowedMentions: { repliedUser: false } });

        db.subtract(`user_credits_${message.author.id}`, COST);

        const loading = await message.channel.send({
            components: [container(txt('## 🔍 Recherche du hash...'), sep(), txt(`**Type détecté :** ${type.toUpperCase()}\n**Hash :** \`${hash}\``))],
            flags: FLAGS
        });

        let result = `**Type détecté :** ${type.toUpperCase()}\n**Hash :** \`${hash}\`\n\n`;

        try {
            if (type === 'md5') {
                try {
                    const res = await axios.get(`https://api.md5decrypt.net/?hash=${encodeURIComponent(hash)}`, { timeout: TIMEOUT });
                    const data = res.data || {};
                    result += data.result && data.result !== hash ? `**md5decrypt.net :** \`${data.result}\`\n` : 'md5decrypt.net : non trouvé.\n';
                } catch { result += 'md5decrypt.net : indisponible.\n'; }
            }

            if (type === 'sha1' || type === 'md5') {
                try {
                    const { SnusbaseAPI } = require('../../utils/snusbase');
                    const data = await new SnusbaseAPI().searchHash(hash);
                    const results = data?.results || [];
                    if (results.length) {
                        result += '\n**Snusbase (hash)**\n';
                        results.slice(0, 10).forEach((r, i) => {
                            result += `${i + 1}. ${r.username || r.email || r.password || 'N/A'} | ${r.database || 'N/A'}\n`;
                        });
                    }
                } catch {}
            }

            try {
                const { IntelXAPI } = require('../../utils/intelx');
                const searchRes = await new IntelXAPI().search(hash);
                if (searchRes?.id) {
                    const api = new (require('../../utils/intelx').IntelXAPI)();
                    const detail = await api.searchById(searchRes.id);
                    const content = typeof detail === 'string' ? detail : (detail?.content || JSON.stringify(detail).slice(0, 800));
                    if (content) result += '\n**Intel-X**\n' + content.slice(0, 600) + '\n';
                }
            } catch {}

            await loading.edit({
                components: [container(txt('## 🔐 Hash Lookup'), sep(), txt(result.slice(0, 3800)))],
                flags: FLAGS
            });
        } catch (err) {
            console.error('[HASHLOOKUP]', err);
            await loading.edit({ components: [container(txt('## ❌ Erreur'), sep(), txt('Erreur lors de la recherche.'))], flags: FLAGS }).catch(() => {});
        }
    }
};
