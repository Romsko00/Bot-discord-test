const db = require('../../utils/simpledb');
const { checkOsintPermission } = require('../../utils/osintHelpers');
const EMOJIS = require('../../utils/emojis');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

const COST = 5;

const DORK_PRESETS = {
    files: { name: 'Fichiers sensibles', dorks: ['filetype:pdf {q}', 'filetype:xls {q}', 'filetype:xlsx {q}', 'filetype:doc {q}', 'filetype:csv {q}', 'filetype:sql {q}', 'filetype:log {q}', 'filetype:env {q}', 'filetype:config {q}', 'filetype:bak {q}', 'ext:xml {q}', 'ext:json "password" OR "api_key"'] },
    configs: { name: 'Configs & Backups', dorks: ['inurl:config "password"', 'inurl:backup {q}', 'inurl:.env', 'inurl:wp-config.php', 'intitle:"index of" .git', 'intitle:"index of" .env', 'intitle:"index of" backup', 'intext:"api_key" filetype:env'] },
    logs: { name: 'Logs & Erreurs', dorks: ['filetype:log {q}', 'intitle:"error" filetype:log', 'inurl:error.log', 'inurl:debug.log', 'intext:"stack trace" filetype:log'] },
    emails: { name: 'Emails & Fuites', dorks: ['"{q}" filetype:txt', 'intext:{q} "@gmail.com"', 'filetype:csv email password', 'filetype:xlsx "email" "password"'] },
    db: { name: 'Bases & SQL', dorks: ['intitle:"index of" .sql', 'filetype:sql "INSERT INTO"', 'inurl:phpmyadmin', 'intext:"mysql_connect"', 'intext:"DB_PASSWORD"'] },
    cameras: { name: 'Caméras & IoT', dorks: ['intitle:"Live View" -demo', 'inurl:ViewerFrame?Mode=', 'inurl:axis-cgi/jpg', 'intitle:"webcamXP"'] },
    panels: { name: 'Panneaux admin', dorks: ['intitle:"admin login"', 'inurl:admin/login', 'intitle:"dashboard" inurl:login', 'inurl:wp-admin'] },
    docs: { name: 'Documents exposés', dorks: ['site:{q} filetype:pdf', 'site:{q} filetype:doc', 'site:{q} intitle:"index of"'] }
};

const SEARCH_ENGINES = { google: 'https://www.google.com/search?q=', duckduckgo: 'https://duckduckgo.com/?q=' };

function encodeQuery(q) { return encodeURIComponent(q.trim()); }

function buildDorkQuery(query, filters = {}) {
    const parts = [query];
    if (filters.filetype) parts.push(`filetype:${filters.filetype}`);
    if (filters.site) parts.push(`site:${filters.site.replace(/^(https?:\/\/)?(www\.)?/i, '')}`);
    if (filters.inurl) parts.push(`inurl:${filters.inurl}`);
    if (filters.intitle) parts.push(`intitle:${filters.intitle}`);
    if (filters.intext) parts.push(`intext:${filters.intext}`);
    return parts.join(' ');
}

module.exports = {
    name: 'dork',
    aliases: ['dorking', 'googledork', 'dorks'],
    description: 'Génère des requêtes dork (Google / DuckDuckGo) avec filtres et préréglages',
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

        const query = args.join(' ').trim();
        if (!query) {
            const presetList = Object.entries(DORK_PRESETS)
                .map(([key, p]) => `**${key}** — ${p.name} (${p.dorks.length} dorks)`).join('\n');
            return message.reply({
                components: [container(
                    txt('## 🐛 Dork — Utilisation'),
                    sep(),
                    txt([
                        `**Préréglages disponibles :**\n${presetList}`,
                        '',
                        `**Usage avec préréglage :** \`${prefix}dork <préset> <terme>\``,
                        `Ex: \`${prefix}dork files motdepasse\` | \`${prefix}dork config site.com\``,
                        '',
                        '**Filtres :** `filetype:` `site:` `inurl:` `intitle:` `intext:`',
                        `\`${prefix}dork <terme> | filetype:pdf | site:example.com\``
                    ].join('\n'))
                )],
                flags: FLAGS,
                allowedMentions: { repliedUser: false }
            });
        }

        db.subtract(`user_credits_${message.author.id}`, COST);

        const presetKey = Object.keys(DORK_PRESETS).find(k => k.toLowerCase() === query.split(/\s+/)[0].toLowerCase());
        let terms = query;
        let preset = null;
        if (presetKey) { preset = DORK_PRESETS[presetKey]; terms = query.slice(presetKey.length).trim() || 'password'; }

        const filterMatch = terms.match(/\s*\|\s*(filetype|site|inurl|intitle|intext):([^|]+)/gi);
        const filters = {};
        let cleanTerms = terms;
        if (filterMatch) {
            filterMatch.forEach(m => { const [, type, value] = m.match(/\s*\|\s*(filetype|site|inurl|intitle|intext):([^|]+)/i) || []; if (type && value) filters[type.toLowerCase()] = value.trim(); });
            cleanTerms = terms.replace(/\s*\|[^|]+/g, '').trim() || 'search';
        }

        const dorkLines = [];
        if (preset && preset.dorks.length) {
            preset.dorks.slice(0, 12).forEach(d => {
                const filled = d.replace(/\{q\}/g, cleanTerms);
                dorkLines.push(`• \`${filled}\`\n  [Google](${SEARCH_ENGINES.google + encodeQuery(filled)})`);
            });
        } else {
            const built = buildDorkQuery(cleanTerms, filters);
            dorkLines.push(`• \`${built}\`\n  [Google](${SEARCH_ENGINES.google + encodeQuery(built)}) | [DuckDuckGo](${SEARCH_ENGINES.duckduckgo + encodeQuery(built)})`);
        }

        return message.channel.send({
            components: [container(
                txt(preset ? `## 🐛 Dork — ${preset.name}` : '## 🐛 Dork personnalisé'),
                sep(),
                txt((preset ? `**Terme :** ${cleanTerms}\n\n` : '') + dorkLines.join('\n\n').slice(0, 3600))
            )],
            flags: FLAGS
        });
    }
};
