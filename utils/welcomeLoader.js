const fs     = require('fs');
const path   = require('path');
const logger = require('./utils/logger');
const { withGuildEmojis } = require('./utils/emojis');

/**
 * Charge l'événement welcome sur tous les clients.
 * Wraps chaque appel dans withGuildEmojis() pour que les emojis
 * personnalisés via +custemoji soient actifs pendant les messages de bienvenue.
 */
function loadWelcomeEventSimple() {
  try {
    logger.info('[WELCOME] Chargement de l\'événement welcome...');

    const welcomeEventPath = path.join(__dirname, 'events', 'guildMemberAdd', 'welcome.js');

    if (!fs.existsSync(welcomeEventPath)) {
      logger.warn('[WELCOME] Fichier welcome.js introuvable');
      return false;
    }

    delete require.cache[require.resolve(welcomeEventPath)];
    const welcomeHandler = require(welcomeEventPath);

    if (typeof welcomeHandler !== 'function') {
      logger.error('[WELCOME] welcome.js n\'exporte pas une fonction');
      return false;
    }

    const client = global.allClients[0];
    if (!client) {
      logger.error('[WELCOME] Aucun client disponible');
      return false;
    }

    const welcomeCommand = client.commands?.get('welcome');
    if (!welcomeCommand?.handleMemberJoin) {
      logger.warn('[WELCOME] handleMemberJoin non trouvé dans la commande welcome');
      return false;
    }

    let registered = 0;
    global.allClients.forEach((c, idx) => {
      if (!c?.isReady?.()) return;

      const wrappedHandler = async (member) => {
        try {
          // Déduplication cross-clients : un seul bot traite le welcome
          const dedupKey = `guildMemberAdd:${member.guild.id}:${member.id}`;
          if (global._handledEvents && global._handledEvents.has(dedupKey)) return;
          if (global._handledEvents) {
            global._handledEvents.add(dedupKey);
            setTimeout(() => global._handledEvents.delete(dedupKey), 30000);
          }

          await withGuildEmojis(member.guild.id, c, async () => {
            await welcomeHandler(c, member);
          });
        } catch (error) {
          logger.error(`[CLIENT ${idx}] Erreur dans guildMemberAdd/welcome:`, error);
        }
      };

      c.on('guildMemberAdd', wrappedHandler);
      registered++;
      logger.info(`[CLIENT ${idx}] Événement guildMemberAdd/welcome enregistré (avec contexte emoji)`);
    });

    if (registered > 0) {
      logger.info(`[WELCOME] Enregistré sur ${registered} client(s)`);
      return true;
    }

    logger.warn('[WELCOME] Aucun client prêt');
    return false;

  } catch (error) {
    logger.error('[WELCOME] Erreur lors du chargement:', error);
    return false;
  }
}

module.exports = { loadWelcomeEventSimple };
