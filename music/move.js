const { getQueue } = require('../../utils/musicQueue');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
    name: 'move',
    aliases: ['mv'],
    description: 'Déplace une musique dans la file',
    usage: '+move <de> <vers>',
    category: 'music',
    run: async (client, message, args) => {
        try {
            const voiceChannel = message.member?.voice?.channel;
            if (!voiceChannel) {
                return message.reply({ content: '<a:_:1483497365863399536> Vous devez être dans un salon vocal.', allowedMentions: { repliedUser: false } });
            }

            const queue = getQueue(message.guild.id);
            if (queue.songs.length <= 1) {
                return message.reply({ content: '<a:_:1483497365863399536> La file est vide.', allowedMentions: { repliedUser: false } });
            }

            const from = parseInt(args[0]);
            const to = parseInt(args[1]);

            if (isNaN(from) || isNaN(to)) {
                return message.reply({ content: '<a:_:1483497365863399536> Usage: `+move <de> <vers>` (ex: `+move 3 1`)', allowedMentions: { repliedUser: false } });
            }

            if (from < 1 || from >= queue.songs.length || to < 1 || to >= queue.songs.length) {
                return message.reply({ content: `<a:_:1483497365863399536> Positions invalides. Utilisez des nombres entre 1 et ${queue.songs.length - 1}.`, allowedMentions: { repliedUser: false } });
            }

            if (from === to) {
                return message.reply({ content: '<a:_:1483497365863399536> Les positions sont identiques.', allowedMentions: { repliedUser: false } });
            }

            const song = queue.songs.splice(from, 1)[0];
            queue.songs.splice(to, 0, song);

            return message.channel.send({
                components: [container(
                    txt('## ↔️ Musique Déplacée'),
                    sep(),
                    txt(`**[${song.title}](${song.url})**\nDe la position **${from}** → **${to}**\n*Utilisez \`+queue\` pour voir le nouvel ordre.*`)
                )],
                flags: FLAGS
            });

        } catch (error) {
            console.error('[MOVE] Erreur:', error);
            return message.reply({ content: '<a:_:1483497365863399536> Une erreur est survenue.', allowedMentions: { repliedUser: false } });
        }
    }
};
