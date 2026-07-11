/**
 * emojis.js
 *
 * Deux mécanismes de résolution des emojis custom :
 *
 *  1. emojiContext (AsyncLocalStorage) — actif pendant les commandes via messageCreate.js
 *     → Fonctionne dans la chaîne async de la commande
 *
 *  2. withGuildEmojis(guildId, client, fn) — utilitaire pour les events/logs
 *     → Wraps n'importe quelle fonction async dans le bon contexte
 *     → À utiliser dans guildMemberAdd, voiceStateUpdate, logs de modération, etc.
 *
 * Utilisation dans un event :
 *   const { withGuildEmojis } = require('../utils/emojis');
 *   await withGuildEmojis(guild.id, client, async () => {
 *     // ici EMOJIS.SUCCESS retourne l'emoji personnalisé du serveur
 *   });
 */

const { AsyncLocalStorage } = require('async_hooks');
const db = require('./simpledb');

const emojiContext = new AsyncLocalStorage();

// ── Résolution d'un emoji ─────────────────────────────────────────────────────
// Priorité :
//  1. Override DB pour le serveur actif (via emojiContext ou withGuildEmojis)
//  2. Cache client (application emojis) pour vérifier que l'emoji est accessible
//  3. Retour de la string brute <:_:ID> / <a:_:ID>

function r(defaultEmoji, key) {
    const context = emojiContext.getStore();

    // ── Résoudre le guildId depuis le contexte ────────────────────────────────
    const guildId = context?.guildId || null;
    const client  = context?.client  || null;

    // ── 1. Override custom par serveur ────────────────────────────────────────
    if (guildId && key) {
        const override = db.get(`custemoji_${guildId}_${key}`);
        if (override) return override;
    }

    // ── Pas d'emoji par défaut → retourner null ───────────────────────────────
    if (!defaultEmoji || typeof defaultEmoji !== 'string') return defaultEmoji;

    // Emoji unicode (pas de `:`) → retourner tel quel
    if (!defaultEmoji.includes(':')) return defaultEmoji;

    // ── Parser l'emoji custom ─────────────────────────────────────────────────
    const emojiRegex = /^<a?:([^:]+):(\d+)>$/;
    const match      = defaultEmoji.match(emojiRegex);
    if (!match) return defaultEmoji;

    const isAnimated = defaultEmoji.startsWith('<a:');
    const name       = match[1];
    const id         = match[2];

    // ── 2. Résolution via le cache client ─────────────────────────────────────
    if (client) {
        let resolved = client.emojis.cache.find(e => e.name === name || e.id === id);
        if (!resolved && client.application?.emojis) {
            resolved = client.application.emojis.cache.find(e => e.name === name || e.id === id);
        }
        if (resolved) return resolved.toString();
    }

    // ── 3. Retour brut ────────────────────────────────────────────────────────
    return isAnimated ? `<a:${name}:${id}>` : `<:${name}:${id}>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  withGuildEmojis — wrapper pour les events et logs
//
//  Permet d'activer le contexte emoji dans N'IMPORTE QUELLE fonction async,
//  même hors d'une commande (guildMemberAdd, voiceStateUpdate, logs mod, etc.)
//
//  Usage :
//    const { withGuildEmojis } = require('../../utils/emojis');
//
//    // Dans un event guildMemberAdd :
//    client.on('guildMemberAdd', async (member) => {
//      await withGuildEmojis(member.guild.id, client, async () => {
//        const msg = `${EMOJIS.SUCCESS} Bienvenue ${member} !`;
//        await channel.send(msg);
//      });
//    });
// ─────────────────────────────────────────────────────────────────────────────

async function withGuildEmojis(guildId, client, fn) {
    return emojiContext.run({ guildId, client }, fn);
}

// ─────────────────────────────────────────────────────────────────────────────
//  EMOJIS — Getters qui appellent r() pour chaque emoji
//  Chaque getter résout automatiquement l'override du serveur actif
// ─────────────────────────────────────────────────────────────────────────────

const EMOJIS = {
    // ── Système ──────────────────────────────────────────────────────────────
    get SUCCESS()  { return r('<a:_:1483497369315315786>', 'SUCCESS');  },
    get ERROR()    { return r('<a:_:1483497365863399536>', 'ERROR');    },
    get WARNING()  { return r('<:_:1483497503713394719>', 'WARNING');   },
    get INFO()     { return r('<:_:1483497414575915268>', 'INFO');      },
    get ARROW()    { return r('<:_:1483497470754426942>', 'ARROW');     },
    get DENIED()   { return r('<a:_:1483497365863399536>', 'DENIED');   },
    get CHECK()    { return r('<:_:1483497387698819185>', 'CHECK');     },
    get IMAGE()    { return r('<:_:1483497411488776334>', 'IMAGE');     },
    DOT:      '•',
    DIVIDER:  '━━━━━━━━━━',

    // ── Statuts ───────────────────────────────────────────────────────────────
    get ONLINE()    { return r('<:_:1483497444351414292>', 'ONLINE');    },
    get IDLE()      { return r('<:_:1483497407915495527>', 'IDLE');      },
    get DND()       { return r('<:_:1483497397542850570>', 'DND');       },
    get OFFLINE()   { return r('<:_:1483497433479774303>', 'OFFLINE');   },
    get STREAMING() { return r('<:_:1483497507555119268>', 'STREAMING'); },

    // ── Actions & Navigation ──────────────────────────────────────────────────
    get ON()        { return r('<:_:1483497438613471456>', 'ON');        },
    get OFF()       { return r('<:_:1483497433479774303>', 'OFF');       },
    get PRECEDENT() { return r('<:_:1483497463108210884>', 'PRECEDENT'); },
    get SUIVANT()   { return r('<:_:1483497470754426942>', 'SUIVANT');   },
    get RETOUR()    { return r('<:_:1483497480556642546>', 'RETOUR');    },
    get RELOAD()    { return r('<:_:1483497480556642546>', 'RELOAD');    },
    get PLUS1()     { return r('<:_:1483497379788226600>', 'PLUS1');     },
    get MINUS1()    { return r('<:_:1483497397542850570>', 'MINUS1');    },
    get LOADING()   { return r('<a:_:1483497422096437338>', 'LOADING');  },

    // ── Utilisateurs & Rôles ──────────────────────────────────────────────────
    get USER()  { return r('<:_:1483497424860348518>', 'USER');  },
    get ROLE()  { return r('<:_:1483497482917777580>', 'ROLE');  },
    get STAFF() { return r('<:_:1483497428589215756>', 'STAFF'); },
    get ADMIN() { return r('<:_:1483497499489603747>', 'ADMIN'); },

    // ── Modération ────────────────────────────────────────────────────────────
    get LOCK()    { return r('<:_:1483497431135162539>', 'LOCK');    },
    get UNLOCK()  { return r('<:_:1483497387698819185>', 'UNLOCK');  },
    get BAN()     { return r('<:_:1483497431135162539>', 'BAN');     },
    get PROTECT() { return r('<:_:1483497431135162539>', 'PROTECT'); },
    get TIMEOUT() { return r('<:_:1483497397542850570>', 'TIMEOUT'); },
    get TIMER()   { return r('<:_:1483497390798409789>', 'TIMER');   },

    // ── Paramètres & Bot ──────────────────────────────────────────────────────
    get SETTINGS()      { return r('<:_:1483497393721839829>', 'SETTINGS');      },
    get CONFIG_WRENCH() { return r('<:_:1483497382279643207>', 'CONFIG_WRENCH'); },
    get STATS()         { return r('<:_:1483497390798409789>', 'STATS');         },
    get LEVEL()         { return r('<:_:1483497402324488404>', 'LEVEL');         },
    get BUG()           { return r('<:_:1483497494724739245>', 'BUG');           },
    get DB()            { return r('<:_:1483497382279643207>', 'DB');            },
    get PEN()           { return r('<:_:1483497457613672530>', 'PEN');           },

    // ── Extras & Déco ─────────────────────────────────────────────────────────
    get RULES()    { return r('<:_:1483497414575915268>', 'RULES');    },
    get NOTIF()    { return r('<:_:1483497491797377184>', 'NOTIF');    },
    get BOOST()    { return r('<:_:1483497385048014889>', 'BOOST');    },
    get WIFI()     { return r('<:_:1483497418900373786>', 'WIFI');     },
    get ANON()     { return r('<:_:1483497488550990107>', 'ANON');     },
    get INFINITE() { return r('<:_:1483497497178669217>', 'INFINITE'); },
    get FOLDER()   { return r('<:_:1483497411488776334>', 'FOLDER');   },
    get MUSIC()    { return r('<:_:1483497507555119268>', 'MUSIC');    },
    get GAMES()    { return r('<:_:1483497405696704674>', 'GAMES');    },

    // ── Casino & Items ────────────────────────────────────────────────────────
    get COIN()   { return r('<:_:1483497385048014889>', 'COIN');   },
    get DICE()   { return r('<:_:1483497405696704674>', 'DICE');   },
    get TROPHY() { return r('<:_:1483497488550990107>', 'TROPHY'); },
    get CROWN()  { return r('<:_:1483497499489603747>', 'CROWN');  },
    get CARD()   { return r('♠',                        'CARD');   },
};

// ─────────────────────────────────────────────────────────────────────────────

function replaceEmojiNames(text) {
    const nameMap = {
        ':verify:':  EMOJIS.SUCCESS,
        ':error:':   EMOJIS.ERROR,
        ':warning:': EMOJIS.WARNING,
        ':info:':    EMOJIS.INFO,
        ':coin:':    EMOJIS.COIN,
        ':dice:':    EMOJIS.DICE,
        ':trophy:':  EMOJIS.TROPHY,
        ':crown:':   EMOJIS.CROWN,
        ':denied:':  EMOJIS.DENIED,
        ':reload:':  EMOJIS.RELOAD,
        ':ban:':     EMOJIS.BAN,
        ':timer:':   EMOJIS.TIMER,
        ':timeout:': EMOJIS.TIMEOUT,
        ':plus1:':   EMOJIS.PLUS1,
        ':minus1:':  EMOJIS.MINUS1,
        ':image:':   EMOJIS.IMAGE,
        ':card:':    EMOJIS.CARD,
    };
    return text.replace(/(:[a-zA-Z0-9_]+:)/g, (m) => nameMap[m] || m);
}

function resolveEmojiForComponent(emoji, client = null) {
    if (!emoji) return null;
    if (typeof emoji === 'object' && emoji.id) return emoji;
    if (typeof emoji === 'string' && !emoji.includes(':') && !emoji.match(/^\d+$/)) return emoji;
    const emojiMatch = emoji.match(/^<a?:([^:]+):(\d+)>$/);
    if (emojiMatch) {
        const name = emojiMatch[1];
        const id   = emojiMatch[2];
        if (client) {
            const resolved = client.emojis.cache.get(id) || client.emojis.cache.find(e => e.name === name);
            if (resolved) return resolved;
        }
        return emoji;
    }
    if (typeof emoji === 'string' && emoji.match(/^\d+$/)) {
        if (client) {
            const resolved = client.emojis.cache.get(emoji);
            if (resolved) return resolved;
        }
        return null;
    }
    return emoji;
}

module.exports = EMOJIS;
module.exports.emojiContext      = emojiContext;
module.exports.withGuildEmojis   = withGuildEmojis;
module.exports.replaceEmojiNames = replaceEmojiNames;
module.exports.resolveEmojiForComponent = resolveEmojiForComponent;
