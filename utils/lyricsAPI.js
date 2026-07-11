const lyricsFinder = require('lyrics-finder');
const logger = require('./logger');

/**
 * API pour récupérer les paroles de chansons
 */
class LyricsAPI {
    /**
     * Recherche les paroles d'une chanson
     * @param {string} query - Titre de la chanson (et artiste)
     * @returns {Promise<string|null>} - Les paroles ou null
     */
    async findLyrics(query) {
        try {
            // Nettoyer la requête (enlever (Official Video), [Lyrics], etc.)
            const cleanQuery = query
                .replace(/[\(\[](official|video|lyrics|audio|music|hd|4k|hq)[\)\]]/gi, '')
                .replace(/\s+/g, ' ')
                .trim();

            logger.info(`[LYRICS] Searching for: ${cleanQuery}`);

            const lyrics = await lyricsFinder(cleanQuery, '');

            if (!lyrics) {
                // Essayer de séparer artiste et titre si possible
                // Format commun: "Artiste - Titre"
                if (cleanQuery.includes('-')) {
                    const [artist, title] = cleanQuery.split('-').map(s => s.trim());
                    if (artist && title) {
                        return await lyricsFinder(artist, title);
                    }
                }
            }

            return lyrics || null;
        } catch (error) {
            logger.error('[LYRICS] Error finding lyrics:', error);
            return null;
        }
    }
}

module.exports = new LyricsAPI();
