/**
 * Connecte les tokens présents dans config.DISCORD.TOKEN mais pas encore connectés.
 * Utilisé au démarrage (après un délai), par un intervalle périodique, et par la commande +reloadbuyers.
 */

const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { startTRPScheduler } = require('../util/gestion/trpScheduler');
const { createIsResponsibleForGuild } = require('./responsibility');

const configPath = path.resolve(__dirname, '..', 'config.json');
const eventsRoot = path.resolve(__dirname, '..', 'events');
const commandsRoot = path.resolve(__dirname, '..', 'commands');

function getBotIdFromToken(token) {
  try {
    const parts = String(token || '').trim().split('.');
    if (parts.length < 3) return null;
    return Buffer.from(parts[0], 'base64').toString('ascii');
  } catch (_) {
    return null;
  }
}

function makeClient() {
  return new Discord.Client({
    intents: [
      Discord.GatewayIntentBits.Guilds,
      Discord.GatewayIntentBits.GuildMessages,
      Discord.GatewayIntentBits.GuildMembers,
      Discord.GatewayIntentBits.GuildVoiceStates,
      Discord.GatewayIntentBits.GuildMessageReactions,
      Discord.GatewayIntentBits.GuildInvites,
      Discord.GatewayIntentBits.DirectMessages,
      Discord.GatewayIntentBits.MessageContent,
      Discord.GatewayIntentBits.GuildPresences
    ],
    partials: [Discord.Partials.Message, Discord.Partials.Channel, Discord.Partials.Reaction]
  });
}

function bindEventsForClient(clt) {
  if (!fs.existsSync(eventsRoot)) return;
  const eventDirs = fs.readdirSync(eventsRoot);
  for (const dir of eventDirs) {
    const eventPath = path.join(eventsRoot, dir);
    if (!fs.statSync(eventPath).isDirectory()) continue;
    const files = fs.readdirSync(eventPath).filter((f) => f.endsWith('.js'));
    for (const file of files) {
      try {
        const mod = require(path.join(eventPath, file));
        const rawName = file.split('.')[0];
        const mappedName = {
          message: 'messageCreate',
          messageReactionremove: 'messageReactionRemove'
        }[rawName] || rawName;
        if (mappedName === 'messageCreate') {
          clt.on(mappedName, (...args) => {
            try {
              mod(clt, ...args);
            } catch (_) {}
          });
        } else {
          clt.on(mappedName, mod.bind(null, clt));
        }
      } catch (e) {
        logger.error(`[connectNewTokens] Event ${file}:`, e.message);
      }
    }
  }
}

function bindCommandsForClient(clt) {
  if (!fs.existsSync(commandsRoot)) return;
  const commandDirs = fs.readdirSync(commandsRoot);
  for (const cdir of commandDirs) {
    const cpath = path.join(commandsRoot, cdir);
    if (!fs.statSync(cpath).isDirectory()) continue;
    const files = fs.readdirSync(cpath).filter((f) => f.endsWith('.js'));
    for (const file of files) {
      try {
        const command = require(path.join(cpath, file));
        if (command.name) {
          clt.commands.set(command.name, command);
          if (command.aliases && Array.isArray(command.aliases)) {
            command.aliases.forEach((alias) => clt.aliases.set(alias, command));
          }
        }
      } catch (e) {
        logger.error(`[connectNewTokens] Command ${file}:`, e.message);
      }
    }
  }
}

/**
 * Lit config.json, trouve les tokens non encore connectés, crée les clients et les connecte.
 * @returns {{ connected: number, failed: number, missingCount: number }}
 */
async function connectMissingTokensFromConfig() {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    logger.error('[connectNewTokens] Impossible de lire config.json', e.message);
    return { connected: 0, failed: 0, missingCount: 0 };
  }

  const tokens = Array.isArray(config?.DISCORD?.TOKEN) ? config.DISCORD.TOKEN.filter(Boolean) : [];
  if (tokens.length === 0) return { connected: 0, failed: 0, missingCount: 0 };

  const allClients = globalThis.allClients && Array.isArray(globalThis.allClients) ? globalThis.allClients : [];
  if (allClients.length === 0) return { connected: 0, failed: 0, missingCount: 0 };

  const existingTokens = new Set(allClients.map((c) => c.botToken).filter(Boolean));
  const existingBotIds = new Set(allClients.map((c) => getBotIdFromToken(c.botToken) || c.user?.id).filter(Boolean));

  const missingTokens = tokens.filter((t) => {
    if (existingTokens.has(t)) return false;
    const botId = getBotIdFromToken(t);
    if (botId && existingBotIds.has(botId)) return false;
    return true;
  });

  if (missingTokens.length === 0) return { connected: 0, failed: 0, missingCount: 0 };

  logger.info(`[connectNewTokens] ${missingTokens.length} token(s) à connecter (ajoutés manuellement ou non encore chargés).`);

  let connected = 0;
  let failed = 0;

  for (const token of missingTokens) {
    const newClient = makeClient();
    newClient.config = config;
    newClient.cooldown = [];
    newClient.interactions = new Map();
    newClient.guildInvites = new Map();
    newClient.queue = new Map();
    newClient.snipes = new Map();
    newClient.inter = [];
    newClient.commands = new Discord.Collection();
    newClient.aliases = new Discord.Collection();
    newClient.botToken = token;
    newClient.db = require('./simpledb');
    newClient.isResponsibleForGuild = createIsResponsibleForGuild(newClient, []);

    const all = globalThis.allClients && Array.isArray(globalThis.allClients) ? globalThis.allClients : [];
    newClient.clientIndex = all.length;
    all.push(newClient);
    globalThis.allClients = all;
    all.forEach((c, i) => {
      c.clientIndex = i;
      c.totalClients = all.length;
    });

    newClient.on('error', (e) => logger.error(`[CLIENT dyn ${newClient.clientIndex}] error:`, e.message));
    newClient.on('shardError', (e) => logger.error(`[CLIENT dyn ${newClient.clientIndex}] shardError:`, e.message));
    newClient.on('invalidated', () => logger.error(`[CLIENT dyn ${newClient.clientIndex}] session invalidated`));
    newClient.once('ready', () => {
      try {
        startTRPScheduler(newClient);
      } catch (e) {
        logger.error(`[CLIENT dyn ${newClient.clientIndex}] TRP scheduler:`, e.message);
      }
    });

    bindEventsForClient(newClient);
    bindCommandsForClient(newClient);

    try {
      await newClient.login(token);
      connected++;
      logger.info(`[connectNewTokens] Client connecté: ${newClient.user?.tag || token.substring(0, 10) + '...'}`);
    } catch (e) {
      failed++;
      logger.error('[connectNewTokens] Échec connexion:', e.message);
    }
  }

  return { connected, failed, missingCount: missingTokens.length };
}

module.exports = { connectMissingTokensFromConfig, getBotIdFromToken };
