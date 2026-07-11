const { PermissionFlagsBits } = require('discord.js');
const { getQueue, setVolume } = require('../../utils/musicQueue');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
    name: 'volume',
    aliases: ['vol'],
    description: 'Ajuste le volume (0 à 200%)',
    usage: '+volume <pourcentage>',
    category: 'music',
    run: async (client, message, args) => {
        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) return message.reply({ content: '<a:_:1483497365863399536> Vous devez être dans un salon vocal.', allowedMentions: { repliedUser: false } });

        const me = message.guild.members.me;
        if (!me || !me.permissions.has(PermissionFlagsBits.Connect) || !me.permissions.has(PermissionFlagsBits.Speak)) {
            return message.reply({ content: '<a:_:1483497365863399536> Je n\'ai pas la permission de gérer le vocal ici.', allowedMentions: { repliedUser: false } });
        }

        const queue = getQueue(message.guild.id);
        if (!queue.voiceChannel || queue.voiceChannel.id !== voiceChannel.id) {
            return message.reply({ content: '<a:_:1483497365863399536> Vous devez être dans le même vocal que moi.', allowedMentions: { repliedUser: false } });
        }

        if (!args[0]) {
            const current = Math.round((queue.volume || 1) * 100);
            return message.channel.send({
                components: [container(txt('## 🔊 Volume'), sep(), txt(`Volume actuel : **${current}%**`))],
                flags: FLAGS
            });
        }

        const pct = parseInt(args[0].replace('%', ''), 10);
        if (isNaN(pct)) return message.reply({ content: '<a:_:1483497365863399536> Merci d\'indiquer un nombre entre 0 et 200.', allowedMentions: { repliedUser: false } });
        const clamped = Math.max(0, Math.min(pct, 200));

        const ok = setVolume(queue, clamped / 100);
        if (ok) {
            return message.channel.send({
                components: [container(txt('## 🔊 Volume'), sep(), txt(`Volume réglé à **${clamped}%**`))],
                flags: FLAGS
            });
        }
        return message.reply({ content: '<:_:1483497503713394719> Aucun flux en cours, le volume sera appliqué lors de la prochaine lecture.', allowedMentions: { repliedUser: false } });
    }
};
