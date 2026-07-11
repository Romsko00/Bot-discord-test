const db = require('../../utils/simpledb');
const { getQueue, addSong, connectToChannel, playNext } = require('../../utils/musicQueue');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
    name: 'favorites',
    aliases: ['fav', 'favs', 'favoris'],
    description: 'Gère vos musiques favorites',
    usage: '+favorites <add|remove|list|play> [args]',
    category: 'music',
    run: async (client, message, args) => {
        try {
            const userId = message.author.id;
            const action = (args[0] || '').toLowerCase();
            const key = `favorites_${userId}`;
            let favorites = db.get(key) || [];

            if (action === 'add' || action === 'ajouter' || !action) {
                const queue = getQueue(message.guild.id);
                if (!queue.playing || !queue.current) {
                    if (!action) return listFavorites(message, favorites);
                    return message.reply({ content: '<a:_:1483497365863399536> Aucune musique en cours à ajouter.', allowedMentions: { repliedUser: false } });
                }
                const song = queue.current.song;
                if (favorites.some(f => f.url === song.url)) {
                    return message.reply({ content: '<a:_:1483497365863399536> Cette musique est déjà dans vos favoris.', allowedMentions: { repliedUser: false } });
                }
                favorites.push({ title: song.title, url: song.url, duration: song.duration, addedAt: Date.now() });
                db.set(key, favorites);
                return message.channel.send({
                    components: [container(
                        txt('## ⭐ Ajouté aux Favoris'),
                        sep(),
                        txt(`**[${song.title}](${song.url})** a été ajouté à vos favoris !\n**Total :** ${favorites.length} favori(s)`)
                    )],
                    flags: FLAGS
                });
            }

            if (action === 'list' || action === 'liste') return listFavorites(message, favorites);

            if (action === 'remove' || action === 'retirer' || action === 'delete') {
                const index = parseInt(args[1]) - 1;
                if (isNaN(index) || index < 0 || index >= favorites.length) {
                    return message.reply({ content: '<a:_:1483497365863399536> Index invalide. Utilisez `+fav list` pour voir les numéros.', allowedMentions: { repliedUser: false } });
                }
                const removed = favorites.splice(index, 1)[0];
                db.set(key, favorites);
                return message.reply({ content: `<a:_:1483497369315315786> **${removed.title}** retiré des favoris.`, allowedMentions: { repliedUser: false } });
            }

            if (action === 'play' || action === 'jouer') {
                const voiceChannel = message.member?.voice?.channel;
                if (!voiceChannel) return message.reply({ content: '<a:_:1483497365863399536> Vous devez être dans un salon vocal.', allowedMentions: { repliedUser: false } });

                if (args[1] === 'all') {
                    if (!favorites.length) return message.reply({ content: '<a:_:1483497365863399536> Vous n\'avez aucun favori.', allowedMentions: { repliedUser: false } });
                    const queue = getQueue(message.guild.id);
                    queue.textChannel = message.channel;
                    queue.voiceChannel = voiceChannel;
                    favorites.forEach(f => addSong(queue, { ...f, requestedBy: message.author }));
                    message.channel.send({ content: `<a:_:1483497369315315786> **${favorites.length}** favoris ajoutés à la file !` });
                    if (!queue.playing) { try { await connectToChannel(queue, message.guild.id, voiceChannel, message.guild); await playNext(queue); } catch (e) { console.error(e); } }
                    return;
                }

                const index = parseInt(args[1]) - 1;
                if (isNaN(index) || index < 0 || index >= favorites.length) {
                    return message.reply({ content: '<a:_:1483497365863399536> Index invalide. Utilisez `+fav list`.', allowedMentions: { repliedUser: false } });
                }
                const fav = favorites[index];
                const queue = getQueue(message.guild.id);
                queue.textChannel = message.channel;
                queue.voiceChannel = voiceChannel;
                addSong(queue, { title: fav.title, url: fav.url, duration: fav.duration, requestedBy: message.author });
                message.channel.send({ content: `<a:_:1483497369315315786> **${fav.title}** ajouté à la file !` });
                if (!queue.playing) { try { await connectToChannel(queue, message.guild.id, voiceChannel, message.guild); await playNext(queue); } catch (e) { console.error(e); } }
                return;
            }

        } catch (error) {
            console.error('[FAVORITES] Erreur:', error);
            return message.reply({ content: '<a:_:1483497365863399536> Une erreur est survenue.', allowedMentions: { repliedUser: false } });
        }
    }
};

function listFavorites(message, favorites) {
    if (!favorites.length) {
        return message.reply({ content: '📭 Vous n\'avez aucun favori. Utilisez `+fav add` quand une musique joue.', allowedMentions: { repliedUser: false } });
    }
    return message.channel.send({
        components: [container(
            txt('## ⭐ Vos Favoris'),
            sep(),
            txt(favorites.map((f, i) => `\`${i + 1}.\` [${f.title}](${f.url})`).join('\n').slice(0, 3800)),
            sep(),
            txt('*Utilisez `+fav play <numéro>` pour jouer*')
        )],
        flags: FLAGS
    });
}
