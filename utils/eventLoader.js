/**
 * eventLoader.js
 *
 * Charge tous les événements et les wraps automatiquement dans withGuildEmojis()
 * pour que les emojis personnalisés (+custemoji) soient actifs dans tous les events.
 *
 * La détection du guildId est automatique :
 *  - member.guild.id   (guildMemberAdd, guildMemberRemove)
 *  - guild.id          (guildCreate, guildDelete…)
 *  - message.guild.id  (messageDelete, messageUpdate…)
 *  - oldState.guild.id (voiceStateUpdate)
 *  - channel.guild.id  (channelCreate, channelDelete…)
 */

const fs     = require('fs');
const path   = require('path');
const logger = require('./logger');
const { withGuildEmojis } = require('./emojis');

// ── Déduplication globale des événements (partagée entre tous les clients) ──
if (!global._handledEvents) {
  global._handledEvents = new Set();
}

/**
 * Génère une clé unique pour un événement afin d'éviter
 * que les 40 bots traitent le même événement plusieurs fois.
 */
function resolveEventKey(eventName, args) {
  const first = args[0];
  if (!first || typeof first !== 'object') return null;

  // messageCreate / messageDelete / messageUpdate → clé sur message.id
  if (first.id && first.channel && first.author !== undefined) {
    return `${eventName}:${first.id}`;
  }
  // guildMemberAdd / guildMemberRemove → clé sur guild.id + member.id
  if (first.guild?.id && first.id && first.user !== undefined) {
    return `${eventName}:${first.guild.id}:${first.id}`;
  }
  // voiceStateUpdate (oldState, newState) — utilise le second arg
  const second = args[1];
  if (second?.guild?.id && second?.id) {
    return `${eventName}:${second.guild.id}:${second.id}:${Math.floor(Date.now() / 2000)}`;
  }
  // guildCreate / guildDelete → clé sur guild.id
  if (first.id && first.channels) {
    return `${eventName}:${first.id}:${Math.floor(Date.now() / 2000)}`;
  }
  return null;
}

// ── Détecte le guildId depuis les arguments de l'event ─────────────────────
function resolveGuildId(args) {
  for (const arg of args) {
    if (!arg || typeof arg !== 'object') continue;
    // Ordre de priorité : objets les plus courants d'abord
    if (arg.guild?.id)              return arg.guild.id;       // member, message, channel…
    if (arg.id && arg.channels)     return arg.id;             // Guild directement
    if (arg.guildId)                return arg.guildId;        // voiceState, etc.
    if (arg.guild instanceof Object && arg.guild.id) return arg.guild.id;
  }
  return null;
}

// ── Détecte le client depuis les arguments ──────────────────────────────────
function resolveClient(args, fallbackClient) {
  for (const arg of args) {
    if (!arg || typeof arg !== 'object') continue;
    if (arg.guild?.client) return arg.guild.client;
    if (arg.client)        return arg.client;
  }
  return fallbackClient;
}

// ── loadEvents ───────────────────────────────────────────────────────────────

async function loadEvents() {
  const stats = { loaded: 0, disabled: 0, errors: 0 };
  const eventsPath = path.join(__dirname, '..', 'events');

  try {
    const eventFolders = fs.readdirSync(eventsPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const folder of eventFolders) {
      const folderPath = path.join(eventsPath, folder);

      try {
        const eventFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));

        for (const file of eventFiles) {
          const filePath = path.join(folderPath, file);

          try {
            delete require.cache[require.resolve(filePath)];
            const eventHandler = require(filePath);

            if (typeof eventHandler !== 'function') { stats.disabled++; continue; }

            const eventName = eventHandler.eventName || folder;

            global.allClients.forEach((client, idx) => {
              if (!client) return;

              // ── Wrapper avec contexte emoji automatique ──────────────────
              const wrappedHandler = async (...args) => {
                try {
                  // Déduplication : un seul bot traite chaque événement
                  const eventKey = resolveEventKey(eventName, args);
                  if (eventKey) {
                    if (global._handledEvents.has(eventKey)) return;
                    global._handledEvents.add(eventKey);
                    setTimeout(() => global._handledEvents.delete(eventKey), 30000);
                  }

                  const guildId = resolveGuildId(args);
                  const cli     = resolveClient(args, client);

                  if (guildId) {
                    await withGuildEmojis(guildId, cli, () => eventHandler(client, ...args));
                  } else {
                    await eventHandler(client, ...args);
                  }
                } catch (error) {
                  logger.error(`[CLIENT ${idx}] Erreur dans ${eventName}/${file}:`, error);
                }
              };

              if (!client.eventHandlers)          client.eventHandlers = {};
              if (!client.eventHandlers[eventName]) client.eventHandlers[eventName] = [];
              client.eventHandlers[eventName].push(wrappedHandler);
              client.on(eventName, wrappedHandler);
              logger.debug(`[CLIENT ${idx}] Event ${eventName}/${file} enregistré (avec contexte emoji)`);
            });

            stats.loaded++;

          } catch (err) { logger.error(`Erreur chargement ${folder}/${file}:`, err); stats.errors++; }
        }
      } catch (err) { logger.error(`Erreur lecture dossier ${folder}:`, err); stats.errors++; }
    }

    logger.info(`Événements chargés: ${stats.loaded} loaded, ${stats.disabled} disabled, ${stats.errors} errors`);

  } catch (err) {
    logger.error('Erreur chargement événements:', err);
  }

  return stats;
}

// ── initClients ──────────────────────────────────────────────────────────────

async function initClients() {
  const loginWithRetry = async (client, token, idx) => {
    let attempt = 0;
    while (true) {
      try {
        attempt++;
        await client.login(token);
        logger.info(`[CLIENT ${idx}] Connexion réussie`);
        return;
      } catch (err) {
        const code = err?.code || err?.message || 'unknown';
        logger.error(`[CLIENT ${idx}] Échec connexion (essai ${attempt}): ${code}`);
        if (String(code).includes('TOKEN_INVALID') || String(code).includes('401')) { logger.error(`[CLIENT ${idx}] Token invalide. Abandon.`); return; }
        const backoff = Math.min(1000 * Math.pow(2, Math.min(attempt, 6)), 60000);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
  };

  await Promise.all(global.allClients.map((c, idx) => c?.botToken ? loginWithRetry(c, c.botToken, idx) : Promise.resolve()));
  logger.info('Tous les clients sont connectés');
}

// ── forceLoadWelcomeEvent ─────────────────────────────────────────────────────

function forceLoadWelcomeEvent() {
  try {
    const welcomeEventPath = path.join(__dirname, '..', 'events', 'guildMemberAdd', 'welcome.js');
    if (!fs.existsSync(welcomeEventPath)) { logger.error('welcome.js introuvable'); return false; }

    delete require.cache[require.resolve(welcomeEventPath)];
    const welcomeHandler = require(welcomeEventPath);
    if (typeof welcomeHandler !== 'function') { logger.error('welcome.js n\'exporte pas une fonction'); return false; }

    const welcomeCommand = global.allClients[0]?.commands?.get('welcome');
    if (!welcomeCommand?.handleMemberJoin) { logger.error('handleMemberJoin non trouvé'); return false; }

    let registered = 0;
    global.allClients.forEach((client, idx) => {
      if (!client) return;

      // Retirer anciens handlers
      if (client.eventHandlers?.['guildMemberAdd']) {
        client.eventHandlers['guildMemberAdd'].forEach(h => client.off('guildMemberAdd', h));
        client.eventHandlers['guildMemberAdd'] = [];
      }

      // ── Wrapper avec contexte emoji + déduplication ──────────────────────
      const wrappedHandler = async (member) => {
        try {
          const eventKey = `guildMemberAdd:${member.guild.id}:${member.id}`;
          if (global._handledEvents.has(eventKey)) return;
          global._handledEvents.add(eventKey);
          setTimeout(() => global._handledEvents.delete(eventKey), 30000);

          await withGuildEmojis(member.guild.id, client, () => welcomeHandler(client, member));
        } catch (err) {
          logger.error(`[CLIENT ${idx}] Erreur guildMemberAdd/welcome:`, err);
        }
      };

      if (!client.eventHandlers)                client.eventHandlers = {};
      if (!client.eventHandlers['guildMemberAdd']) client.eventHandlers['guildMemberAdd'] = [];
      client.eventHandlers['guildMemberAdd'].push(wrappedHandler);
      client.on('guildMemberAdd', wrappedHandler);
      registered++;
    });

    logger.info(`Événement welcome enregistré sur ${registered} client(s) (avec contexte emoji)`);
    return true;

  } catch (err) {
    logger.error('Erreur forceLoadWelcomeEvent:', err);
    return false;
  }
}

module.exports = { loadEvents, initClients, forceLoadWelcomeEvent };
