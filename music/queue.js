const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { getQueue } = require('../../utils/musicQueue');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '??:??';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

module.exports = {
    name: 'queue',
    aliases: ['q'],
    description: 'Affiche la file d\'attente',
    usage: '+queue [page]',
    category: 'music',
    run: async (client, message, args) => {
        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) return message.reply({ content: '<a:_:1483497365863399536> Vous devez être dans un salon vocal.', allowedMentions: { repliedUser: false } });

        const me = message.guild.members.me;
        if (!me || !me.permissions.has(PermissionFlagsBits.Connect) || !me.permissions.has(PermissionFlagsBits.Speak)) {
            return message.reply({ content: '<a:_:1483497365863399536> Je n\'ai pas la permission de gérer le vocal ici.', allowedMentions: { repliedUser: false } });
        }

        const queue = getQueue(message.guild.id);
        if (!queue.songs.length) {
            return message.reply({ content: '📭 La file est vide. Utilisez `+play <titre/lien>` pour ajouter une musique.', allowedMentions: { repliedUser: false } });
        }

        const songsPerPage = 10;
        const totalPages = Math.ceil(queue.songs.length / songsPerPage);
        let currentPage = Math.max(1, Math.min(parseInt(args[0]) || 1, totalPages));

        const createQueueContainer = (page) => {
            const start = (page - 1) * songsPerPage;
            const songs = queue.songs.slice(start, start + songsPerPage);
            const totalDuration = queue.songs.reduce((acc, s) => acc + (s.duration || 0), 0);
            const loopStatus = queue.loop ? '🔂 Loop' : queue.loopQueue ? '🔁 Loop File' : '<:_:1483497470754426942> Normal';

            const lines = songs.map((s, idx) => {
                const position = start + idx;
                const req = s.requestedBy ? ` • ${s.requestedBy.tag}` : '';
                const dur = s.duration ? ` \`[${formatDuration(s.duration)}]\`` : '';
                return position === 0
                    ? `🎶 **En cours:** [${s.title}](${s.url})${dur}${req}`
                    : `\`${position}.\` [${s.title}](${s.url})${dur}${req}`;
            });

            return container(
                txt('## 🎼 File d\'attente'),
                sep(),
                txt(lines.join('\n')),
                sep(),
                txt(`**Total :** ${queue.songs.length} musique(s) | **Durée :** ${formatDuration(totalDuration)} | **Mode :** ${loopStatus} | **Page :** ${page}/${totalPages}`)
            );
        };

        const buildRow = (page) => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('queue_first').setLabel('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(page === 1),
            new ButtonBuilder().setCustomId('queue_prev').setLabel('<:_:1483497463108210884>').setStyle(ButtonStyle.Primary).setDisabled(page === 1),
            new ButtonBuilder().setCustomId('queue_next').setLabel('<:_:1483497470754426942>').setStyle(ButtonStyle.Primary).setDisabled(page === totalPages),
            new ButtonBuilder().setCustomId('queue_last').setLabel('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages)
        );

        if (totalPages <= 1) {
            return message.channel.send({ components: [createQueueContainer(1)], flags: FLAGS });
        }

        const msg = await message.channel.send({ components: [createQueueContainer(currentPage), buildRow(currentPage)], flags: FLAGS });

        const collector = msg.createMessageComponentCollector({ time: 120000 });
        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: '<a:_:1483497365863399536> Seul l\'auteur de la commande peut utiliser ces boutons.', ephemeral: true });
            }
            if (i.customId === 'queue_first') currentPage = 1;
            else if (i.customId === 'queue_prev') currentPage = Math.max(1, currentPage - 1);
            else if (i.customId === 'queue_next') currentPage = Math.min(totalPages, currentPage + 1);
            else if (i.customId === 'queue_last') currentPage = totalPages;
            await i.update({ components: [createQueueContainer(currentPage), buildRow(currentPage)], flags: FLAGS });
        });
        collector.on('end', () => msg.edit({ components: [createQueueContainer(currentPage)] }).catch(() => {}));
    }
};
