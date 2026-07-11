const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Automates the upload of emojis from a local directory to the bot application.
 * @param {import('discord.js').Client} client 
 */
async function syncApplicationEmojis(client) {
    try {
        const emojiDir = client.config.SETTINGS?.EMOJI_DIR;
        if (!emojiDir || !fs.existsSync(emojiDir)) {
            logger.warn(`[EMOJI_SYNC] Dossier d'émojis introuvable : ${emojiDir}`);
            return;
        }

        logger.info(`[EMOJI_SYNC] Synchronisation des émojis pour ${client.user.tag}...`);

        // S'assurer que l'application est chargée
        if (!client.application) await client.application.fetch();

        // Récupérer les émojis d'application actuels
        const existingEmojis = await client.application.emojis.fetch();
        const existingNames = new Set(existingEmojis.map(e => e.name));

        const files = fs.readdirSync(emojiDir).filter(file =>
            file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.gif')
        );

        let uploadedCount = 0;
        for (const file of files) {
            const emojiName = path.parse(file).name;

            // Vérifier si l'émoji existe déjà par son nom
            if (existingNames.has(emojiName)) {
                continue;
            }

            try {
                const filePath = path.join(emojiDir, file);
                const buffer = fs.readFileSync(filePath);
                const base64 = `data:image/${path.extname(file).slice(1)};base64,${buffer.toString('base64')}`;

                await client.application.emojis.create({
                    attachment: base64,
                    name: emojiName
                });

                logger.info(`[EMOJI_SYNC] Émoji uploadé : ${emojiName}`);
                uploadedCount++;
            } catch (error) {
                logger.error(`[EMOJI_SYNC] Échec de l'upload pour ${emojiName} :`, error.message);
            }
        }

        if (uploadedCount > 0) {
            logger.info(`[EMOJI_SYNC] ${uploadedCount} émojis ajoutés pour ${client.user.tag}`);
        } else {
            logger.info(`[EMOJI_SYNC] Tous les émojis sont déjà à jour pour ${client.user.tag}`);
        }

    } catch (error) {
        logger.error(`[EMOJI_SYNC] Erreur critique lors de la synchronisation :`, error);
    }
}

module.exports = { syncApplicationEmojis };
