const { getQueue } = require('../../utils/musicQueue');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
    name: 'shuffle',
    aliases: ['mix', 'random'],
    description: 'Mélange la file d\'attente',
    usage: '+shuffle',
    category: 'music',
    run: async (client, message) => {
        try {
            const voiceChannel = message.member?.voice?.channel;
            if (!voiceChannel) {
                return message.reply({ content: '<a:_:1483497365863399536> Vous devez être dans un salon vocal.', allowedMentions: { repliedUser: false } });
            }

            const queue = getQueue(message.guild.id);
            if (queue.songs.length < 2) {
                return message.reply({ content: '<a:_:1483497365863399536> Il faut au moins 2 musiques dans la file pour mélanger.', allowedMentions: { repliedUser: false } });
            }

            const currentSong = queue.songs[0];
            const remainingSongs = queue.songs.slice(1);
            for (let i = remainingSongs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [remainingSongs[i], remainingSongs[j]] = [remainingSongs[j], remainingSongs[i]];
            }
            queue.songs = [currentSong, ...remainingSongs];

            return message.channel.send({
                components: [container(
                    txt('## 🔀 File Mélangée'),
                    sep(),
                    txt(`La file a été mélangée ! **${queue.songs.length - 1}** musiques réorganisées.\n*Utilisez \`+queue\` pour voir le nouvel ordre.*`)
                )],
                flags: FLAGS
            });

        } catch (error) {
            console.error('[SHUFFLE] Erreur:', error);
            return message.reply({ content: '<a:_:1483497365863399536> Une erreur est survenue.', allowedMentions: { repliedUser: false } });
        }
    }
};
