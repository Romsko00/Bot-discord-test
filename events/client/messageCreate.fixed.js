const axios = require('axios');
const db = require("../../utils/simpledb");
const Discord = require("discord.js");
const ms = require("ms");
const logger = require("../../utils/logger");
const { RateLimiter, isSpam, hasInsult, isCapsAbuse, isEmojiAbuse, isMentionAbuse, isInviteLink, isGenericLink, hasZalgo, isAttachmentAbuse, isLongMessage } = require('../../utils/automod');
const { hasPermissionLevel, hasTempPermission, isBotOwner } = require('../../utils/permissionUtils');
const { getLevelFor } = require('../../utils/commandLevels');


if (!global.processedMessages) {
  global.processedMessages = new Set();
  setInterval(() => {
    try {
      global.processedMessages = new Set();
      logger.info('Nettoyage du cache des messages traités effectué');
    } catch (error) {
      logger.error('Erreur lors du nettoyage du cache des messages:', error);
    }
  }, 60 * 60 * 1000);
}

module.exports = async (client, message) => {

  if (!message.guild || message.author.bot || !client.isCommandHandler) return;


  const messageKey = `msg:${message.guild.id}:${message.channel.id}:${message.id}`;
  if (global.processedMessages.has(messageKey)) {
    if (process.env.DEBUG === 'true') {
      logger.debug(`Message déjà traité: ${messageKey}`);
    }
    return;
  }

  try {

    global.processedMessages.add(messageKey);


    setTimeout(() => {
      try {
        global.processedMessages.delete(messageKey);
      } catch (error) {
        logger.error('Erreur lors du nettoyage du message:', error);
      }
    }, 30000);


    try {
      const afkKey = `afk_${message.guild.id}_${message.author.id}`;
      if (db.has(afkKey)) {
        db.delete(afkKey);
        try {
          await message.reply({ content: `Tu n'es plus AFK. Bienvenue de retour!` });
        } catch (_) { }
      }
    } catch (error) {
      logger.error('Erreur lors du traitement AFK:', error);
    }


    if (db.get(`customcmdembed_${message.content.toLowerCase()}`) !== null) {
      const embedj = db.get(`customcmdembed_${message.content.toLowerCase()}`);
      if (embedj.description) {
        embedj.description = embedj.description.
          replace(/{guild:name}/g, message.guild.name).
          replace(/{guild:member}/g, message.guild.memberCount).
          replace(/{user:name}/g, message.author.username).
          replace(/{user:tag}/g, message.author.tag).
          replace(/{user:id}/g, message.author.id).
          replace(/{user}/g, message.author);
      }

      if (embedj.title) {
        embedj.title = embedj.title.
          replace(/{guild:name}/g, message.guild.name).
          replace(/{guild:member}/g, message.guild.memberCount).
          replace(/{user:name}/g, message.author.username).
          replace(/{user:tag}/g, message.author.tag).
          replace(/{user:id}/g, message.author.id).
          replace(/{user}/g, message.author);
      }

      if (embedj.footer && embedj.footer.text) {
        embedj.footer.text = embedj.footer.text.
          replace(/{guild:name}/g, message.guild.name).
          replace(/{guild:member}/g, message.guild.memberCount).
          replace(/{user:name}/g, message.author.username).
          replace(/{user:tag}/g, message.author.tag).
          replace(/{user:id}/g, message.author.id).
          replace(/{user}/g, message.author);
      }

      return message.channel.send({ embeds: [embedj] });
    }


    if (db.get(`customcmd_${message.content.toLowerCase()}`) !== null) {
      return message.channel.send(db.get(`customcmd_${message.content.toLowerCase()}`));
    }

    const startAt = Date.now();
    const prefix = db.get(`prefix_${message.guild.id}`) || client.config.prefix;
    const color = db.get(`color_${message.guild.id}`) || client.config.color;


    if (message.content.match(new RegExp(`^<@!?${client.user.id}>( |)$`)) !== null) {
      const isOwnerMd = db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
      const hasLevel = hasPermissionLevel(client, message, 1);
      const isChannelPublic = db.get(`channelpublic_${message.guild.id}_${message.channel.id}`) === true;
      if (isOwnerMd || hasLevel || isChannelPublic) {
        return message.channel.send(`Mon prefix : \`${prefix}\``);
      }
    }

    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prefixRegex = new RegExp(`^(<@!?${client.user.id}>|${escapeRegex(prefix)})\\s*`);


    if (!prefixRegex.test(message.content)) return;
    const [, matchedPrefix] = message.content.match(prefixRegex);
    const args = message.content.slice(matchedPrefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (!commandName) return;


    let command = client.commands.get(commandName) || client.aliases.get(commandName);
    if (!command) return;


    try {
      const categoryLevel = {
        admin: 6,
        mods: 4
      };
      const mapped = getLevelFor(command.name);
      const requiredLevel = typeof command.permissionLevel === 'number' ? command.permissionLevel : mapped ?? categoryLevel[command.category];

      if (requiredLevel === '$') {
        if (!isBotOwner(client, message)) {
          return message.reply(`<a:_:1483497365863399536> Cette commande est réservée au propriétaire du bot.`);
        }
      } else if (requiredLevel) {
        const bypass = hasTempPermission(message, command.name);
        if (!(bypass || hasPermissionLevel(client, message, requiredLevel))) {
          return message.reply(`<a:_:1483497365863399536> Vous n'avez pas la permission requise (niveau ${requiredLevel}) pour utiliser la commande \`${command.name}\`.`);
        }
      }
    } catch (error) {
      logger.error('Erreur de vérification des permissions:', error);
      return message.reply('<a:_:1483497365863399536> Une erreur est survenue lors de la vérification des permissions.');
    }


    if (!client.cooldown) client.cooldown = [];
    const cooldownEntry = client.cooldown.find((c) =>
      c.id === message.author.id &&
      c.command === command.name &&
      c.guild === message.guild.id
    );

    if (cooldownEntry) {
      const timeLeft = Math.ceil((cooldownEntry.startedAt + 1000 - Date.now()) / 1000);
      if (timeLeft > 0) {
        return message.channel.send(`${message.author}, Merci d'attendre **${timeLeft} seconde${timeLeft > 1 ? 's' : ''}** avant de refaire cette commande.`).
          then((m) => {
            setTimeout(() => {
              if (message.deletable) message.delete().catch(() => { });
              if (m.deletable) m.delete().catch(() => { });
            }, timeLeft * 1000);
          });
      }
    }


    try {
      await command.run(client, message, args, prefix, color, client.botStats, client.CreditLevelSystem);


      client.cooldown.push({
        id: message.author.id,
        command: command.name,
        guild: message.guild.id,
        startedAt: Date.now()
      });


      setTimeout(() => {
        const index = client.cooldown.findIndex((c) =>
          c.id === message.author.id &&
          c.command === command.name &&
          c.guild === message.guild.id
        );
        if (index !== -1) {
          client.cooldown.splice(index, 1);
        }
      }, 1000);

    } catch (error) {
      logger.error(`Erreur dans la commande ${command.name}:`, error);
      message.channel.send(`<a:_:1483497365863399536> Une erreur s'est produite lors de l'exécution de la commande \`${command.name}\`.`);
    }

  } catch (error) {
    logger.error('Erreur dans le gestionnaire de message:', error);
  }
};
