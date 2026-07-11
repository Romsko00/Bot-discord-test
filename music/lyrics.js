const { getQueue } = require('../../utils/musicQueue');
const lyricsAPI = require('../../utils/lyricsAPI');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
    name: 'lyrics',
    aliases: ['ly', 'paroles'],
    description: 'Affiche les paroles de la musique en cours ou d\'une recherche',
    usage: '+lyrics [titre]',
    category: 'music',
    run: async (client, message, args) => {
        try {
            let query = args.join(' ');
            let title = '';

            if (!query) {
                const queue = getQueue(message.guild.id);
                if (!queue.playing || !queue.current) {
                    return message.reply({ content: '<a:_:1483497365863399536> Aucune musique en cours. Précisez un titre : `+lyrics <titre>`', allowedMentions: { repliedUser: false } });
                }
                query = queue.current.song.title;
                title = queue.current.song.title;
            } else {
                title = query;
            }

            const loadingMsg = await message.channel.send({
                components: [container(txt('## 🔍 Recherche en cours...'), sep(), txt(`Paroles pour **${title}**`))],
                flags: FLAGS
            });

            const lyrics = await lyricsAPI.findLyrics(query);

            if (!lyrics) {
                return loadingMsg.edit({
                    components: [container(txt('## ❌ Introuvable'), sep(), txt(`Paroles introuvables pour **${title}**.`))],
                    flags: FLAGS
                });
            }

            const chunks = [];
            let currentChunk = '';
            lyrics.split('\n').forEach(line => {
                if (currentChunk.length + line.length + 1 > 1900) {
                    chunks.push(currentChunk);
                    currentChunk = '';
                }
                currentChunk += line + '\n';
            });
            if (currentChunk) chunks.push(currentChunk);

            await loadingMsg.edit({
                components: [container(
                    txt(`## 🎤 Paroles : ${title}`),
                    sep(),
                    txt(chunks[0]),
                    ...(chunks.length > 1 ? [sep(), txt(`*Page 1/${chunks.length} — ${chunks.length - 1} autre(s) page(s)*`)] : [])
                )],
                flags: FLAGS
            });

        } catch (error) {
            console.error('[LYRICS] Erreur:', error);
            return message.reply({ content: '<a:_:1483497365863399536> Une erreur est survenue.', allowedMentions: { repliedUser: false } });
        }
    }
};
