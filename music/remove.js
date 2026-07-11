const { getQueue } = require('../../utils/musicQueue');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
    name: 'remove',
    aliases: ['rm', 'delete'],
    description: 'Retire une musique de la file',
    usage: '+remove <position>',
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

            const position = parseInt(args[0]);
            if (isNaN(position) || position < 1 || position >= queue.songs.length) {
                return message.reply({ content: `<a:_:1483497365863399536> Position invalide. Utilisez un nombre entre 1 et ${queue.songs.length - 1}.`, allowedMentions: { repliedUser: false } });
            }

            const removed = queue.songs.splice(position, 1)[0];

            return message.channel.send({
                components: [container(
                    txt('## ➖ Musique Retirée'),
                    sep(),
                    txt(`**[${removed.title}](${removed.url})** a été retirée de la file.\n**Position :** ${position}`)
                )],
                flags: FLAGS
            });

        } catch (error) {
            console.error('[REMOVE] Erreur:', error);
            return message.reply({ content: '<a:_:1483497365863399536> Une erreur est survenue.', allowedMentions: { repliedUser: false } });
        }
    }
};
