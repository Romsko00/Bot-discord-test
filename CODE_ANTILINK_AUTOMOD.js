/*
 * CODE À AJOUTER DANS events/client/messageCreate.js
 * 
 * Ajoutez ce code AVANT le traitement des commandes
 * (après la vérification des bots et des DMs)
 */

const db = require('./utils/simpledb');
const Discord = require('discord.js');
const logger = require('./utils/logger');

// ==================== ANTI-LINK ====================
/** Retourne le contenu du message en excluant les blocs de code (``` et `) pour éviter les faux positifs */
function getContentWithoutCodeBlocks(text) {
  if (!text || typeof text !== 'string') return '';
  let out = text;
  out = out.replace(/```[\s\S]*?```/gi, ' ');
  out = out.replace(/`[^`]*`/g, ' ');
  return out;
}

/** Vérifie si le membre peut bypass l'anti-link (whitelist antilink_wl_ + owners) */
function canBypassAntiLink(db, guildId, member, client) {
  if (!member) return false;
  for (const [_, role] of member.roles.cache) {
    if (db.get(`antilink_wl_${guildId}_${role.id}_lien`) || db.get(`antilink_wl_${guildId}_${role.id}_all`)) return true;
  }
  if (db.get(`wluser_${guildId}_${member.id}`)) return true;
  if (db.get(`ownermd_${client.user?.id}_${member.id}`)) return true;
  if (client.config?.owners?.includes(member.id)) return true;
  if (client.config?.superadmin?.includes(member.id)) return true;
  return false;
}

async function handleAntiLink(client, message) {
  try {
    if (message.author.bot) return false;
    if (!message.guild) return false;

    const antilink = db.get(`link_${message.guild.id}`);
    if (!antilink) return false;

    if (canBypassAntiLink(db, message.guild.id, message.member, client)) return false;

    // Bypass si le salon est dans la liste des salons autorisés pour les liens
    const allowedChannels = db.get(`linkchannel_${message.guild.id}`) || [];
    if (allowedChannels.includes(message.channel.id)) return false;

    const linkType = (db.get(`linktype_${message.guild.id}`) || 'Invite').toLowerCase();
    const inviteRegex = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9-]+/gi;
    const allLinksRegex = /(https?:\/\/[^\s\]\)"']+)|(www\.[a-zA-Z0-9][^\s\]\)"']*)/gi;

    const contentToScan = getContentWithoutCodeBlocks(message.content);
    let hasLink = false;
    let linkFound = '';

    if (linkType === 'all') {
      const match = contentToScan.match(allLinksRegex);
      if (match) {
        hasLink = true;
        linkFound = match[0];
      }
    } else {
      const match = contentToScan.match(inviteRegex);
      if (match) {
        hasLink = true;
        linkFound = match[0];
      }
    }

    if (!hasLink && message.attachments?.size) {
      for (const att of message.attachments.values()) {
        if (att.url && (allLinksRegex.test(att.url) || inviteRegex.test(att.url))) {
          hasLink = true;
          linkFound = att.url;
          break;
        }
      }
    }

    if (!hasLink && message.embeds?.length) {
      for (const e of message.embeds) {
        if (e.url && (allLinksRegex.test(e.url) || inviteRegex.test(e.url))) {
          hasLink = true;
          linkFound = e.url;
          break;
        }
        if (e.description && (allLinksRegex.test(e.description) || inviteRegex.test(e.description))) {
          const m = e.description.match(allLinksRegex) || e.description.match(inviteRegex);
          if (m) {
            hasLink = true;
            linkFound = m[0];
            break;
          }
        }
      }
    }

    if (!hasLink) return false;

    await message.delete().catch(() => {});

    const warning = await message.channel.send(
      `🔗 ${message.author}, les liens sont interdits ici.`
    ).catch(() => null);
    if (warning) setTimeout(() => warning.delete().catch(() => {}), 5000);

    const sanction = (db.get(`linksanction_${message.guild.id}`) || 'warn').toLowerCase();
    const reason = `Anti-link: lien détecté (${(linkFound || '').substring(0, 80)})`;

    if (sanction === 'warn' && message.member) {
      try {
        const warnKey = `warns_${message.guild.id}_${message.author.id}`;
        const warns = db.get(warnKey) || [];
        warns.push({
          moderator: client.user?.id || '0',
          reason: reason,
          timestamp: Date.now()
        });
        db.set(warnKey, warns);
      } catch (e) {
        logger.error('[ANTI-LINK] Erreur enregistrement warn:', e);
      }
    } else if (sanction === 'ban' && message.member) {
      try {
        if (message.guild.members.me?.permissions?.has(Discord.PermissionFlagsBits.BanMembers)) {
          await message.member.ban({ reason }).catch((e) => logger.error('[ANTI-LINK] Ban impossible:', e));
        } else {
          logger.warn(`[ANTI-LINK] Permission BanMembers manquante (${message.guild.id})`);
        }
      } catch (e) {
        logger.error('[ANTI-LINK] Erreur sanction ban:', e);
      }
    }

    const raidlogChannel = db.get(`${message.guild.id}.raidlog`);
    if (raidlogChannel) {
      const logChannel = message.guild.channels.cache.get(raidlogChannel);
      if (logChannel) {
        const embed = new Discord.EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('🔗 Anti-Link: Lien détecté et supprimé')
          .addFields(
            { name: 'Utilisateur', value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: 'Salon', value: `${message.channel}`, inline: true },
            { name: 'Sanction', value: sanction || 'warn', inline: true },
            { name: 'Lien', value: `\`${(linkFound || '').substring(0, 100)}\``, inline: false }
          )
          .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    logger.info(`[ANTI-LINK] Message supprimé de ${message.author.tag} dans #${message.channel.name}`);
    return true;
  } catch (error) {
    logger.error('[ANTI-LINK] Erreur:', error);
    return false;
  }
}

// ==================== AUTOMOD - SPAM ====================
async function handleAntiSpam(client, message) {
  try {
    if (message.author.bot) return false;
    
    // Vérifier si l'automod est activé
    const automodEnabled = db.get(`automod_enabled_${message.guild.id}`);
    if (!automodEnabled) return false;

    // Récupérer les messages récents de l'utilisateur
    const userMessages = db.get(`spam_${message.guild.id}_${message.author.id}`) || [];
    
    // Ajouter le message actuel
    userMessages.push({
      content: message.content,
      time: Date.now(),
      channel: message.channel.id
    });

    // Garder seulement les messages des 30 dernières secondes
    const now = Date.now();
    const recentMessages = userMessages.filter(m => now - m.time < 30000);
    
    db.set(`spam_${message.guild.id}_${message.author.id}`, recentMessages);

    // DÉTECTION 1: Même message répété
    const sameMessages = recentMessages.filter(
      m => m.content === message.content && message.content.length > 3
    ).length;

    if (sameMessages >= 3) {
      await message.delete().catch(() => {});
      
      const warning = await message.channel.send(
        `⚠️ ${message.author}, arrêtez de spammer le même message!`
      ).catch(() => {});
      
      if (warning) {
        setTimeout(() => warning.delete().catch(() => {}), 5000);
      }
      
      // Timeout 2 minutes
      if (message.member && message.guild.members.me.permissions.has(Discord.PermissionFlagsBits.ModerateMembers)) {
        await message.member.timeout(2 * 60 * 1000, 'Spam détecté').catch(() => {});
      }
      
      logger.info(`[AUTOMOD-SPAM] ${message.author.tag} a été timeout pour spam`);
      return true;
    }

    // DÉTECTION 2: Trop de messages rapides (flood)
    if (recentMessages.length >= 7) {
      await message.delete().catch(() => {});
      
      const warning = await message.channel.send(
        `⚠️ ${message.author}, ralentissez! Vous envoyez des messages trop rapidement.`
      ).catch(() => {});
      
      if (warning) {
        setTimeout(() => warning.delete().catch(() => {}), 5000);
      }
      
      // Timeout 3 minutes
      if (message.member && message.guild.members.me.permissions.has(Discord.PermissionFlagsBits.ModerateMembers)) {
        await message.member.timeout(3 * 60 * 1000, 'Flood détecté').catch(() => {});
      }
      
      logger.info(`[AUTOMOD-FLOOD] ${message.author.tag} a été timeout pour flood`);
      return true;
    }

    return false;
  } catch (error) {
    logger.error('[AUTOMOD-SPAM] Erreur:', error);
    return false;
  }
}

// ==================== AUTOMOD - CAPS LOCK ====================
async function handleCapsLock(client, message) {
  try {
    if (message.author.bot) return false;
    if (message.content.length < 10) return false;
    
    const automodEnabled = db.get(`automod_enabled_${message.guild.id}`);
    if (!automodEnabled) return false;

    // Calculer le pourcentage de majuscules
    const caps = (message.content.match(/[A-Z]/g) || []).length;
    const total = message.content.replace(/[^a-zA-Z]/g, '').length;
    
    if (total === 0) return false;
    
    const capsPercentage = caps / total;

    // Si plus de 70% en majuscules
    if (capsPercentage > 0.7) {
      await message.delete().catch(() => {});
      
      const warning = await message.channel.send(
        `🔠 ${message.author}, pas de CAPS LOCK excessif!`
      ).catch(() => {});
      
      if (warning) {
        setTimeout(() => warning.delete().catch(() => {}), 5000);
      }
      
      logger.info(`[AUTOMOD-CAPS] Message de ${message.author.tag} supprimé pour CAPS`);
      return true;
    }

    return false;
  } catch (error) {
    logger.error('[AUTOMOD-CAPS] Erreur:', error);
    return false;
  }
}

// ==================== AUTOMOD - MOTS INTERDITS ====================
async function handleBannedWords(client, message) {
  try {
    if (message.author.bot) return false;
    
    const automodEnabled = db.get(`automod_enabled_${message.guild.id}`);
    if (!automodEnabled) return false;

    const bannedWords = db.get(`automod_words_${message.guild.id}`) || [];
    if (bannedWords.length === 0) return false;

    const messageContent = message.content.toLowerCase();

    for (const word of bannedWords) {
      if (messageContent.includes(word.toLowerCase())) {
        await message.delete().catch(() => {});
        
        const warning = await message.channel.send(
          `🚫 ${message.author}, ce mot est interdit!`
        ).catch(() => {});
        
        if (warning) {
          setTimeout(() => warning.delete().catch(() => {}), 5000);
        }
        
        logger.info(`[AUTOMOD-WORDS] Message de ${message.author.tag} supprimé (mot interdit)`);
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error('[AUTOMOD-WORDS] Erreur:', error);
    return false;
  }
}

// ==================== FONCTION PRINCIPALE À APPELER ====================
async function runAutomod(client, message) {
  try {
    if (!message.guild) return undefined;
    if (message.author.bot) return undefined;

    if (await handleAntiLink(client, message)) return true;
    if (await handleBannedWords(client, message)) return true;
    if (await handleCapsLock(client, message)) return true;
    if (await handleAntiSpam(client, message)) return true;

    return undefined;
  } catch (error) {
    logger.error('[AUTOMOD] Erreur globale:', error);
    return undefined;
  }
}

// ==================== INSTRUCTIONS D'INTÉGRATION ====================
/*
 * Dans le fichier events/client/messageCreate.js, 
 * ajoutez cet appel AU DÉBUT de la fonction principale:
 * 
 * module.exports = async (client, message) => {
 *   
 *   // AJOUTEZ CETTE LIGNE ICI:
 *   await runAutomod(client, message);
 *   
 *   // ... reste du code existant
 * }
 */

// Exporter les fonctions si nécessaire
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAutomod,
    handleAntiLink,
    handleAntiSpam,
    handleCapsLock,
    handleBannedWords
  };
}
