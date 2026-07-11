const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const EXPIRATIONS_PATH = path.resolve(__dirname, '../data/buyer_expirations.json');
const CONFIG_PATH = path.resolve(__dirname, '../config.json');
const BUYERS_PATH = path.resolve(__dirname, '../data/buyers.json');

let checkInterval = null;

/**
 * Démarre le vérificateur d'expiration des buyers
 * Vérifie toutes les 1 minute si des tokens ont expiré
 */
function startExpirationChecker(client) {
    if (checkInterval) {
        logger.info('[BUYER-EXPIRATION] Checker déjà démarré, ignoré');
        return;
    }

    logger.info('[BUYER-EXPIRATION] Démarrage du vérificateur d\'expiration...');

    // Vérifier toutes les 1 minute (60000 ms)
    checkInterval = setInterval(() => {
        checkExpirations(client);
    }, 60 * 1000);

    // Première vérification immédiate
    checkExpirations(client);
}

/**
 * Arrête le vérificateur d'expiration
 */
function stopExpirationChecker() {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
        logger.info('[BUYER-EXPIRATION] Vérificateur arrêté');
    }
}

/**
 * Vérifie les expirations et retire les tokens expirés
 */
async function checkExpirations(client) {
    try {
        // Créer le fichier s'il n'existe pas
        if (!fs.existsSync(EXPIRATIONS_PATH)) {
            const dir = path.dirname(EXPIRATIONS_PATH);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(EXPIRATIONS_PATH, '{}', 'utf8');
            return;
        }

        const expirations = JSON.parse(fs.readFileSync(EXPIRATIONS_PATH, 'utf8'));
        const now = Date.now();
        let hasChanges = false;
        let expiredCount = 0;

        for (const [token, data] of Object.entries(expirations)) {
            // Vérifier si le token a expiré
            if (data.expiresAt && now >= data.expiresAt) {
                logger.info(`[BUYER-EXPIRATION] Token expiré détecté pour l'utilisateur ${data.userId}`);

                // Retirer le token expiré
                await removeExpiredToken(token, data, client);
                delete expirations[token];
                hasChanges = true;
                expiredCount++;
            }
        }

        // Sauvegarder les changements
        if (hasChanges) {
            fs.writeFileSync(EXPIRATIONS_PATH, JSON.stringify(expirations, null, 2), 'utf8');
            logger.info(`[BUYER-EXPIRATION] ${expiredCount} token(s) expiré(s) retiré(s)`);
        }
    } catch (error) {
        logger.error('[BUYER-EXPIRATION] Erreur lors de la vérification:', error);
    }
}

/**
 * Retire un token expiré de tous les fichiers
 */
async function removeExpiredToken(token, data, client) {
    try {
        let configUpdated = false;
        let buyersUpdated = false;

        // 1. Retirer de config.json
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

                if (Array.isArray(config.DISCORD?.TOKEN)) {
                    const initialLength = config.DISCORD.TOKEN.length;
                    config.DISCORD.TOKEN = config.DISCORD.TOKEN.filter(t => t !== token);

                    if (config.DISCORD.TOKEN.length < initialLength) {
                        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
                        configUpdated = true;
                        logger.info(`[BUYER-EXPIRATION] Token retiré de config.json`);
                    }
                }
            }
        } catch (error) {
            logger.error('[BUYER-EXPIRATION] Erreur lors du retrait du token de config.json:', error);
        }

        // 2. Retirer de buyers.json
        try {
            if (fs.existsSync(BUYERS_PATH)) {
                const buyers = JSON.parse(fs.readFileSync(BUYERS_PATH, 'utf8'));

                if (buyers[data.userId]) {
                    if (Array.isArray(buyers[data.userId])) {
                        const initialLength = buyers[data.userId].length;
                        buyers[data.userId] = buyers[data.userId].filter(t => t !== token);

                        // Si plus de tokens, supprimer l'entrée complète
                        if (buyers[data.userId].length === 0) {
                            delete buyers[data.userId];
                        }

                        if (buyers[data.userId]?.length < initialLength || !buyers[data.userId]) {
                            buyersUpdated = true;
                        }
                    } else if (buyers[data.userId] === token) {
                        delete buyers[data.userId];
                        buyersUpdated = true;
                    }

                    if (buyersUpdated) {
                        fs.writeFileSync(BUYERS_PATH, JSON.stringify(buyers, null, 2), 'utf8');
                        logger.info(`[BUYER-EXPIRATION] Token retiré de buyers.json`);
                    }
                }
            }
        } catch (error) {
            logger.error('[BUYER-EXPIRATION] Erreur lors du retrait du token de buyers.json:', error);
        }

        // 3. Notifier l'utilisateur (optionnel)
        try {
            if (client && data.userId) {
                const user = await client.users.fetch(data.userId).catch(() => null);
                if (user) {
                    const expirationDate = new Date(data.expiresAt).toLocaleString('fr-FR');
                    await user.send(
                        `⏰ **Expiration de votre bot**\n\n` +
                        `Votre bot a expiré le ${expirationDate}.\n` +
                        `Durée : ${data.duration}\n` +
                        `Le token a été automatiquement retiré du système.`
                    ).catch(() => {
                        logger.warn(`[BUYER-EXPIRATION] Impossible d'envoyer un MP à l'utilisateur ${data.userId}`);
                    });
                }
            }
        } catch (error) {
            logger.warn('[BUYER-EXPIRATION] Erreur lors de la notification:', error);
        }

        logger.info(
            `[BUYER-EXPIRATION] <a:_:1483497369315315786> Token expiré retiré avec succès` +
            `\n  - Utilisateur: ${data.userId}` +
            `\n  - Durée: ${data.duration}` +
            `\n  - Config mis à jour: ${configUpdated}` +
            `\n  - Buyers mis à jour: ${buyersUpdated}`
        );

    } catch (error) {
        logger.error('[BUYER-EXPIRATION] Erreur lors de la suppression du token expiré:', error);
    }
}

/**
 * Charge les expirations depuis le fichier
 */
function loadExpirations() {
    try {
        if (!fs.existsSync(EXPIRATIONS_PATH)) {
            const dir = path.dirname(EXPIRATIONS_PATH);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(EXPIRATIONS_PATH, '{}', 'utf8');
            return {};
        }
        return JSON.parse(fs.readFileSync(EXPIRATIONS_PATH, 'utf8'));
    } catch (error) {
        logger.error('[BUYER-EXPIRATION] Erreur lors du chargement des expirations:', error);
        return {};
    }
}

/**
 * Sauvegarde les expirations dans le fichier
 */
function saveExpirations(expirations) {
    try {
        const dir = path.dirname(EXPIRATIONS_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(EXPIRATIONS_PATH, JSON.stringify(expirations, null, 2), 'utf8');
        return true;
    } catch (error) {
        logger.error('[BUYER-EXPIRATION] Erreur lors de la sauvegarde des expirations:', error);
        return false;
    }
}

module.exports = {
    startExpirationChecker,
    stopExpirationChecker,
    checkExpirations,
    loadExpirations,
    saveExpirations
};
