const { getQueue } = require('../../utils/musicQueue');
const { container, txt, sep, reply, FLAGS } = require('../../utils/v2');

module.exports = {
    name: 'clear',
    aliases: ['clearqueue', 'cq'],
    description: 'Vide la file d\'attente (sauf la musique en cours)',
    usage: '+clear',
    category: 'music',
    run: async (client, message) => {
        try {
            const voiceChannel = message.member?.voice?.channel;
            if (!voiceChannel) {
                return message.reply({ content: '<a:_:1483497365863399536> Vous devez être dans un salon vocal.', allowedMentions: { repliedUser: false } });
            }

            const queue = getQueue(message.guild.id);
            if (queue.songs.length <= 1) {
                return message.reply({ content: '<a:_:1483497365863399536> La file est déjà vide.', allowedMentions: { repliedUser: false } });
            }

            const clearedCount = queue.songs.length - 1;
            queue.songs = queue.songs.slice(0, 1);

            return message.channel.send({
                components: [container(
                    txt('## 🗑️ File Vidée'),
                    sep(),
                    txt(`**${clearedCount}** musique(s) retirée(s) de la file.\n*La musique en cours continue de jouer.*`)
                )],
                flags: FLAGS
            });

        } catch (error) {
            console.error('[CLEAR] Erreur:', error);
            return message.reply({ content: '<a:_:1483497365863399536> Une erreur est survenue.', allowedMentions: { repliedUser: false } });
        }
    }
};
