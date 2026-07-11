let ReadableStream;
try {
  ({ ReadableStream } = require('stream/web'));
} catch (e) {

}
const ms = require("ms");
const config = require('./config.json');
const logger = require('./utils/logger');
const Discord = require('discord.js');
const db = require('./utils/simpledb');
const { emojiContext } = require('./utils/emojis');
const { syncApplicationEmojis } = require('./utils/emojiUploader');
const { startTRPScheduler } = require('./util/gestion/trpScheduler');
const { startTeamPayrollScheduler } = require('./util/gestion/teamPayrollScheduler');
const { initializeTempVoice } = require('./commands/gestion/tempvoc');
const fs = require('fs');
const path = require('path');
const { initStatsInterval } = require('./util/stats/statsManager');

// Le welcome sera chargé après que les clients soient prêts


class CreditLevelSystem {
  static #key(guildId, userId) {
    return `credits_${guildId}_${userId}`;
  }
  static getUserCredits(userId, guildId) {
    try {
      return db.get(this.#key(guildId, userId)) || 0;
    } catch (_) {
      return 0;
    }
  }
  static setUserCredits(userId, guildId, amount) {
    try {
      db.set(this.#key(guildId, userId), Number(amount) || 0);
      return this.getUserCredits(userId, guildId);
    } catch (_) {
      return 0;
    }
  }
  static addUserCredits(userId, guildId, delta) {
    const current = this.getUserCredits(userId, guildId);
    return this.setUserCredits(userId, guildId, current + (Number(delta) || 0));
  }
}


if (ReadableStream && !globalThis.ReadableStream) {
  globalThis.ReadableStream = ReadableStream;
}
if (!globalThis.DOMException) {
  globalThis.DOMException = class DOMException extends Error {
    constructor(message, name) {
      super(message);
      this.name = name || 'Error';
    }
  };
}


process.on('uncaughtException', (error) => {
  logger.error('=== ERREUR NON CAPTURÉE ===');
  logger.error(`Message: ${error.message}`);
  logger.error(`Code: ${error.code || 'N/A'}`);
  logger.error(`Stack: ${error.stack || 'Non disponible'}`);


  switch (error.code) {
    case 'ECONNRESET':
      logger.warn('Connexion réinitialisée par le serveur, tentative de reconnexion...');
      break;
    case 'ETIMEDOUT':
      logger.warn('Délai de connexion dépassé, nouvelle tentative...');
      break;
    case 'ECONNREFUSED':
      logger.error('Connexion refusée par le serveur. Vérifiez votre connexion Internet.');
      break;
    default:
      logger.error('Erreur inattendue, redémarrage du processus...');
      process.exit(1);
  }


  if (error.response) {
    logger.error('Détails de la réponse:', {
      status: error.response.status,
      data: error.response.data,
      headers: error.response.headers
    });
  }
});


process.on('unhandledRejection', (reason, promise) => {
  logger.error('=== REJET DE PROMESSE NON GÉRÉ ===');

  if (reason instanceof Error) {
    logger.error(`Message: ${reason.message}`);
    logger.error(`Stack: ${reason.stack}`);


    if (reason.code === 'TOKEN_INVALID') {
      logger.error('ERREUR CRITIQUE: Token Discord invalide. Vérifiez votre configuration.');
      process.exit(1);
    }
  } else {
    logger.error('Raison du rejet:', reason);
  }


  logger.error('Promesse rejetée:', {
    promise,
    reason: reason.toString()
  });
});


process.on('warning', (warning) => {

  const ignoredWarnings = [
    'DEP_WEBPACK_RULE_LOADER_OPTIONS_OBJECT',
    'DEP_WEBPACK_CHUNK_HAS_ENTRY_MODULE',
    'DEP_WEBPACK_COMPILATION_ASSETS'];


  if (ignoredWarnings.some((w) => warning.name.includes(w))) {
    return;
  }

  logger.warn(`=== AVERTISSEMENT (${warning.name}) ===`);
  logger.warn(`Message: ${warning.message}`);


  if (warning.stack) {
    logger.warn('Stack:', warning.stack);
  }


  if (warning.code === 'DEPRECATION_WARNING') {
    logger.warn('Ceci est une fonctionnalité dépréciée qui sera supprimée dans une future version.');
  }
});


const shutdown = async (signal) => {
  logger.info(`Reçu le signal ${signal}. Arrêt en cours...`);

  try {

    await Promise.all(clients.map((client) => {
      if (client && client.destroy) {
        logger.info(`Déconnexion du client ${client.user?.tag || 'inconnu'}`);
        return client.destroy();
      }
      return Promise.resolve();
    }));

    logger.info('Tous les clients ont été déconnectés avec succès');
    process.exit(0);
  } catch (error) {
    logger.error('Erreur lors de la fermeture propre:', error);
    process.exit(1);
  }
};


['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) => {
  process.on(signal, () => shutdown(signal));
});


// Priorité : variables d'environnement > config.json DISCORD.TOKEN
// DISCORD_TOKEN supporte plusieurs tokens séparés par virgule : token1,token2,token3
const envTokens = process.env.DISCORD_TOKEN
  ? process.env.DISCORD_TOKEN.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
  : [];

// Support de DISCORD_TOKEN_1, DISCORD_TOKEN_2, ... DISCORD_TOKEN_9
const extraEnvTokens = [];
for (let i = 1; i <= 9; i++) {
  const t = process.env[`DISCORD_TOKEN_${i}`]?.trim();
  if (t) extraEnvTokens.push(t);
}

const configTokens = Array.isArray(config.DISCORD?.TOKEN)
  ? config.DISCORD.TOKEN.map((t) => String(t || '').trim()).filter((t) => t.length > 0)
  : config.DISCORD?.TOKEN
    ? [String(config.DISCORD.TOKEN).trim()].filter((t) => t.length > 0)
    : [];

const allTokenSources = [...envTokens, ...extraEnvTokens, ...configTokens];

if (!allTokenSources.length) {
  logger.error('Aucun token Discord trouvé. Définissez DISCORD_TOKEN dans les secrets Replit.');
  process.exit(1);
}

const rawTokens = allTokenSources;

if (!rawTokens.length) {
  logger.error('Aucun token Discord valide trouvé dans la configuration');
  process.exit(1);
}

// Deduplication des tokens par ID de bot
const uniqueTokensMap = new Map();
const normalizedTokens = [];
const duplicateTokens = [];
const invalidTokens = [];

for (const token of rawTokens) {
  try {
    const parts = token.split('.');
    if (parts.length < 3) {
      invalidTokens.push(token);
      logger.warn(`[CONFIG] Token invalide (format incorrect): ${token.substring(0, 15)}...`);
      continue;
    }
    
    const id = Buffer.from(parts[0], 'base64').toString('ascii');

    if (uniqueTokensMap.has(id)) {
      duplicateTokens.push(token);
      logger.warn(`[CONFIG] ⚠️ Doublon détecté pour le bot ID ${id}. Le token sera ignoré.`);
      logger.warn(`[CONFIG] Token dupliqué: ${token.substring(0, 15)}...`);
    } else {
      uniqueTokensMap.set(id, token);
    }
  } catch (e) {
    invalidTokens.push(token);
    logger.warn(`[CONFIG] ❌ Impossible de décoder l'ID du token: ${token.substring(0, 15)}...`);
    logger.warn(`[CONFIG] Erreur: ${e.message}`);
  }
}

// Convertir la map en tableau
normalizedTokens.push(...uniqueTokensMap.values());

// Nettoyer automatiquement le config.json si des doublons ou tokens invalides sont détectés
if (duplicateTokens.length > 0 || invalidTokens.length > 0) {
  try {
    const fs = require('fs');
    const configPath = path.join(__dirname, 'config.json');
    const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (Array.isArray(currentConfig.DISCORD?.TOKEN)) {
      const originalLength = currentConfig.DISCORD.TOKEN.length;
      // Filtrer les doublons et tokens invalides
      currentConfig.DISCORD.TOKEN = currentConfig.DISCORD.TOKEN.filter(token => {
        return !duplicateTokens.includes(token) && !invalidTokens.includes(token);
      });
      
      if (currentConfig.DISCORD.TOKEN.length < originalLength) {
        fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf8');
        logger.info(`[CONFIG] ✅ config.json nettoyé: ${originalLength - currentConfig.DISCORD.TOKEN.length} token(s) supprimé(s) (${duplicateTokens.length} doublon(s), ${invalidTokens.length} invalide(s))`);
      }
    }
  } catch (error) {
    logger.error(`[CONFIG] ❌ Erreur lors du nettoyage de config.json:`, error);
  }
}

if (duplicateTokens.length > 0) {
  logger.warn(`[CONFIG] ⚠️ ${duplicateTokens.length} token(s) en doublon détecté(s) et ignoré(s)`);
}
if (invalidTokens.length > 0) {
  logger.warn(`[CONFIG] ⚠️ ${invalidTokens.length} token(s) invalide(s) détecté(s) et ignoré(s)`);
}

logger.info(`[CONFIG] ✅ ${normalizedTokens.length} token(s) Discord unique(s) chargé(s) (sur ${rawTokens.length} entrées)`);


const clients = normalizedTokens.map((token, index) => {
  const client = new Discord.Client({
    intents: [
      Discord.GatewayIntentBits.Guilds,
      Discord.GatewayIntentBits.GuildMessages,
      Discord.GatewayIntentBits.GuildMembers,
      Discord.GatewayIntentBits.GuildVoiceStates,
      Discord.GatewayIntentBits.GuildMessageReactions,
      Discord.GatewayIntentBits.GuildInvites,
      Discord.GatewayIntentBits.DirectMessages,
      Discord.GatewayIntentBits.MessageContent,
      Discord.GatewayIntentBits.GuildPresences],

    partials: [Discord.Partials.Message, Discord.Partials.Channel, Discord.Partials.Reaction]
  });


  client.botToken = token;

  client.botStats = { startTime: Date.now() };
  if (!client.CreditLevelSystem) {
    client.CreditLevelSystem = CreditLevelSystem;
  }

  return client;
});

globalThis.allClients = clients;
let pm2ReadySent = false;

const { createIsResponsibleForGuild } = require('./utils/responsibility');


const delay = (ms) => new Promise((res) => setTimeout(res, ms));
async function loginWithRetry(client, token, idx) {
  let attempt = 0;
  const maxDelay = 60_000;
  const maxAttempts = 5; // Limiter les tentatives pour éviter les boucles infinies
  
  // Extraire l'ID du bot depuis le token pour le logging
  let botId = 'unknown';
  try {
    const parts = token.split('.');
    if (parts.length >= 1) {
      botId = Buffer.from(parts[0], 'base64').toString('ascii');
    }
  } catch (e) {
    // Ignorer
  }
  
  while (attempt < maxAttempts) {
    try {
      attempt++;
      logger.info(`[CLIENT ${idx}] Tentative de connexion (essai ${attempt}/${maxAttempts}) - Bot ID: ${botId}...`);
      await client.login(token);
      
      // Attendre un peu pour que le client soit complètement initialisé
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (client.user) {
        logger.info(`[CLIENT ${idx}] ✅ Connexion réussie - Bot: ${client.user.tag} (${client.user.id})`);
      } else {
        logger.warn(`[CLIENT ${idx}] ⚠️ Connexion réussie mais client.user est null`);
      }
      return;
    } catch (error) {
      const code = error?.code || error?.message || 'unknown';
      const errorMessage = error?.message || String(error);
      logger.error(`[CLIENT ${idx}] ❌ Échec de la connexion (essai ${attempt}/${maxAttempts}) - Bot ID: ${botId}`);
      logger.error(`[CLIENT ${idx}] Code d'erreur: ${code}`);
      logger.error(`[CLIENT ${idx}] Message: ${errorMessage}`);
      if (error.stack) {
        logger.error(`[CLIENT ${idx}] Stack: ${error.stack.substring(0, 500)}`);
      }

      const codeStr = String(code);
      if (code === 'TOKEN_INVALID' || codeStr.includes('TokenInvalid') || codeStr.includes('TOKEN_INVALID') || codeStr.includes('401') || codeStr.includes('Unauthorized')) {
        logger.error(`[CLIENT ${idx}] Token invalide ou non autorisé. Abandon du retry pour ce client.`);
        return;
      }
      // Si c'est une erreur de rate limit ou de connexion, réessayer
      if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || codeStr.includes('50001') || codeStr.includes('50035')) {
        const backoff = Math.min(1000 * Math.pow(2, Math.min(attempt, 6)), maxDelay);
        logger.info(`[CLIENT ${idx}] Nouvelle tentative dans ${Math.round(backoff / 1000)}s...`);
        await delay(backoff);
      } else {
        // Pour les autres erreurs, abandonner après quelques tentatives
        logger.error(`[CLIENT ${idx}] Erreur non récupérable: ${code}. Abandon après ${attempt} tentative(s).`);
        return;
      }
    }
  }
  
  logger.error(`[CLIENT ${idx}] ❌ Échec de la connexion après ${maxAttempts} tentatives. Le client ne sera pas utilisé.`);
}


const initClients = async () => {
  const loadCommand = (client, commandPath) => {
    try {
      const command = require(commandPath);
      if (command.name && !client.commands.has(command.name)) {
        client.commands.set(command.name, command);
        if (command.aliases && Array.isArray(command.aliases)) {
          command.aliases.forEach((alias) => {
            if (!client.aliases.has(alias)) {
              client.aliases.set(alias, command);
            }
          });
        }
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Erreur lors du chargement de la commande ${commandPath}:`, error);
      return false;
    }
  };

  for (let idx = 0; idx < clients.length; idx++) {
    const client = clients[idx];
    try {
      client.config = config;
      client.db = db;
      client.cooldown = [];
      client.interactions = new Map();
      client.guildInvites = new Map();
      client.queue = new Map();
      client.snipes = new Map();
      client.inter = [];
      client.clientIndex = idx;
      client.totalClients = clients.length;
      if (!client.commands) client.commands = new Discord.Collection();
      if (!client.aliases) client.aliases = new Discord.Collection();


      // La propriété isCommandHandler sera re-calculée une fois les clients connectés
      // pour s'assurer qu'au moins un client actif prend ce rôle
      client.isCommandHandler = false;

      // Attribution STABLE (voir utils/responsibility.js) ; utilise globalThis.allClients pour inclure les bots ajoutés via reloadbuyers
      client.isResponsibleForGuild = createIsResponsibleForGuild(client, clients);

      client.on('error', (e) => logger.error(`[CLIENT ${idx}] error:`, e));
      client.on('shardError', async (e) => {
        logger.error(`[CLIENT ${idx}] shardError:`, e);
        try {
          await restartClient(client);
        } catch (_) { }
      });
      client.on('invalidated', () => logger.error(`[CLIENT ${idx}] session invalidated`));

      client.once('ready', async () => {
        const botName = client.user?.tag || 'Unknown';
        const botId = client.user?.id || 'Unknown';
        console.log(`[CLIENT ${idx}] ✅ Connecté en tant que ${botName} (ID: ${botId})`);
        logger.info(`[CLIENT ${idx}] ✅ Connecté en tant que ${botName} (ID: ${botId})`);
        
        // Test: vérifier que les événements sont bien écoutés
        const listenerCount = client.listenerCount('messageCreate');
        console.log(`[CLIENT ${idx}] Nombre de listeners messageCreate: ${listenerCount}`);

        // Enregistrer le gestionnaire messageCreate APRÈS que le client soit prêt
        try {
          const messageCreatePath = path.join(__dirname, 'events', 'client', 'messageCreate.js');
          delete require.cache[require.resolve(messageCreatePath)];
          const messageCreateHandler = require(messageCreatePath);
          
          if (typeof messageCreateHandler === 'function') {
            // Retirer TOUS les anciens gestionnaires messageCreate pour éviter les doublons
            const oldListenerCount = client.listenerCount('messageCreate');
            if (oldListenerCount > 0) {
              logger.warn(`[CLIENT ${idx}] ⚠️ Retrait de ${oldListenerCount} ancien(s) gestionnaire(s) messageCreate avant enregistrement`);
              client.removeAllListeners('messageCreate');
            }
            
            // Compteur de diagnostic (premiers messages pour voir si le bot reçoit bien les events)
            let debugMsgCount = 0;
            const DEBUG_LOG_MAX = 15;

            const wrappedHandler = async (message) => {
              try {
                // Ignorer les bots
                if (message.author?.bot) return;

                // Déduplication : un seul bot traite chaque message
                const msgKey = `messageCreate:${message.id}`;
                if (global._handledEvents && global._handledEvents.has(msgKey)) return;
                if (global._handledEvents) {
                  global._handledEvents.add(msgKey);
                  setTimeout(() => global._handledEvents.delete(msgKey), 30000);
                }

                debugMsgCount++;
                if (debugMsgCount <= DEBUG_LOG_MAX) {
                  console.log(`[MSG-RECU] ${botName} (client ${idx}) a reçu un message dans ${message.guild?.name || 'DM'} de ${message.author?.tag || '?'}`);
                  console.log(`[MSG-TRAITE] ${botName} traite le message (handler appelé)`);
                }

                await messageCreateHandler(client, message);
              } catch (error) {
                logger.error(`[CLIENT ${idx}][HANDLER] Erreur:`, error);
                logger.error(`[CLIENT ${idx}][HANDLER] Stack:`, error.stack);
              }
            };
            
            // Enregistrer le gestionnaire
            client.on('messageCreate', wrappedHandler);
            const finalListenerCount = client.listenerCount('messageCreate');
            console.log(`[CLIENT ${idx}] ✅ Gestionnaire messageCreate enregistré pour ${botName} (${client.commands?.size || 0} commandes, ${finalListenerCount} listeners)`);
            logger.info(`[CLIENT ${idx}] ✅ Gestionnaire messageCreate enregistré pour ${botName} (${client.commands?.size || 0} commandes, ${finalListenerCount} listeners)`);
            
            // Test: envoyer un message de test pour vérifier que l'événement fonctionne
            if (finalListenerCount === 0) {
              console.error(`[CLIENT ${idx}] ❌ ERREUR: Aucun listener messageCreate enregistré!`);
              logger.error(`[CLIENT ${idx}] ❌ ERREUR: Aucun listener messageCreate enregistré!`);
            }
          } else {
            logger.error(`[CLIENT ${idx}] ❌ Le handler messageCreate n'est pas une fonction`);
          }
        } catch (error) {
          logger.error(`[CLIENT ${idx}] ❌ Erreur lors de l'enregistrement du gestionnaire dans ready:`, error);
          logger.error(`[CLIENT ${idx}] Stack:`, error.stack);
        }

        // Enregistrement des commandes slash (OSINT + /ghost + /confess) pour ce client
        try {
          const { REST, Routes } = require('discord.js');
          const { getOsintSlashCommandsJson } = require('./utils/osintSlashCommands');
          const ghostCommand   = require('./commands/admin/ghost');
          const confessCommand = require('./commands/fun/confess');
          const token = client.token || client.botToken;
          if (token && client.user?.id) {
            const rest = new REST().setToken(token);
            const osintBody   = getOsintSlashCommandsJson();
            const ghostJson   = ghostCommand.data.toJSON();
            const confessJson = confessCommand.data.toJSON();
            const body = [...osintBody, ghostJson, confessJson];
            await rest.put(Routes.applicationCommands(client.user.id), { body });
            logger.info(`[CLIENT ${idx}] ${body.length} commande(s) slash enregistrée(s) (OSINT + /ghost + /confess).`);
          }
        } catch (slashErr) {
          logger.warn(`[CLIENT ${idx}] Slash commands non enregistrées:`, slashErr.message);
        }

        // Démarrage automatique du rotateur de statuts si configuré et actif
        try {
          const { startRotation } = require('./commands/owner/statut');
          const botIdCurrent = client.user?.id;
          if (botIdCurrent && db.get(`statut_active_${botIdCurrent}`)) {
            const statList = db.get(`statut_list_${botIdCurrent}`) || [];
            if (statList.length) {
              startRotation(client);
              logger.info(`[CLIENT ${idx}] ✅ Statut Rotator démarré (${statList.length} statut(s))`);
            }
          }
        } catch (e) {
          logger.warn(`[CLIENT ${idx}] Statut Rotator non démarré:`, e.message);
        }

        // LOGIQUE D'ATTRIBUTION DU RÔLE DE COMMAND HANDLER
        // Le premier client (dans l'ordre du tableau) qui est PRÊT devient le gestionnaire
        const firstReadyClient = clients.find(c => c.readyAt);
        if (firstReadyClient === client) {
          client.isCommandHandler = true;
          logger.info(`[CLIENT ${idx}] DESIGNATED COMMAND HANDLER`);

          // Chargement des commandes spécifiques au gestionnaire
          loadCommand(client, './commands/gestion/soutien');
          loadCommand(client, './commands/gestion/welcome');
          loadCommand(client, './commands/gestion/ticket');

          try {
            await startTRPScheduler(client);
            logger.info(`[CLIENT ${idx}] TRP scheduler started`);
          } catch (e) {
            logger.error(`[CLIENT ${idx}] Failed to start TRP scheduler`, e);
          }

          try {
            await startTeamPayrollScheduler(client);
            logger.info(`[CLIENT ${idx}] Team payroll scheduler started`);
          } catch (e) {
            logger.error(`[CLIENT ${idx}] Failed to start Team payroll scheduler`, e);
          }

          // Démarrer le vérificateur d'expiration des buyers
          try {
            const { startExpirationChecker } = require('./utils/buyerExpirationChecker');
            startExpirationChecker(client);
            logger.info(`[CLIENT ${idx}] Buyer expiration checker started`);
          } catch (e) {
            logger.error(`[CLIENT ${idx}] Failed to start buyer expiration checker`, e);
          }
        }

        try {
          await client.user.setPresence({
            activities: [{
              name: `sur ${client.guilds.cache.size} serveurs | ${client.config.prefix}help`,
              type: Discord.ActivityType.Watching
            }],
            status: 'online'
          });
        } catch (e) {
          logger.error(`[CLIENT ${idx}] Failed to set presence:`, e);
        }


        if (!pm2ReadySent && process.env.PM2 === 'true' && typeof process.send === 'function') {
          try {
            process.send('ready');
            pm2ReadySent = true;
            logger.info('[PM2] Signal ready envoyé');
          } catch (e) {
            logger.warn('[PM2] Échec lors de l\'envoi du signal ready:', e);
          }
        }

        // Synchronisation des émojis
        syncApplicationEmojis(client).catch(err => logger.error(`[CLIENT ${idx}] Echec sync emojis:`, err));
      });

    } catch (error) {
      logger.error(`[CLIENT ${idx}] Erreur lors de l'initialisation:`, error);
    }
  }

  // Connexion de tous les bots en parallèle avec un petit écart de 300ms entre chaque
  logger.info(`[INIT] Connexion de ${clients.length} bots en parallèle...`);
  await Promise.allSettled(clients.map(async (client, idx) => {
    try {
      const token = normalizedTokens[idx];
      if (!token) {
        logger.error(`[CLIENT ${idx}] Aucun token disponible`);
        return;
      }
      // Petit écart pour éviter les rate-limits Discord (300ms entre chaque)
      await delay(idx * 300);
      await loginWithRetry(client, token, idx);
    } catch (error) {
      logger.error(`[CLIENT ${idx}] Échec de connexion:`, error);
    }
  }));
  logger.info(`[INIT] Tous les bots ont tenté de se connecter.`);
};


class MessageCache {
  constructor(ttl = 30000, cleanupInterval = 60000) {
    this.cache = new Map();
    this.ttl = ttl;
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupInterval);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
  
  // Méthode pour vérifier et définir de manière atomique (évite les race conditions)
  checkAndSet(key, value) {
    if (this.has(key)) {
      return false; // Déjà présent
    }
    this.set(key, value);
    return true; // Défini avec succès
  }

  set(key, value) {
    this.cache.set(key, {
      data: value,
      expires: Date.now() + this.ttl
    });
    return true;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;


    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    return this.cache.delete(key);
  }

  cleanup() {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, { expires }] of this.cache.entries()) {
      if (now > expires) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.debug(`Nettoyage du cache: ${deletedCount} messages expirés supprimés`);
    }

    return deletedCount;
  }

  get size() {
    return this.cache.size;
  }
}


const globalProcessedMessages = new MessageCache(30000);

// Cache global unifié pour tous les gestionnaires
global.globalProcessedMessages = globalProcessedMessages;

// Set global de déduplication — partagé entre tous les 40 clients (même process Node)
// Empêche qu'un même événement soit traité plusieurs fois par des bots différents
if (!global._handledEvents) {
  global._handledEvents = new Set();
}

// Exporter MessageCache pour utilisation dans d'autres modules (si nécessaire)
// Note: Éviter les dépendances circulaires, le cache est déjà dans global
if (typeof module !== 'undefined' && module.exports) {
  module.exports.MessageCache = MessageCache;
}






const loadEvents = async (dir = './events') => {
  logger.info(`Chargement des événements depuis: ${dir}`);


  // IMPORTANT: Désactiver tous les gestionnaires messageCreate SAUF celui du client
  // pour éviter les doublons de réponses
  const disabledHandlers = new Set([
    'events/levels/messageCreate.js',     // Désactivé - système XP géré séparément
    'events/autorank/messageCreate.js',   // Désactivé - autorank géré séparément
    'events/rank/message.js',             // Obsolète
    'events/logs/messageCreate.js'        // Désactivé - logs gérés séparément
  ]);

  const stats = {
    loaded: 0,
    disabled: 0,
    errors: 0,
    startTime: Date.now()
  };

  try {
    const eventDirs = fs.readdirSync(dir, { withFileTypes: true }).
      filter((dirent) => dirent.isDirectory()).
      map((dirent) => dirent.name);

    logger.info(`Catégories d'événements trouvées: ${eventDirs.length}`);


    await Promise.all(eventDirs.map(async (eventDir) => {
      const eventPath = path.join(dir, eventDir);
      const eventFiles = fs.readdirSync(eventPath).
        filter((file) => file.endsWith('.js'));

      for (const file of eventFiles) {
        const fullPath = path.join(eventPath, file);
        const absFullPath = path.resolve(fullPath);
        const relativePath = path.relative(process.cwd(), absFullPath).replace(/\\/g, '/');


        if (disabledHandlers.has(relativePath)) {
          logger.debug(`[EVENT] Gestionnaire désactivé: ${relativePath}`);
          stats.disabled++;
          continue;
        }


        if (eventDir === 'rank' && file === 'message.js' ||
          file === 'message.js' && !eventPath.includes('antiraid')) {
          logger.debug(`[EVENT] Gestionnaire obsolète ignoré: ${relativePath}`);
          stats.disabled++;
          continue;
        }

        try {

          delete require.cache[require.resolve(absFullPath)];


          const eventModule = require(absFullPath);
          const event = typeof eventModule === 'function' ?
            eventModule :
            eventModule && typeof eventModule.default === 'function' ?
              eventModule.default :
              eventModule;

          if (!event || typeof event !== 'function') {
            throw new Error('Le gestionnaire doit exporter une fonction');
          }


          const rawName = path.basename(file, '.js');
          const mappedName = {
            message: 'messageCreate',
            messageReactionRemove: 'messageReactionRemove',
            messageReactionremove: 'messageReactionRemove'
          }[rawName] || rawName;

          // Utiliser le nom d'événement défini dans le module s'il existe, sinon utiliser le nom mappé
          const finalEventName = event.eventName || mappedName;

          for (const [idx, client] of clients.entries()) {




            // Pour messageCreate, NE PAS créer de dispatcher automatique
            // Le handler principal sera enregistré directement dans client.once('ready')
            // TOUS les autres handlers messageCreate doivent être désactivés pour éviter les doubles réponses
            if (finalEventName === 'messageCreate') {
              if (relativePath.includes('client/messageCreate.js')) {
                logger.debug(`[EVENT-LOADER] Ignoré le dispatcher automatique pour messageCreate principal`);
              } else {
                logger.warn(`[EVENT-LOADER] ⚠️ Handler messageCreate désactivé pour éviter les doubles réponses: ${relativePath}`);
                stats.disabled++;
              }
              continue;
            }
            
            const dispatcher = client._dispatcher?.[finalEventName] || (async (...args) => {
              const message = args[0];
              const eventName = dispatcher.eventName;

              // ── Déduplication cross-clients ──────────────────────────────
              // Génère une clé unique pour cet événement
              let dedupKey = null;
              if (message?.id && message?.guild?.id && message?.channel?.id) {
                // Événement message (messageCreate, messageDelete, etc.)
                dedupKey = `${eventName}:${message.guild.id}:${message.channel.id}:${message.id}`;
              } else if (message?.guild?.id && message?.id && message?.user !== undefined) {
                // guildMemberAdd / guildMemberRemove
                dedupKey = `${eventName}:${message.guild.id}:${message.id}`;
              } else if (message?.guild?.id && message?.id) {
                // Autres événements avec guild + id (channel, role, etc.) — bucket de 2s
                dedupKey = `${eventName}:${message.guild.id}:${message.id}:${Math.floor(Date.now() / 2000)}`;
              }

              if (dedupKey) {
                if (global._handledEvents.has(dedupKey)) return;
                global._handledEvents.add(dedupKey);
                setTimeout(() => global._handledEvents.delete(dedupKey), 30000);
              }

              // Ancien cache messages (conservé pour compatibilité)
              const messageKey = message?.id && message?.guild?.id && message?.channel?.id ?
                `${message.guild.id}:${message.channel.id}:${message.id}` : null;
              if (messageKey) globalProcessedMessages.set(messageKey, true);

              const handlers = client.eventHandlers[eventName] || [];
              logger.debug(`[EVENT-DISPATCHER] ${eventName}: ${handlers.length} handlers trouvés`);
              for (const handler of handlers) {
                try {
                  await Promise.race([
                    emojiContext.run({ client }, () => handler(client, ...args)),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
                  ]);
                } catch (e) {
                  if (e.message !== 'Timeout') logger.error(`[EVENT][${eventName}] Erreur:`, e);
                  else logger.warn(`[EVENT][${eventName}] Timeout`);
                }
              }
            });


            if (!client.eventHandlers) client.eventHandlers = {};
            if (!client.eventHandlers[finalEventName]) {
              client.eventHandlers[finalEventName] = [];
              dispatcher.eventName = finalEventName;
              client.on(finalEventName, dispatcher);
              client._dispatcher = client._dispatcher || {};
              client._dispatcher[finalEventName] = dispatcher;
            }
            client.eventHandlers[finalEventName].push(event);
          }

          stats.loaded++;
          logger.debug(`[EVENT] Chargé: ${relativePath} (${finalEventName})`);

        } catch (error) {
          stats.errors++;
          const msg = error && error.message ? error.message : String(error);
          const stack = error && error.stack ? error.stack : 'no stack';
          logger.error(`[EVENT] Erreur de chargement: ${relativePath} -> ${msg}`);
          logger.debug(`[EVENT] Stack pour ${relativePath}: ${stack}`);
        }
      }
    }));

    const loadTime = Date.now() - stats.startTime;
    logger.info(`Événements chargés: ${stats.loaded} (${stats.disabled} désactivés, ${stats.errors} erreurs) en ${loadTime}ms`);

  } catch (error) {
    logger.error('Erreur critique lors du chargement des événements:', error);
    stats.errors++;
  }

  return stats;
};

function initializeMessageCache() {
  if (!global.processedMessages) {
    global.processedMessages = new Set();

    setInterval(() => {
      try {
        const previousSize = global.processedMessages.size;
        global.processedMessages.clear();
        if (previousSize > 0) {
          logger.debug(`Cache des messages traités nettoyé (${previousSize} entrées supprimées)`);
        }
      } catch (error) {
        logger.error('Erreur lors du nettoyage du cache des messages:', error);
      }
    }, 300000);
  }
}






const loadCommands = (dir) => {
  const commandsDir = dir || path.join(__dirname, 'commands');
  const stats = {
    loaded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    startTime: Date.now()
  };

  const commandMap = new Map();
  const commandCategories = new Set();

  try {

    if (!fs.existsSync(commandsDir)) {
      logger.error(`Le répertoire des commandes n'existe pas: ${commandsDir}`);
      return { commands: commandMap, stats };
    }


    const commandDirs = fs.readdirSync(commandsDir, { withFileTypes: true }).
      filter((dirent) => dirent.isDirectory()).
      map((dirent) => dirent.name);

    logger.info(`Chargement des commandes depuis ${commandDirs.length} catégories (${commandsDir})...`);

    for (const category of commandDirs) {
      const categoryPath = path.join(commandsDir, category);
      commandCategories.add(category);

      try {

        const commandFiles = fs.readdirSync(categoryPath).
          filter((file) => file.endsWith('.js') && !file.startsWith('_'));

        logger.debug(`[${category.toUpperCase()}] ${commandFiles.length} commandes trouvées`);

        for (const file of commandFiles) {
          const commandName = path.basename(file, '.js');
          const fullPath = path.join(categoryPath, file);

          try {

            try { delete require.cache[require.resolve(fullPath)]; } catch (_) {}


            const commandModule = require(fullPath);
            const command = typeof commandModule === 'function' ?
              commandModule() :
              commandModule;


            if (!command || typeof command !== 'object') {
              throw new Error('Format de commande invalide');
            }

            if (!command.name) {
              throw new Error('Propriété "name" manquante');
            }

            if (typeof command.run !== 'function') {
              throw new Error('Fonction "run" manquante');
            }


            if (commandMap.has(command.name)) {
              logger.warn(`[DUPLICATE] La commande "${command.name}" est en double (${file})`);
              stats.skipped++;
              continue;
            }


            command.category = category;
            command.filePath = fullPath;
            command.timestamp = Date.now();


            commandMap.set(command.name, command);
            stats.loaded++;

            logger.debug(`[LOADED] ${category}/${file} -> ${command.name}`);

          } catch (error) {
            stats.failed++;
            const errorMsg = `[ERROR] Erreur lors du chargement de ${category}/${file}: ${error.message}`;
            stats.errors.push(errorMsg);
            logger.error(errorMsg);


            if (error.stack) {
              logger.debug(`Stack trace: ${error.stack}`);
            }
          }
        }
      } catch (error) {
        logger.error(`Erreur lors de la lecture du répertoire ${category}:`, error);
        stats.failed++;
        stats.errors.push(`Erreur dans la catégorie ${category}: ${error.message}`);
      }
    }


    const loadTime = Date.now() - stats.startTime;
    stats.loadTime = `${loadTime}ms`;
    stats.categories = Array.from(commandCategories);


    logger.info(`Chargement terminé: ${stats.loaded} commandes chargées, ` +
      `${stats.failed} échecs, ${stats.skipped} ignorées (${loadTime}ms)`);

    if (stats.errors.length > 0) {
      logger.warn(`${stats.errors.length} erreurs rencontrées pendant le chargement`);
      if (process.env.NODE_ENV === 'development') {
        stats.errors.forEach((err, i) => logger.warn(`[${i + 1}] ${err}`));
      }
    }

  } catch (error) {
    logger.error('Erreur critique lors du chargement des commandes:', error);
    stats.errors.push(`Erreur critique: ${error.message}`);
    if (error.stack) {
      logger.debug('Stack trace:', error.stack);
    }
  }

  return { commands: commandMap, stats };
};

// Limite les reconnexions pour éviter le ban Discord (>1000 connexions en peu de temps)
const RECONNECT_MAX_ATTEMPTS = 10;
const RECONNECT_INITIAL_DELAY_MS = 5000;
const RECONNECT_MAX_DELAY_MS = 5 * 60 * 1000; // 5 min

function getReconnectDelay(attempt) {
  return Math.min(RECONNECT_INITIAL_DELAY_MS * Math.pow(2, Math.min(attempt, 8)), RECONNECT_MAX_DELAY_MS);
}

const restartClient = async (client) => {
  if (client._tokenInvalid) {
    logger.warn(`[RESTART] Client ignoré: token invalide (à remplacer dans config).`);
    return false;
  }
  if (client._reconnecting) return false;
  client._reconnecting = true;
  const attempt = client._reconnectAttempts || 0;
  if (attempt >= RECONNECT_MAX_ATTEMPTS) {
    logger.error(`[RESTART] Abandon après ${RECONNECT_MAX_ATTEMPTS} tentatives. Vérifiez le token et redémarrez le bot.`);
    client._reconnecting = false;
    return false;
  }
  try {
    await client.destroy();
  } catch (_) {}
  const tokenToUse = client.botToken || client.token;
  if (!tokenToUse) {
    client._reconnecting = false;
    return false;
  }
  try {
    await client.login(tokenToUse);
    client._reconnectAttempts = 0;
    logger.info(`[RESTART] Client ${client.user?.tag} redémarré avec succès`);
    return true;
  } catch (error) {
    const code = String(error?.code || error?.message || '');
    if (code === 'TOKEN_INVALID' || code.includes('TokenInvalid') || code.includes('401') || code.includes('Unauthorized')) {
      client._tokenInvalid = true;
      logger.error(`[RESTART] Token invalide (réinitialisé par Discord?). Mettez à jour config.json.`);
    }
    client._reconnectAttempts = (client._reconnectAttempts || 0) + 1;
    logger.error(`[RESTART] Échec (${client._reconnectAttempts}/${RECONNECT_MAX_ATTEMPTS}):`, error?.message || error);
    return false;
  } finally {
    client._reconnecting = false;
  }
};

function scheduleReconnect(client) {
  if (client._tokenInvalid || client._reconnecting) return;
  if ((client._reconnectAttempts || 0) >= RECONNECT_MAX_ATTEMPTS) return;
  const delayMs = getReconnectDelay(client._reconnectAttempts || 0);
  logger.info(`[RESTART] Reconnexion dans ${Math.round(delayMs / 1000)}s pour ${client.user?.tag || 'inconnu'}`);
  setTimeout(() => { if (!client._tokenInvalid) restartClient(client); }, delayMs);
}

const startBot = async () => {
  try {
    logger.info('=== DÉMARRAGE DU BOT ===');
    logger.info('Node.js version:', process.version);
    logger.info('Discord.js version:', Discord.version);


    try {
      clients.forEach((client) => {
        if (client && !client.CreditLevelSystem) {
          client.CreditLevelSystem = CreditLevelSystem;
        }
      });
    } catch (error) {
      logger.error('Erreur lors de l\'initialisation du système de crédits:', error.message);
    }

    logger.info('Chargement des commandes...');
    const { commands: preloadedCommandsMap, stats: cmdStats } = loadCommands();
    logger.info(`Préchargement des commandes: ${preloadedCommandsMap.size} commandes (${cmdStats.failed} échec(s))`);
    if (cmdStats.failed > 0 && cmdStats.errors && cmdStats.errors.length) {
      cmdStats.errors.forEach((err) => logger.warn(err));
    }


    try {
      clients.forEach((cli, idx) => {
        if (!cli) return;
        if (!cli.commands) cli.commands = new Discord.Collection();
        if (!cli.aliases) cli.aliases = new Discord.Collection();
        cli.botStats = { startTime: Date.now() };
        let loadedCount = 0;
        for (const command of preloadedCommandsMap.values()) {
          if (command && command.name && typeof command.run === 'function') {
            if (!cli.commands.has(command.name)) {
              cli.commands.set(command.name, command);
              if (Array.isArray(command.aliases)) {
                command.aliases.forEach((alias) => {
                  if (!cli.aliases.has(alias)) {
                    cli.aliases.set(alias, command);
                  }
                });
              }
              loadedCount++;
            }
          }
        }
        logger.info(`[COMMANDS][CLIENT ${idx}] ${loadedCount} commandes enregistrées`);
      });
    } catch (e) {
      logger.error('[COMMANDS] Échec de l\'enregistrement des commandes sur tous les clients', e);
    }

    // Chargement des événements
    logger.info('Chargement des systèmes et événements...');
    await loadEvents();

    // NOTE: Le gestionnaire messageCreate est enregistré dans client.once('ready')
    // pour éviter les doubles réponses. Ne pas l'enregistrer ici.
    try {
      const interactionCreatePath = path.join(__dirname, 'events', 'client', 'interactionCreate.js');
      delete require.cache[require.resolve(interactionCreatePath)];
      const interactionCreateHandler = require(interactionCreatePath);

      let interactionsRegistered = 0;
      
      // Enregistrer le gestionnaire sur tous les clients
      for (const [idx, client] of clients.entries()) {
        if (client && typeof interactionCreateHandler === 'function') {
          try {
            // Retirer les anciens gestionnaires si existants
            if (client.eventHandlers && client.eventHandlers['interactionCreate']) {
              const handlers = client.eventHandlers['interactionCreate'];
              handlers.forEach(handler => {
                client.off('interactionCreate', handler);
              });
            }
            
            // Créer un wrapper pour le gestionnaire
            const wrappedHandler = async (interaction) => {
              try {
                await interactionCreateHandler(client, interaction);
              } catch (error) {
                logger.error(`[CLIENT ${idx}][INTERACTION-HANDLER] Erreur:`, error);
              }
            };
            
            // Enregistrer le gestionnaire
            if (!client.eventHandlers) client.eventHandlers = {};
            if (!client.eventHandlers['interactionCreate']) {
              client.eventHandlers['interactionCreate'] = [];
            }
            client.eventHandlers['interactionCreate'].push(wrappedHandler);
            client.on('interactionCreate', wrappedHandler);
            
            interactionsRegistered++;
            logger.info(`[CLIENT ${idx}] ✅ Gestionnaire interactionCreate enregistré`);
          } catch (error) {
            logger.error(`[CLIENT ${idx}] ❌ Erreur lors de l'enregistrement:`, error);
          }
        }
      }

      logger.info(`✅ Gestionnaire interactionCreate enregistré sur ${interactionsRegistered} clients`);
    } catch (error) {
      logger.error('❌ Erreur lors de l\'enregistrement forcé du gestionnaire interactionCreate:', error);
    }

    logger.info('Connexion des clients Discord...');
    if (typeof initClients === 'function') {
      await initClients();
    } else {
      logger.warn('⚠️  initClients non disponible, connexion manuelle...');
      // Connexion manuelle des clients
      for (let idx = 0; idx < clients.length; idx++) {
        const client = clients[idx];
        if (client && client.botToken) {
          try {
            logger.info(`[CLIENT ${idx}] Connexion...`);
            await client.login(client.botToken);
            logger.info(`[CLIENT ${idx}] ✅ Connecté`);
          } catch (error) {
            logger.error(`[CLIENT ${idx}] ❌ Erreur connexion:`, error);
          }
        }
      }
    }

    // Initialisation des salons vocaux temporaires pour chaque client
    try {
      clients.forEach((client) => {
        if (client) {
          initializeTempVoice(client);
        }
      });
    } catch (e) {
      logger.error('Erreur lors de l\'initialisation des salons vocaux temporaires:', e);
    }

    clients.forEach((client) => {
      if (client) {
        client.on('disconnect', (event) => {
          logger.warn(`Déconnexion du client ${client.user?.tag || 'inconnu'}. Code: ${event.code}, Raison: ${event.reason}`);
          scheduleReconnect(client);
        });

        client.on('rateLimit', (rateLimitInfo) => {
          logger.warn(`Rate limit atteint pour ${client.user?.tag || 'inconnu'}:`, {
            timeout: rateLimitInfo.timeout,
            limit: rateLimitInfo.limit,
            method: rateLimitInfo.method,
            path: rateLimitInfo.path,
            route: rateLimitInfo.route
          });
        });
      }
    });

    // Système de bienvenue chargé via loadEvents()

    logger.info('=== BOT DÉMARRÉ AVEC SUCCÈS ===');

    // Démarrer le cycle de mise à jour des statistiques
    try {
        initStatsInterval(clients);
    } catch (e) {
        logger.error('[STATS] Échec de l\'initialisation de l\'intervalle:', e);
    }


    // Connexion automatique des tokens ajoutés manuellement dans config.json (sans buyer)
    const { connectMissingTokensFromConfig } = require('./utils/connectNewTokens');
    const SYNC_TOKENS_INTERVAL_MS = 10 * 60 * 1000; // 10 min (éviter trop de connexions)
    setTimeout(async () => {
      try {
        const result = await connectMissingTokensFromConfig();
        if (result.missingCount > 0) {
          logger.info(`[CONFIG] Tokens ajoutés manuellement: ${result.connected} connecté(s), ${result.failed} échec(s).`);
        }
      } catch (e) {
        logger.error('[CONFIG] Synchro tokens:', e?.message || e);
      }
    }, 20000);
    setInterval(async () => {
      try {
        const result = await connectMissingTokensFromConfig();
        if (result.connected > 0 || result.failed > 0) {
          logger.info(`[CONFIG] Synchro config: ${result.connected} nouveau(x) token(s) connecté(s), ${result.failed} échec(s).`);
        }
      } catch (e) {
        logger.error('[CONFIG] Synchro tokens (interval):', e?.message || e);
      }
    }, SYNC_TOKENS_INTERVAL_MS);

  } catch (error) {
    logger.error('Erreur lors du démarrage du bot:', error);
    process.exit(1);
  }
};

logger.info('Démarrage du bot...');
startBot().
  then(() => {
    logger.info('Bot démarré avec succès');
  }).
  catch((error) => {
    logger.error('Erreur critique lors du démarrage du bot:', error);
    process.exit(1);
  });
