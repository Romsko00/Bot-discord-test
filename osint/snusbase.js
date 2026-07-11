const { SnusbaseAPI } = require('../../utils/snusbase');
const { FileManager } = require('../../utils/fileManager');
const db = require('../../utils/simpledb');
const { checkOsintPermission } = require('../../utils/osintHelpers');
const EMOJIS = require('../../utils/emojis');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

const snusbase = new SnusbaseAPI();
const fileManager = new FileManager();

module.exports = {
    name: 'snusbase',
    aliases: ['snus', 'snusb'],
    description: 'Recherche sur Snusbase',
    run: async (client, message, args) => {
        if (!checkOsintPermission(client, message)) return;

        const cost = 5;
        const level = db.get(`guild_${message.guild.id}_level_${message.author.id}`) || 1;
        const totalCredits = (db.get(`user_credits_${message.author.id}`) || 0) + (db.get(`daily_credits_${message.author.id}`) || 0) + level * 2;

        if (!args[0]) {
            return message.channel.send({ content: '<a:_:1483497365863399536> Veuillez fournir un terme de recherche (email, username, IP, hash, domaine).', allowedMentions: { repliedUser: false } });
        }

        if (totalCredits < cost) {
            return message.channel.send({
                components: [container(txt('## ❌ Crédits insuffisants'), sep(), txt(`**Coût :** ${cost} crédits\n**Vos crédits :** ${totalCredits} crédits`))],
                flags: FLAGS
            });
        }
        db.subtract(`user_credits_${message.author.id}`, cost);

        const query = args.join(' ');
        const loadingMsg = await message.channel.send({
            components: [container(txt('## 🔍 Recherche Snusbase...'), sep(), txt(`Recherche de \`${query}\`...`))],
            flags: FLAGS
        });

        try {
            let searchData = null;
            if (query.includes('@')) searchData = await snusbase.searchEmail(query);
            else if (query.match(/^([a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,}$/)) searchData = await snusbase.searchDomain(query);
            else if (query.match(/^[a-fA-F0-9]{32,64}$/)) searchData = await snusbase.searchHash(query);
            else if (query.match(/^\d{1,3}(\.\d{1,3}){3}$/)) searchData = await snusbase.searchIP(query);
            else if (query.match(/^[a-zA-Z0-9_\.\-]{3,}$/)) searchData = await snusbase.searchUsername(query);
            else searchData = await snusbase.searchAll(query);

            const results = searchData?.results || [];

            if (results.length > 0) {
                let detailedResults = `Résultats Snusbase pour: "${query}"\n${'='.repeat(50)}\n\n`;
                results.forEach((result, index) => {
                    detailedResults += `${index + 1}. Username: ${result.username || 'N/A'} | Email: ${result.email || 'N/A'} | Hash: ${result.hash || 'N/A'} | IP: ${result.lastip || 'N/A'} | DB: ${result.database || 'N/A'}\n`;
                });
                await fileManager.sendResultsToUser(message.author, message.channel, detailedResults, query, 'snusbase').catch(() => {});
            }

            const lines = [
                `**Recherche :** \`${query}\``,
                `**Résultats :** ${results.length}`,
                `**Coût :** ${cost} crédits | **Restants :** ${totalCredits - cost} crédits`,
                ''
            ];

            if (results.length > 0) {
                results.slice(0, 10).forEach((r, i) => {
                    lines.push(`**${i + 1}.** ${r.username || r.email || 'N/A'} | Email: ${r.email || 'N/A'} | IP: ${r.lastip || 'N/A'} | DB: ${r.database || 'N/A'}`);
                });
                if (results.length > 10) lines.push(`*... et ${results.length - 10} autres résultats (envoyés en DM)*`);
            } else {
                lines.push('Aucun résultat trouvé.');
            }

            await loadingMsg.edit({
                components: [container(
                    txt(results.length > 0 ? '## 🚨 Résultats Snusbase' : '## ✅ Aucun résultat Snusbase'),
                    sep(),
                    txt(lines.join('\n').slice(0, 3800))
                )],
                flags: FLAGS
            });
        } catch (error) {
            await loadingMsg.edit({
                components: [container(txt('## ❌ Erreur Snusbase'), sep(), txt(`Erreur : ${error.message}`))],
                flags: FLAGS
            }).catch(() => {});
            await fileManager.logError(error, 'Snusbase search');
        }
    }
};
