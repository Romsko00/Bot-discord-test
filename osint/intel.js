const { IntelXAPI } = require('../../utils/intelx');
const { FileManager } = require('../../utils/fileManager');
const db = require('../../utils/simpledb');
const { checkOsintPermission } = require('../../utils/osintHelpers');
const EMOJIS = require('../../utils/emojis');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

const intelx = new IntelXAPI();
const fileManager = new FileManager();

module.exports = {
    name: 'intel',
    aliases: ['ix', 'intelx'],
    description: 'Analyse et récupération de données depuis IntelX (OSINT avancé)',
    run: async (client, message, args) => {
        if (!checkOsintPermission(client, message)) return;

        const guildId = message.guild?.id;
        const userId = message.author?.id;
        const cost = 5;
        const level = db.get(`guild_${guildId}_level_${userId}`) || 1;
        const totalCredits = (db.get(`user_credits_${userId}`) || 0) + (db.get(`daily_credits_${userId}`) || 0) + level * 2;

        if (!args[0]) {
            return message.channel.send({ content: '<a:_:1483497365863399536> Veuillez fournir un terme de recherche (email, domaine, username, hash ou ID Intel-X).', allowedMentions: { repliedUser: false } });
        }

        if (totalCredits < cost) {
            return message.channel.send({
                components: [container(txt('## ❌ Crédits insuffisants'), sep(), txt(`**Coût :** ${cost} crédits\n**Vos crédits :** ${totalCredits} crédits`))],
                flags: FLAGS
            });
        }
        db.subtract(`user_credits_${userId}`, cost);

        const searchTerm = args[0];
        const loadingMsg = await message.channel.send({
            components: [container(txt('## 🔍 Recherche Intel-X...'), sep(), txt(`Analyse de \`${searchTerm}\`...`))],
            flags: FLAGS
        });

        try {
            let result = null;
            if (searchTerm.length === 36 && /^[a-f0-9-]{36}$/i.test(searchTerm)) {
                result = await intelx.searchById(searchTerm);
            } else {
                const searchResponse = await intelx.search(searchTerm);
                if (searchResponse?.id) result = await intelx.searchById(searchResponse.id);
                else result = searchResponse;
            }

            const rawContent = typeof result === 'string' ? result : (result?.content ?? (typeof result === 'object' ? JSON.stringify(result) : String(result)));
            const parsedResults = typeof result === 'string' ? intelx.parseResults(result) : [rawContent.slice(0, 2000)];
            const textContent = Array.isArray(parsedResults) ? parsedResults.join('\n') : rawContent.slice(0, 3000);

            try {
                await fileManager.sendResultsToUser(message.author, message.channel, textContent, searchTerm, 'intel-x');
            } catch {
                await message.channel.send({ content: `${EMOJIS.FOLDER} **Résultats Intel-X pour \`${searchTerm}\`** (extrait):\n\`\`\`\n${textContent.slice(0, 1500)}\n\`\`\`` });
            }

            await loadingMsg.edit({
                components: [container(
                    txt('## ✅ Recherche Intel-X terminée'),
                    sep(),
                    txt([
                        `**Terme recherché :** \`${searchTerm}\``,
                        `**Coût :** ${cost} crédits`,
                        `**Crédits restants :** ${totalCredits - cost} crédits`,
                        '',
                        'Les résultats ont été envoyés en DM ou affichés ci-dessus.'
                    ].join('\n'))
                )],
                flags: FLAGS
            });
        } catch (error) {
            await loadingMsg.edit({
                components: [container(txt('## ❌ Erreur Intel-X'), sep(), txt('Impossible de récupérer les résultats.'))],
                flags: FLAGS
            }).catch(() => {});
            fileManager.logError(error, 'Intel-X search');
            console.error('IntelX Error:', error);
        }
    }
};
