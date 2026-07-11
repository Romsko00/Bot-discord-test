const { getQueue } = require('../../utils/musicQueue');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
    name: 'loop',
    aliases: ['repeat', 'l'],
    description: 'Active/désactive la répétition (musique actuelle ou file complète)',
    usage: '+loop [queue]',
    category: 'music',
    run: async (client, message, args) => {
        try {
            const voiceChannel = message.member?.voice?.channel;
            if (!voiceChannel) {
                return message.reply({ content: '<a:_:1483497365863399536> Vous devez être dans un salon vocal.', allowedMentions: { repliedUser: false } });
            }

            const queue = getQueue(message.guild.id);
            if (!queue.songs.length) {
                return message.reply({ content: '<a:_:1483497365863399536> Aucune musique en cours.', allowedMentions: { repliedUser: false } });
            }

            const mode = (args[0] || '').toLowerCase();

            if (mode === 'queue' || mode === 'q' || mode === 'file') {
                queue.loopQueue = !queue.loopQueue;
                if (queue.loopQueue) queue.loop = false;

                return message.channel.send({
                    components: [container(
                        txt(`## 🔁 Loop File ${queue.loopQueue ? 'Activé' : 'Désactivé'}`),
                        sep(),
                        txt(queue.loopQueue ? 'Toute la file sera répétée en boucle.' : 'La file ne sera plus répétée.')
                    )],
                    flags: FLAGS
                });
            } else {
                queue.loop = !queue.loop;
                if (queue.loop) queue.loopQueue = false;

                return message.channel.send({
                    components: [container(
                        txt(`## 🔂 Loop ${queue.loop ? 'Activé' : 'Désactivé'}`),
                        sep(),
                        txt(queue.loop
                            ? `La musique actuelle **${queue.songs[0]?.title}** sera répétée.`
                            : 'La musique ne sera plus répétée.'
                        )
                    )],
                    flags: FLAGS
                });
            }

        } catch (error) {
            console.error('[LOOP] Erreur:', error);
            return message.reply({ content: '<a:_:1483497365863399536> Une erreur est survenue.', allowedMentions: { repliedUser: false } });
        }
    }
};
