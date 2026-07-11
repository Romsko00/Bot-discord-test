const { PermissionFlagsBits } = require('discord.js');
const { getQueue, getNowPlaying } = require('../../utils/musicQueue');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
    name: 'np',
    aliases: ['nowplaying'],
    description: 'Affiche la musique actuellement en cours',
    usage: '+np',
    category: 'music',
    run: async (client, message) => {
        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) return message.reply({ content: '<a:_:1483497365863399536> Vous devez être dans un salon vocal.', allowedMentions: { repliedUser: false } });

        const me = message.guild.members.me;
        if (!me || !me.permissions.has(PermissionFlagsBits.Connect) || !me.permissions.has(PermissionFlagsBits.Speak)) {
            return message.reply({ content: '<a:_:1483497365863399536> Je n\'ai pas la permission de gérer le vocal ici.', allowedMentions: { repliedUser: false } });
        }

        const queue = getQueue(message.guild.id);
        if (!queue.playing || !queue.current) {
            return message.reply({ content: '⏸️ Aucune musique en cours.', allowedMentions: { repliedUser: false } });
        }

        if (!queue.voiceChannel || queue.voiceChannel.id !== voiceChannel.id) {
            return message.reply({ content: '<a:_:1483497365863399536> Vous devez être dans le même vocal que moi.', allowedMentions: { repliedUser: false } });
        }

        const np = getNowPlaying(queue);
        if (!np) return message.reply({ content: '⏸️ Aucune musique en cours.', allowedMentions: { repliedUser: false } });

        const fmt = (sec) => {
            const s = Math.max(0, Math.floor(sec));
            const h = Math.floor(s / 3600);
            const m = Math.floor(s % 3600 / 60);
            const ss = s % 60;
            return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
        };

        const position = fmt(np.position || 0);
        const duration = np.duration ? fmt(np.duration) : '??:??';

        return message.channel.send({
            components: [container(
                txt('## 🎵 Lecture en cours'),
                sep(),
                txt([
                    `**[${np.song.title}](${np.song.url})**`,
                    `**⏱️ Temps :** ${position} / ${duration}`,
                    `**🔊 Volume :** ${Math.round((queue.volume || 1) * 100)}%`,
                    `**🙋 Demandé par :** ${np.song.requestedBy ? np.song.requestedBy.tag : 'inconnu'}`
                ].join('\n'))
            )],
            flags: FLAGS
        });
    }
};
