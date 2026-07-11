const playlistManager = require('../../utils/playlistManager');
const { getQueue, addSong, connectToChannel, playNext } = require('../../utils/musicQueue');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
    name: 'playlist',
    aliases: ['pl'],
    description: 'Gestion des playlists personnalisées',
    usage: '+playlist <create|add|remove|list|show|load|delete|share> [args]',
    category: 'music',
    run: async (client, message, args) => {
        try {
            const userId = message.author.id;
            const action = (args[0] || '').toLowerCase();

            if (action === 'create' || action === 'créer') {
                const name = args.slice(1).join(' ').trim();
                if (!name) return message.reply({ content: '<a:_:1483497365863399536> Usage: `+playlist create <nom>`', allowedMentions: { repliedUser: false } });
                const result = playlistManager.createPlaylist(userId, name);
                if (!result.ok) return message.reply({ content: `<a:_:1483497365863399536> ${result.error}`, allowedMentions: { repliedUser: false } });
                return message.channel.send({
                    components: [container(
                        txt('## ✅ Playlist Créée'),
                        sep(),
                        txt(`Playlist **${name}** créée avec succès !\n• \`+playlist add ${name} <url>\` — Ajouter une musique\n• \`+playlist show ${name}\` — Voir la playlist`)
                    )],
                    flags: FLAGS
                });
            }

            if (action === 'add' || action === 'ajouter') {
                const name = args[1];
                const url = args[2];
                if (!name || !url) return message.reply({ content: '<a:_:1483497365863399536> Usage: `+playlist add <nom> <url>`', allowedMentions: { repliedUser: false } });
                const playdl = require('play-dl');
                let title, duration;
                try {
                    const valid = playdl.yt_validate(url);
                    if (valid !== 'video') return message.reply({ content: '<a:_:1483497365863399536> URL YouTube invalide.', allowedMentions: { repliedUser: false } });
                    const info = await playdl.video_info(url).catch(() => null);
                    title = info?.video_details?.title || url;
                    duration = Number(info?.video_details?.durationInSec) || null;
                } catch { return message.reply({ content: '<a:_:1483497365863399536> Erreur lors de la récupération des informations.', allowedMentions: { repliedUser: false } }); }
                const result = playlistManager.addToPlaylist(userId, name, { title, url, duration });
                if (!result.ok) return message.reply({ content: `<a:_:1483497365863399536> ${result.error}`, allowedMentions: { repliedUser: false } });
                return message.channel.send({
                    components: [container(txt('## ➕ Musique Ajoutée'), sep(), txt(`**${title}** ajoutée à la playlist **${name}**\n**Total :** ${result.count} musique(s)`))],
                    flags: FLAGS
                });
            }

            if (action === 'list' || action === 'liste') {
                const playlists = playlistManager.getUserPlaylists(userId);
                if (!playlists.length) return message.reply({ content: '📭 Vous n\'avez aucune playlist. Créez-en une avec `+playlist create <nom>`', allowedMentions: { repliedUser: false } });
                return message.channel.send({
                    components: [container(
                        txt('## 🎼 Vos Playlists'),
                        sep(),
                        txt(playlists.map(pl => `**${pl.name}** • ${pl.songCount} musique(s) ${pl.public ? '🌐' : '<:_:1483497431135162539>'}`).join('\n')),
                        sep(),
                        txt(`*${playlists.length} playlist(s)*`)
                    )],
                    flags: FLAGS
                });
            }

            if (action === 'show' || action === 'voir') {
                const name = args.slice(1).join(' ').trim();
                if (!name) return message.reply({ content: '<a:_:1483497365863399536> Usage: `+playlist show <nom>`', allowedMentions: { repliedUser: false } });
                const playlist = playlistManager.getPlaylist(userId, name);
                if (!playlist) return message.reply({ content: '<a:_:1483497365863399536> Playlist introuvable.', allowedMentions: { repliedUser: false } });
                const songList = playlist.songs.length
                    ? playlist.songs.map((s, i) => `\`${i + 1}.\` ${s.title}`).join('\n').slice(0, 3500)
                    : 'Aucune musique dans cette playlist.';
                return message.channel.send({
                    components: [container(
                        txt(`## 🎵 Playlist : ${playlist.name}`),
                        sep(),
                        txt(`**Musiques :** ${playlist.songs.length} | **Visibilité :** ${playlist.public ? '🌐 Publique' : '<:_:1483497431135162539> Privée'}`),
                        sep(),
                        txt(songList)
                    )],
                    flags: FLAGS
                });
            }

            if (action === 'load' || action === 'charger') {
                const voiceChannel = message.member?.voice?.channel;
                if (!voiceChannel) return message.reply({ content: '<a:_:1483497365863399536> Vous devez être dans un salon vocal.', allowedMentions: { repliedUser: false } });
                const name = args.slice(1).join(' ').trim();
                if (!name) return message.reply({ content: '<a:_:1483497365863399536> Usage: `+playlist load <nom>`', allowedMentions: { repliedUser: false } });
                const playlist = playlistManager.getPlaylist(userId, name);
                if (!playlist) return message.reply({ content: '<a:_:1483497365863399536> Playlist introuvable.', allowedMentions: { repliedUser: false } });
                if (!playlist.songs.length) return message.reply({ content: '<a:_:1483497365863399536> Cette playlist est vide.', allowedMentions: { repliedUser: false } });
                const queue = getQueue(message.guild.id);
                queue.textChannel = message.channel;
                queue.voiceChannel = voiceChannel;
                playlist.songs.forEach(song => addSong(queue, { ...song, requestedBy: message.author }));
                await message.channel.send({
                    components: [container(txt('## ✅ Playlist Chargée'), sep(), txt(`**${playlist.songs.length}** musiques de **${playlist.name}** ajoutées à la file !`))],
                    flags: FLAGS
                });
                if (!queue.playing) { try { await connectToChannel(queue, message.guild.id, voiceChannel, message.guild); await playNext(queue); } catch (error) { console.error('[PLAYLIST] Erreur lecture:', error); } }
                return;
            }

            if (action === 'delete' || action === 'supprimer') {
                const name = args.slice(1).join(' ').trim();
                if (!name) return message.reply({ content: '<a:_:1483497365863399536> Usage: `+playlist delete <nom>`', allowedMentions: { repliedUser: false } });
                const result = playlistManager.deletePlaylist(userId, name);
                if (!result.ok) return message.reply({ content: `<a:_:1483497365863399536> ${result.error}`, allowedMentions: { repliedUser: false } });
                return message.reply({ content: `<a:_:1483497369315315786> Playlist **${name}** supprimée.`, allowedMentions: { repliedUser: false } });
            }

            if (action === 'remove' || action === 'retirer') {
                const name = args[1];
                const index = parseInt(args[2]) - 1;
                if (!name || isNaN(index)) return message.reply({ content: '<a:_:1483497365863399536> Usage: `+playlist remove <nom> <position>`', allowedMentions: { repliedUser: false } });
                const result = playlistManager.removeFromPlaylist(userId, name, index);
                if (!result.ok) return message.reply({ content: `<a:_:1483497365863399536> ${result.error}`, allowedMentions: { repliedUser: false } });
                return message.reply({ content: `<a:_:1483497369315315786> **${result.removed.title}** retirée de **${name}**. (${result.count} restantes)`, allowedMentions: { repliedUser: false } });
            }

            if (action === 'share' || action === 'partager') {
                const name = args.slice(1).join(' ').trim();
                if (!name) return message.reply({ content: '<a:_:1483497365863399536> Usage: `+playlist share <nom>`', allowedMentions: { repliedUser: false } });
                const result = playlistManager.togglePublic(userId, name);
                if (!result.ok) return message.reply({ content: `<a:_:1483497365863399536> ${result.error}`, allowedMentions: { repliedUser: false } });
                return message.reply({ content: `<a:_:1483497369315315786> Playlist **${name}** est maintenant ${result.public ? '🌐 publique' : '<:_:1483497431135162539> privée'}.`, allowedMentions: { repliedUser: false } });
            }

            return message.channel.send({
                components: [container(
                    txt('## 🎼 Système de Playlists'),
                    sep(),
                    txt([
                        '**Créer :** `+playlist create <nom>`',
                        '**Ajouter :** `+playlist add <nom> <url>`',
                        '**Lister :** `+playlist list`',
                        '**Voir :** `+playlist show <nom>`',
                        '**Charger :** `+playlist load <nom>`',
                        '**Supprimer :** `+playlist delete <nom>`',
                        '**Retirer :** `+playlist remove <nom> <pos>`',
                        '**Partager :** `+playlist share <nom>`'
                    ].join('\n'))
                )],
                flags: FLAGS
            });

        } catch (error) {
            console.error('[PLAYLIST] Erreur:', error);
            return message.reply({ content: '<a:_:1483497365863399536> Une erreur est survenue.', allowedMentions: { repliedUser: false } });
        }
    }
};
