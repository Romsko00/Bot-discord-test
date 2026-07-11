const logger = require('../../utils/logger');
const db = require("../../utils/simpledb");
const Discord = require("discord.js");
const ms = require("ms");
const { hasPermissionLevel, hasTempPermission, isBotOwner } = require('../../utils/permissionUtils');
const { getLevelFor } = require('../../utils/commandLevels');
const { runAutomod } = require('../../CODE_ANTILINK_AUTOMOD');
const { checkOsintPermission } = require('../../utils/osintHelpers');
const { replyError } = require('../../utils/embedDesign');
const { emojiContext } = require('../../utils/emojis');

/** Commandes OSINT : réservées aux abonnés (/abonnement) ou superadmin, même avec le préfixe */
const OSINT_COMMAND_NAMES = [
  'lookup', 'breach', 'geoip', 'intel', 'snusbase', 'vpncheck', 'whoisdomain', 'pastebin', 'phoneinfo',
  'msgsearch', 'scraper', 'searchmsg', 'messages', 'scrapemessages',
  'hashlookup', 'hash', 'decrypt_hash', 'hashcheck',
  'username', 'usercheck', 'namesearch', 'socialcheck',
  'emailinfo', 'email', 'emailcheck', 'verifyemail',
  'socialsearch', 'social', 'usernamecheck',
  'urlinfo', 'url', 'urlinspect', 'urlcheck',
  'dork', 'dorking', 'googledork', 'dorks',
  'osint_resources', 'ressources', 'osint_ressources', 'osintlinks', 'osint_links'
];

/**
 * GESTIONNAIRE PRINCIPAL DES MESSAGES - GESTION DES COMMANDES
 * Ce fichier gère TOUTES les commandes du bot
 */

logger.info('[MESSAGE-HANDLER] Module chargé');

/** Dernière fois qu'on a loggé l'avertissement "Message Content" (éviter le spam en logs) */
let lastMessageContentIntentWarn = 0;
const MESSAGE_CONTENT_WARN_COOLDOWN = 5 * 60 * 1000; // 5 min

/**
 * Fonction pour gérer le retour d'un utilisateur AFK
 */
async function handleAfkReturn(client, message) {
  try {
    if (!client.db) return;
    const key = `afk_${message.guild.id}_${message.author.id}`;
    const afkData = client.db.get ? client.db.get(key) : null;

    if (afkData) {
      if (client.db.delete) client.db.delete(key);
      const duration = Date.now() - afkData.since;
      const formattedDuration = ms(duration, { long: true });

      const welcomeBack = await message.channel.send({
        content: `Bienvenue de retour, ${message.author}! Ton statut AFK a été supprimé.`,
        embeds: [{
          color: 0x00ff00,
          fields: [
            { name: 'Tu étais AFK pendant', value: formattedDuration, inline: true },
            { name: 'Raison', value: afkData.reason || 'Aucune raison spécifiée', inline: true }
          ]
        }]
      });

      setTimeout(() => welcomeBack.delete().catch(() => { }), 10000);
    }
  } catch (error) {
    logger.error('[AFK] Erreur lors de la gestion du retour AFK:', error);
  }
}

/**
 * Fonction pour gérer les mentions d'utilisateurs AFK
 */
async function handleAfkMentions(client, message) {
  try {
    if (!client.db || message.mentions.members.size === 0) return;

    const mentionedMembers = message.mentions.members.filter(member => !member.user.bot);
    if (mentionedMembers.size === 0) return;

    const afkResponses = [];

    for (const [_, member] of mentionedMembers) {
      const key = `afk_${message.guild.id}_${member.id}`;
      const afkData = client.db.get ? client.db.get(key) : null;

      if (afkData) {
        const duration = Date.now() - afkData.since;
        const formattedDuration = ms(duration, { long: true });

        afkResponses.push({
          name: member.user.tag,
          value: `**Raison:** ${afkData.reason || 'Aucune raison spécifiée'}\n` +
            `**Depuis:** ${formattedDuration}`
        });
      }
    }

    if (afkResponses.length > 0) {
      const embed = new Discord.EmbedBuilder()
        .setColor(0xff9900)
        .setTitle('<:_:1483497414575915268> Utilisateur(s) AFK')
        .setDescription('Les utilisateurs mentionnés sont actuellement AFK.')
        .addFields(afkResponses)
        .setFooter({ text: 'Ils seront notifiés de votre message à leur retour.' })
        .setTimestamp();

      const reply = await message.channel.send({ embeds: [embed] });
      setTimeout(() => reply.delete().catch(() => { }), 15000);
    }
  } catch (error) {
    logger.error('[AFK] Erreur lors de la gestion des mentions AFK:', error);
  }
}

module.exports = async (client, message) => {
  // NOTE: La vérification du cache et de responsabilité est déjà faite dans le wrapper de index.js
  // Si on arrive ici, c'est que le message doit être traité par ce client
  
  // Log seulement en mode debug pour éviter le spam
  if (process.env.DEBUG === 'true') {
    logger.debug(`[MESSAGE-HANDLER] Traitement du message "${message.content?.substring(0, 50) || 'N/A'}" de ${message.author?.tag || 'unknown'} dans ${message.guild?.name || 'DM'}`);
  }

  // Si le contenu du message est vide (intent "Message Content" désactivé sur le portail Discord), le bot ne peut pas répondre
  const content = message.content != null ? String(message.content) : '';
  if (!content && message.guild) {
    const now = Date.now();
    if (now - lastMessageContentIntentWarn >= MESSAGE_CONTENT_WARN_COOLDOWN) {
      lastMessageContentIntentWarn = now;
      logger.warn('[MESSAGE-HANDLER] Intent "Message Content" désactivé : contenu des messages indisponible. Activez-le dans le portail Discord (Application → Bot → Privileged Gateway Intents).');
    }
    return;
  }

  // Ignorer les MPs
  if (!message.guild) {
    if (message.author.bot) return;

    logger.debug(`[MESSAGE-HANDLER] Message en DM, envoi de l'aide`);
    const helpEmbed = new Discord.EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Aide du Bot')
      .setDescription('Je suis un bot de serveur. Utilisez-moi dans un serveur Discord !')
      .addFields(
        { name: 'Préfixe', value: '`+`' },
        { name: 'Aide', value: 'Utilisez `+help` pour voir les commandes disponibles.' }
      );

    return message.author.send({ embeds: [helpEmbed] }).catch(() => { });
  }

  // Ignorer les bots
  if (message.author.bot) {
    logger.debug(`[MESSAGE-HANDLER] Message d'un bot, ignoré`);
    return;
  }

  // Chaque bot traite les commandes dans tous les serveurs où il est présent (pas de filtre de responsabilité)

  // Exécuter les vérifications automod (anti-link, spam, etc.)
  try {
    const automodResult = await runAutomod(client, message);
    if (automodResult) {
      logger.info(`[MESSAGE-HANDLER] Message bloqué par automod`);
      return;
    }
  } catch (err) {
    logger.error('[AUTOMOD-RUN] Erreur lors de l\'exécution de l\'automod:', err);
  }

    // SOP: réactions + thread public pour images (si configuré)
    try {
      const { handleSop } = require('../../CODE_SOP_AUTOMOD');
      try { await handleSop(client, message); } catch (e) { logger.error('[SOP] Error executing handler:', e); }
    } catch (e) { logger.debug('[SOP] Module non présent ou erreur de chargement:', e.message); }

  try {
    // Gérer AFK
    await handleAfkReturn(client, message);
    if (message.mentions.members.size > 0) {
      await handleAfkMentions(client, message);
    }

    // Vérifier les commandes personnalisées embed
    if (content && db.get(`customcmdembed_${content.toLowerCase()}`) !== null) {
      const embedj = db.get(`customcmdembed_${content.toLowerCase()}`);
      if (embedj.description) {
        embedj.description = embedj.description
          .replace(/{guild:name}/g, message.guild.name)
          .replace(/{guild:member}/g, message.guild.memberCount)
          .replace(/{user:name}/g, message.author.username)
          .replace(/{user:tag}/g, message.author.tag)
          .replace(/{user:id}/g, message.author.id)
          .replace(/{user}/g, message.author);
      }
      if (embedj) return message.channel.send({ embeds: [embedj] });
    }

    // Vérifier les commandes personnalisées texte
    if (content && db.get(`customcmd_${content.toLowerCase()}`) !== null) {
      return message.channel.send(db.get(`customcmd_${content.toLowerCase()}`));
    }

    // Récupérer le préfixe
    const prefix = db.get(`prefix_${message.guild.id}`) || client.config.prefix || '+';
    const color = db.get(`color_${message.guild.id}`) || client.config.color;

    // Répondre à la mention du bot
    if (content.match(new RegExp(`^<@!?${client.user.id}>( |)$`))) {
      try {
        const mentionEmbed = new Discord.EmbedBuilder()
          .setColor('#007BFF')
          .setDescription(`**Préfixe**\nMon préfixe est : \`${prefix}\`\n\nUtilisez \`${prefix}help\` pour voir toutes les commandes disponibles.`)
          .setTimestamp();
        const reply = await message.reply({ embeds: [mentionEmbed] });
        return reply;
      } catch (error) {
        logger.error('[MENTION] Erreur lors de la réponse à la mention:', error);
        try {
          const reply = await message.channel.send(`Mon préfixe est : \`${prefix}\``);
          return reply;
        } catch (sendError) {
          logger.error('[MENTION] Impossible d\'envoyer le message:', sendError);
          return;
        }
      }
    }

    // Vérifier le préfixe
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedPrefix = escapeRegex(prefix);
    const prefixRegex = new RegExp(`^(<@!?${client.user.id}>|${escapedPrefix})\\s*`);

    if (!prefixRegex.test(content)) {
      return;
    }

    // Extraire la commande
    const [, matchedPrefix] = content.match(prefixRegex);
    const args = content.slice(matchedPrefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (!commandName) {
      return;
    }
    
    // Vérifier si client.commands existe
    if (!client.commands || client.commands.size === 0) {
      logger.error(`[COMMANDS-ERROR] client.commands est vide ou n'existe pas!`);
      await replyError(message, 'Les commandes ne sont pas chargées. Redémarrez le bot.');
      return;
    }

    // Rechercher la commande
    let command = null;
    if (client.commands && client.commands.has(commandName)) {
      command = client.commands.get(commandName);
      logger.debug(`[COMMAND-FOUND] Commande trouvée via client.commands: ${command.name}`);
    } else if (client.aliases && client.aliases.has(commandName)) {
      command = client.aliases.get(commandName);
      logger.debug(`[COMMAND-FOUND] Commande trouvée via client.aliases: ${command.name}`);
    }

    if (!command) {
      logger.warn(`[COMMAND-NOT-FOUND] Commande introuvable: "${commandName}"`);
      await replyError(message, `Commande \`${commandName}\` introuvable. Utilisez \`${prefix}help\`.`);
      return;
    }

    logger.debug(`[COMMAND-FOUND] Commande trouvée: ${command.name}`);

    // OSINT : même règle qu'en slash — réservé aux abonnés (/abonnement) ou superadmin
    if (OSINT_COMMAND_NAMES.includes(command.name) && !checkOsintPermission(client, message)) {
      await replyError(message, 'Accès OSINT refusé. Réservé aux abonnés.');
      return;
    }

    // Vérifier les permissions (niveau par défaut, ou override par guilde via +change)
    try {
      const categoryLevel = { admin: 6, mods: 4 };
      const guildOverride = message.guild ? db.get(`perm_req_${message.guild.id}_${command.name}`) : null;
      const defaultLevel = typeof command.permissionLevel === 'number' ?
        command.permissionLevel : (getLevelFor(command.name) ?? categoryLevel[command.category]);
      const requiredLevel = (guildOverride !== null && guildOverride !== undefined && Number.isInteger(Number(guildOverride)))
        ? Number(guildOverride)
        : defaultLevel;

      if (requiredLevel === '$') {
        if (!isBotOwner(client, message)) {
          await replyError(message, 'Cette commande est réservée au propriétaire du bot.');
          return;
        }
      } else if (requiredLevel) {
        const bypass = hasTempPermission(message, command.name);
        if (!(bypass || hasPermissionLevel(client, message, requiredLevel))) {
          await replyError(message, `Permission refusée (niveau ${requiredLevel} requis).`);
          return;
        }
      }
    } catch (error) {
      logger.error('[PERMISSION-ERROR] Erreur lors de la vérification des permissions:', error);
      await replyError(message, 'Erreur lors de la vérification des permissions.');
      return;
    }

    // Cooldown
    if (!client.cooldowns) client.cooldowns = new Map();

    const now = Date.now();
    const timestamps = client.cooldowns.get(command.name) || new Map();
    const cooldownAmount = (command.cooldown || 1) * 1000;

    if (timestamps.has(message.author.id)) {
      const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        await replyError(message, `Cooldown : attendez ${timeLeft.toFixed(0)}s.`, { deleteAfter: 5000 });
        return;
      }
    }

    timestamps.set(message.author.id, now);
    client.cooldowns.set(command.name, timestamps);
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

    // Exécuter la commande
    // Le message est déjà marqué comme traité au début du handler
    
    logger.debug(`[COMMAND-EXECUTE] Exécution: ${command.name} par ${message.author.tag}`);

    // Exécuter la commande dans le contexte de l'emoji pour le serveur actuel
    await emojiContext.run({ client, guildId: message.guild.id }, async () => {
      try {
        const result = await command.run(client, message, args, prefix, color, client.botStats, client.CreditLevelSystem);
        
        // Vérifier si la commande a retourné une promesse de message
        if (result && typeof result.then === 'function') {
          await result.catch((err) => {
            logger.warn(`[COMMAND-REPLY] Erreur lors de l'envoi de la réponse pour ${command.name}:`, err);
          });
        }
        
        // Vérifier si la commande a déjà répondu
        const hasReplied = message.replied || message.deleted;
        if (!hasReplied) {
          logger.debug(`[COMMAND-NO-REPLY] La commande ${command.name} n'a pas envoyé de réponse explicite`);
        }
        
        logger.debug(`[COMMAND-SUCCESS] Commande ${command.name} exécutée avec succès`);
      } catch (error) {
        console.error(`[COMMAND-ERROR] Erreur dans ${command.name}:`, error);
        logger.error(`[COMMAND-ERROR] Erreur dans ${command.name}: ${error?.message || String(error)}`);
        logger.error(`[COMMAND-ERROR] Stack: ${error?.stack || '(no stack)'}`);
        // N'envoyer l'erreur QUE si la commande n'a pas déjà répondu (évite la double réponse)
        if (!message.replied && !message.deleted) {
          await replyError(message, `Une erreur est survenue lors de l'exécution de \`${command.name}\`.`).catch(() => {});
        }
      }
    });

  } catch (error) {
    logger.error('[HANDLER-ERROR] Erreur dans le gestionnaire de message:', error);
    logger.error('[HANDLER-ERROR] Stack:', error.stack);
    // Ne pas envoyer de message ici pour éviter une double réponse si la commande a déjà répondu avant de lever
  }
};

logger.info('[MESSAGE-HANDLER] Module exporté avec succès');
