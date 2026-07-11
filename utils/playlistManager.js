const db = require('./simpledb');
const logger = require('./logger');

/**
 * GESTIONNAIRE DE PLAYLISTS
 * Permet aux utilisateurs de créer et gérer des playlists personnalisées
 */

class PlaylistManager {
    /**
     * Crée une nouvelle playlist
     */
    createPlaylist(userId, name) {
        const key = `playlist_${userId}_${name.toLowerCase()}`;

        if (db.get(key)) {
            return { ok: false, error: 'Une playlist avec ce nom existe déjà.' };
        }

        db.set(key, {
            name,
            owner: userId,
            songs: [],
            createdAt: Date.now(),
            public: false
        });

        // Ajouter à la liste des playlists de l'utilisateur
        const userPlaylists = db.get(`playlists_${userId}`) || [];
        userPlaylists.push(name.toLowerCase());
        db.set(`playlists_${userId}`, userPlaylists);

        return { ok: true };
    }

    /**
     * Ajoute une musique à une playlist
     */
    addToPlaylist(userId, playlistName, song) {
        const key = `playlist_${userId}_${playlistName.toLowerCase()}`;
        const playlist = db.get(key);

        if (!playlist) {
            return { ok: false, error: 'Playlist introuvable.' };
        }

        playlist.songs.push({
            title: song.title,
            url: song.url,
            duration: song.duration,
            addedAt: Date.now()
        });

        db.set(key, playlist);
        return { ok: true, count: playlist.songs.length };
    }

    /**
     * Retire une musique d'une playlist
     */
    removeFromPlaylist(userId, playlistName, index) {
        const key = `playlist_${userId}_${playlistName.toLowerCase()}`;
        const playlist = db.get(key);

        if (!playlist) {
            return { ok: false, error: 'Playlist introuvable.' };
        }

        if (index < 0 || index >= playlist.songs.length) {
            return { ok: false, error: 'Index invalide.' };
        }

        const removed = playlist.songs.splice(index, 1)[0];
        db.set(key, playlist);

        return { ok: true, removed, count: playlist.songs.length };
    }

    /**
     * Récupère une playlist
     */
    getPlaylist(userId, playlistName) {
        const key = `playlist_${userId}_${playlistName.toLowerCase()}`;
        return db.get(key);
    }

    /**
     * Liste toutes les playlists d'un utilisateur
     */
    getUserPlaylists(userId) {
        const playlistNames = db.get(`playlists_${userId}`) || [];
        return playlistNames.map(name => {
            const playlist = db.get(`playlist_${userId}_${name}`);
            return {
                name: playlist.name,
                songCount: playlist.songs.length,
                public: playlist.public,
                createdAt: playlist.createdAt
            };
        });
    }

    /**
     * Supprime une playlist
     */
    deletePlaylist(userId, playlistName) {
        const key = `playlist_${userId}_${playlistName.toLowerCase()}`;
        const playlist = db.get(key);

        if (!playlist) {
            return { ok: false, error: 'Playlist introuvable.' };
        }

        db.delete(key);

        // Retirer de la liste des playlists
        const userPlaylists = db.get(`playlists_${userId}`) || [];
        const filtered = userPlaylists.filter(n => n !== playlistName.toLowerCase());
        db.set(`playlists_${userId}`, filtered);

        return { ok: true };
    }

    /**
     * Rend une playlist publique/privée
     */
    togglePublic(userId, playlistName) {
        const key = `playlist_${userId}_${playlistName.toLowerCase()}`;
        const playlist = db.get(key);

        if (!playlist) {
            return { ok: false, error: 'Playlist introuvable.' };
        }

        playlist.public = !playlist.public;
        db.set(key, playlist);

        return { ok: true, public: playlist.public };
    }
}

// Instance singleton
const playlistManager = new PlaylistManager();

module.exports = playlistManager;
