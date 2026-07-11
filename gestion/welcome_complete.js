const Discord = require('discord.js');
const db = require('../../utils/simpledb');
const logger = require('../../utils/logger');
const { configEmbed, successEmbed, errorEmbed, COLORS, EMOJIS } = require('../../utils/embedDesign');
const { ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { hasPermissionLevel } = require('../../utils/permissionUtils');

/**
 * SYSTÈME DE BIENVENUE COMPLET ET ROBUSTE
 * Refonte complète avec correction de tous les bugs
 */

// ==================== UTILITAIRES ====================

/**
 * Formate un template avec les variables disponibles
 */
function formatTemplate(text, member, inviter = null, inviteCount = 0) {
  if (!text || !member || !member.user || !member.guild) return text;

  try {
    const invName = inviter ? inviter.username : 'Inconnu';
    const invTag = inviter ? (inviter.tag || `${inviter.username}#0000`) : 'Inconnu';
    const invId = inviter ? inviter.id : 'Inconnu';
    const memberCounter = member.guild.memberCount;

    return String(text)
      .replaceAll('{user}', member.toString())
      .replaceAll('{user:mention}', member.toString())
      .replaceAll('{user:name}', member.user.username)
      .replaceAll('{user:tag}', member.user.tag || `${member.user.username}#0000`)
      .replaceAll('{user:id}', member.user.id)
      .replaceAll('{inviter}', inviter ? inviter.toString() : 'Inconnu')
      .replaceAll('{inviter:mention}', inviter ? inviter.toString() : 'Inconnu')
      .replaceAll('{inviter:name}', invName)
      .replaceAll('{inviter:tag}', invTag)
      .replaceAll('{inviter:id}', invId)
      .replaceAll('{invite}', String(inviteCount))
      .replaceAll('{invites}', String(inviteCount))
      .replaceAll('{invite:count}', String(inviteCount))
      .replaceAll('{membre:counter}', String(memberCounter))
      .replaceAll('{member:counter}', String(memberCounter))
      .replaceAll('{member:count}', String(memberCounter))
      .replaceAll('{guild:name}', member.guild.name)
      .replaceAll('{guild:members}', String(member.guild.memberCount))
      .replaceAll('{server:name}', member.guild.name)
      .replaceAll('{server:members}', String(member.guild.memberCount));
  } catch (error) {
    logger.error('[WELCOME] Erreur formatTemplate:', error);
    return text;
  }
}

/**
 * Récupère la configuration complète du système de bienvenue
 */
function getWelcomeConfig(guildId) {
  return {
    channelId: db.get(`joinchannelmessage_${guildId}`),
    style: db.get(`welcomestyle_${guildId}`) || 'message',
    message: db.get(`joinmessage_${guildId}`),
    embed: db.get(`joinmessageembed_${guildId}`),
    dmMessage: db.get(`joindmee_${guildId}`),
    autoroleId: db.get(`autorole_${guildId}`),
    enabled: db.get(`welcome_enabled_${guildId}`) !== false
  };
}

/**
 * Sauvegarde la configuration du système de bienvenue
 */
function saveWelcomeConfig(guildId, config) {
  if (config.channelId !== undefined) db.set(`joinchannelmessage_${guildId}`, config.channelId);
  if (config.style !== undefined) db.set(`welcomestyle_${guildId}`, config.style);
  if (config.message !== undefined) db.set(`joinmessage_${guildId}`, config.message);
  if (config.embed !== undefined) db.set(`joinmessageembed_${guildId}`, config.embed);
  if (config.dmMessage !== undefined) db.set(`joindmee_${guildId}`, config.dmMessage);
  if (config.autoroleId !== undefined) db.set(`autorole_${guildId}`, config.autoroleId);
  if (config.enabled !== undefined) db.set(`welcome_enabled_${guildId}`, config.enabled);
}

// ==================== DÉTECTION INVITEUR ====================

/**
 * Détecte qui a invité le membre
 */
async function detectInviter(client, member) {
  try {
    const guildId = member.guild.id;

    // Vérifier les permissions
    if (!member.guild.members.me.permissions.has(Discord.PermissionFlagsBits.ManageGuild)) {
      logger.warn(`[WELCOME] Pas de permission ManageGuild sur ${member.guild.name}`);
      return { inviter: null, inviteCount: 0 };
    }

    // Récupérer les invitations actuelles
    const currentInvites = await member.guild.invites.fetch().catch(() => null);
    if (!currentInvites) {
      return { inviter: null, inviteCount: 0 };
    }

    // Initialiser le cache si nécessaire
    if (!client.guildInvites) {
      client.guildInvites = new Map();
    }

    // Récupérer le cache des invitations
    const cachedInvites = client.guildInvites.get(guildId);

    if (cachedInvites) {
      // Comparer avec le cache pour trouver l'inviteur
      for (const [code, currentInvite] of currentInvites) {
        const cachedInvite = cachedInvites.get(code);

        if (cachedInvite && currentInvite.uses > cachedInvite.uses) {
          // Mettre à jour le cache
          client.guildInvites.set(guildId, currentInvites);

          return {
            inviter: currentInvite.inviter,
            inviteCount: currentInvite.uses
          };
        }
      }
    }

    // Mettre à jour le cache
    client.guildInvites.set(guildId, currentInvites);

    return { inviter: null, inviteCount: 0 };
  } catch (error) {
    logger.error('[WELCOME] Erreur détection inviteur:', error);
    return { inviter: null, inviteCount: 0 };
  }
}

// ==================== GESTION NOUVEAU MEMBRE ====================

/**
 * Gère l'arrivée d'un nouveau membre
 */
async function handleMemberJoin(client, member) {
  try {
    logger.info(`[WELCOME] 🎉 Nouveau membre: ${member.user.tag} sur ${member.guild.name}`);

    const guildId = member.guild.id;
    const config = getWelcomeConfig(guildId);

    // Vérifier si le système est activé
    if (!config.enabled) {
      logger.info(`[WELCOME] Système désactivé pour ${member.guild.name}`);
      return;
    }

    // Détecter l'inviteur
    const { inviter, inviteCount } = await detectInviter(client, member);
    if (inviter) {
      logger.info(`[WELCOME] Invité par ${inviter.tag} (${inviteCount} invitations)`);
    }

    // 1. Ajouter le rôle automatique
    if (config.autoroleId) {
      try {
        const role = member.guild.roles.cache.get(config.autoroleId);
        if (role) {
          // Vérifier que le bot peut ajouter le rôle
          const botMember = member.guild.members.me;
          if (botMember.roles.highest.position > role.position) {
            await member.roles.add(role);
            logger.info(`[WELCOME] <a:_:1483497369315315786> Rôle automatique ajouté à ${member.user.tag}`);
          } else {
            logger.warn(`[WELCOME] <:_:1483497503713394719> Rôle trop haut pour ${member.user.tag}`);
          }
        } else {
          logger.warn(`[WELCOME] <:_:1483497503713394719> Rôle automatique introuvable`);
        }
      } catch (error) {
        logger.error(`[WELCOME] <a:_:1483497365863399536> Erreur ajout rôle:`, error);
      }
    }

    // 2. Envoyer le message de bienvenue dans le salon
    if (config.channelId && (config.message || config.embed)) {
      try {
        const channel = member.guild.channels.cache.get(config.channelId);

        if (channel && channel.isTextBased()) {
          // Vérifier les permissions d'envoi
          const permissions = channel.permissionsFor(member.guild.members.me);
          if (!permissions.has(Discord.PermissionFlagsBits.SendMessages)) {
            logger.warn(`[WELCOME] <:_:1483497503713394719> Pas de permission d'envoi dans ${channel.name}`);
          } else {
            if (config.style === 'embed' && config.embed) {
              // Mode embed
              const embedData = JSON.parse(JSON.stringify(config.embed));

              // Formater tous les champs de l'embed
              if (embedData.title) {
                embedData.title = formatTemplate(embedData.title, member, inviter, inviteCount);
              }
              if (embedData.description) {
                embedData.description = formatTemplate(embedData.description, member, inviter, inviteCount);
              }
              if (embedData.footer && embedData.footer.text) {
                embedData.footer.text = formatTemplate(embedData.footer.text, member, inviter, inviteCount);
              }
              if (embedData.author && embedData.author.name) {
                embedData.author.name = formatTemplate(embedData.author.name, member, inviter, inviteCount);
              }
              if (embedData.fields) {
                embedData.fields = embedData.fields.map(field => ({
                  ...field,
                  name: formatTemplate(field.name, member, inviter, inviteCount),
                  value: formatTemplate(field.value, member, inviter, inviteCount)
                }));
              }

              await channel.send({ embeds: [new EmbedBuilder(embedData)] });
              logger.info(`[WELCOME] <a:_:1483497369315315786> Embed envoyé pour ${member.user.tag}`);
            } else if (config.message) {
              // Mode message
              const formattedMessage = formatTemplate(config.message, member, inviter, inviteCount);
              await channel.send(formattedMessage);
              logger.info(`[WELCOME] <a:_:1483497369315315786> Message envoyé pour ${member.user.tag}`);
            }
          }
        } else {
          logger.warn(`[WELCOME] <:_:1483497503713394719> Salon de bienvenue introuvable ou invalide`);
        }
      } catch (error) {
        logger.error(`[WELCOME] <a:_:1483497365863399536> Erreur envoi message salon:`, error);
      }
    }

    // 3. Envoyer le message privé
    if (config.dmMessage) {
      try {
        const formattedDM = formatTemplate(config.dmMessage, member, inviter, inviteCount);
        await member.send(formattedDM);
        logger.info(`[WELCOME] <a:_:1483497369315315786> MP envoyé à ${member.user.tag}`);
      } catch (error) {
        logger.warn(`[WELCOME] <:_:1483497503713394719> Impossible d'envoyer le MP à ${member.user.tag}`);
      }
    }

    logger.info(`[WELCOME] <a:_:1483497369315315786> Traitement terminé pour ${member.user.tag}`);
  } catch (error) {
    logger.error('[WELCOME] <a:_:1483497365863399536> Erreur dans handleMemberJoin:', error);
  }
}

// ==================== INTERFACE DE CONFIGURATION ====================

/**
 * Crée l'embed de configuration principal
 */
function createConfigEmbed(guild) {
  const config = getWelcomeConfig(guild.id);

  const fields = [
    {
      name: `${EMOJIS.SETTINGS} Statut`,
      value: config.enabled ? `${EMOJIS.SUCCESS} Activé` : `${EMOJIS.ERROR} Désactivé`,
      inline: true
    },
    {
      name: '📍 Salon de Bienvenue',
      value: config.channelId
        ? `${EMOJIS.SUCCESS} <#${config.channelId}>`
        : `${EMOJIS.ERROR} Non configuré`,
      inline: true
    },
    {
      name: '🎨 Style',
      value: config.style === 'embed' ? '📋 Embed' : '📝 Message',
      inline: true
    },
    {
      name: '💬 Message Serveur',
      value: (config.message || config.embed)
        ? `${EMOJIS.SUCCESS} Configuré`
        : `${EMOJIS.ERROR} Non configuré`,
      inline: true
    },
    {
      name: '📨 Message Privé',
      value: config.dmMessage
        ? `${EMOJIS.SUCCESS} Configuré`
        : `${EMOJIS.ERROR} Non configuré`,
      inline: true
    },
    {
      name: '🎭 Rôle Automatique',
      value: config.autoroleId
        ? `${EMOJIS.SUCCESS} <@&${config.autoroleId}>`
        : `${EMOJIS.ERROR} Non configuré`,
      inline: true
    },
    {
      name: '📝 Variables Disponibles',
      value: '```\n' +
        '{user} - Mention du membre\n' +
        '{user:name} - Nom du membre\n' +
        '{user:tag} - Tag complet\n' +
        '{user:id} - ID du membre\n' +
        '{inviter} - Mention de l\'inviteur\n' +
        '{inviter:name} - Nom de l\'inviteur\n' +
        '{invite:count} - Nb d\'invitations\n' +
        '{member:counter} - Numéro du membre\n' +
        '{guild:name} - Nom du serveur\n' +
        '{guild:members} - Nombre de membres\n' +
        '```',
      inline: false
    }
  ];

  return configEmbed('Configuration du Système de Bienvenue', {
    description: '**Configurez un message de bienvenue élégant pour votre serveur**\n\n' +
      'Utilisez le menu ci-dessous pour configurer tous les paramètres.',
    fields,
    footer: { text: 'Utilisez le menu déroulant pour configurer le système' }
  });
}

/**
 * Crée le menu de sélection
 */
function createSelectMenu(config) {
  const options = [
    {
      label: config.enabled ? 'Désactiver le système' : 'Activer le système',
      value: 'toggle_status',
      emoji: config.enabled ? '<:_:1483497397542850570>' : '<:_:1483497444351414292>',
      description: config.enabled ? 'Désactiver les messages de bienvenue' : 'Activer les messages de bienvenue'
    },
    {
      label: 'Mode Embed',
      value: 'style_embed',
      emoji: '📋',
      description: 'Utiliser un embed élégant'
    },
    {
      label: 'Mode Message',
      value: 'style_message',
      emoji: '📝',
      description: 'Utiliser un message texte simple'
    },
    {
      label: 'Modifier le salon',
      value: 'modify_channel',
      emoji: '📍',
      description: 'Choisir le salon de bienvenue'
    },
    {
      label: 'Supprimer le salon',
      value: 'delete_channel',
      emoji: '🗑️',
      description: 'Retirer le salon de bienvenue'
    }
  ];

  // Ajouter les options selon le style
  if (config.style === 'embed') {
    options.push(
      {
        label: 'Modifier l\'embed',
        value: 'modify_embed',
        emoji: '📋',
        description: 'Créer/modifier l\'embed de bienvenue'
      },
      {
        label: 'Supprimer l\'embed',
        value: 'delete_embed',
        emoji: '🗑️',
        description: 'Supprimer l\'embed actuel'
      }
    );
  } else {
    options.push(
      {
        label: 'Modifier le message',
        value: 'modify_message',
        emoji: '📝',
        description: 'Créer/modifier le message de bienvenue'
      },
      {
        label: 'Supprimer le message',
        value: 'delete_message',
        emoji: '🗑️',
        description: 'Supprimer le message actuel'
      }
    );
  }

  options.push(
    {
      label: 'Modifier le MP',
      value: 'modify_dm',
      emoji: '💬',
      description: 'Message privé de bienvenue'
    },
    {
      label: 'Supprimer le MP',
      value: 'delete_dm',
      emoji: '🗑️',
      description: 'Supprimer le message privé'
    },
    {
      label: 'Modifier le rôle auto',
      value: 'modify_role',
      emoji: '🎭',
      description: 'Rôle donné automatiquement'
    },
    {
      label: 'Supprimer le rôle auto',
      value: 'delete_role',
      emoji: '🗑️',
      description: 'Retirer le rôle automatique'
    },
    {
      label: 'Tester le système',
      value: 'test_welcome',
      emoji: '🧪',
      description: 'Simuler l\'arrivée d\'un membre'
    }
  );

  return new StringSelectMenuBuilder()
    .setCustomId('welcome_menu')
    .setPlaceholder('🎛️ Sélectionnez une option')
    .addOptions(options);
}

/**
 * Crée les boutons d'action
 */
function createActionButtons(config) {
  const buttons = [
    new ButtonBuilder()
      .setCustomId('refresh')
      .setLabel('Actualiser')
      .setEmoji('<:_:1483497480556642546>')
      .setStyle(ButtonStyle.Secondary)
  ];

  if (config.style === 'embed' && config.embed) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('view_embed')
        .setLabel('Aperçu')
        .setEmoji('👁️')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId('close_menu')
      .setLabel('Fermer')
      .setEmoji('<a:_:1483497365863399536>')
      .setStyle(ButtonStyle.Danger)
  );

  return new ActionRowBuilder().addComponents(buttons);
}

/**
 * Met à jour le message de configuration
 */
async function updateConfigMessage(message, guild) {
  try {
    const config = getWelcomeConfig(guild.id);
    const embed = createConfigEmbed(guild);
    const selectMenu = createSelectMenu(config);
    const actionButtons = createActionButtons(config);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);

    await message.edit({
      content: null,
      embeds: [embed],
      components: [row1, actionButtons]
    });
  } catch (error) {
    logger.error('[WELCOME] Erreur updateConfigMessage:', error);
  }
}

// ==================== GESTIONNAIRES D'ACTIONS ====================

/**
 * Demande un texte à l'utilisateur
 */
async function promptText(channel, author, title, description, timeout = 60000) {
  const promptEmbed = configEmbed(title, { description });
  const promptMsg = await channel.send({ embeds: [promptEmbed] });

  try {
    const collected = await channel.awaitMessages({
      filter: m => m.author.id === author.id,
      max: 1,
      time: timeout,
      errors: ['time']
    });

    const response = collected.first();
    await response.delete().catch(() => { });
    await promptMsg.delete().catch(() => { });

    return response.content;
  } catch (error) {
    await promptMsg.delete().catch(() => { });
    return null;
  }
}

/**
 * Demande un salon à l'utilisateur
 */
async function promptChannel(channel, author, guild) {
  const text = await promptText(
    channel,
    author,
    '📍 Salon de Bienvenue',
    'Mentionnez le salon ou envoyez son ID\n\n*Vous avez 60 secondes pour répondre*'
  );

  if (!text) return null;

  const channelMatch = text.match(/^<#(\d+)>$/) || text.match(/^(\d+)$/);
  if (!channelMatch) return null;

  const targetChannel = guild.channels.cache.get(channelMatch[1]);
  if (!targetChannel || !targetChannel.isTextBased()) return null;

  return targetChannel;
}

/**
 * Demande un rôle à l'utilisateur
 */
async function promptRole(channel, author, guild) {
  const text = await promptText(
    channel,
    author,
    '🎭 Rôle Automatique',
    'Mentionnez le rôle ou envoyez son ID\n\n*Vous avez 60 secondes pour répondre*'
  );

  if (!text) return null;

  const roleMatch = text.match(/^<@&(\d+)>$/) || text.match(/^(\d+)$/);
  if (!roleMatch) return null;

  const role = guild.roles.cache.get(roleMatch[1]);
  return role || null;
}

/**
 * Éditeur d'embed simplifié
 */
async function embedEditor(channel, author, guild) {
  const title = await promptText(
    channel,
    author,
    '📋 Titre de l\'Embed',
    'Entrez le titre de votre embed de bienvenue\n\n*Laissez vide pour passer*'
  );

  const description = await promptText(
    channel,
    author,
    '📋 Description de l\'Embed',
    'Entrez la description de votre embed\n\nUtilisez les variables disponibles:\n' +
    '`{user}` `{user:name}` `{inviter}` `{member:counter}` `{guild:name}`'
  );

  if (!description) {
    return null;
  }

  const color = await promptText(
    channel,
    author,
    '🎨 Couleur de l\'Embed',
    'Entrez la couleur en hexadécimal (ex: #5865F2)\n\n*Laissez vide pour la couleur par défaut*'
  );

  const embedData = {
    title: title || undefined,
    description: description,
    color: color ? parseInt(color.replace('#', ''), 16) : COLORS.PRIMARY,
    footer: {
      text: '{guild:name} • Membre #{member:counter}'
    },
    timestamp: new Date().toISOString()
  };

  return embedData;
}

// ==================== COMMANDE PRINCIPALE ====================

module.exports = {
  name: 'welcome',
  aliases: ['setwelcome', 'welcome-config', 'bienvenue'],
  description: 'Configure le système de bienvenue complet et robuste',
  usage: 'welcome',
  category: 'gestion',
  handleMemberJoin, // Exporter pour l'événement

  run: async (client, message, args, prefix, color) => {
    // Vérification des permissions
    let perm = false;
    message.member.roles.cache.forEach((role) => {
      if (db.get(`ownerp_${message.guild.id}_${role.id}`)) perm = true;
    });

    if (
      !client.config.superadmin.includes(message.author.id) &&
      !client.config.owners.includes(message.author.id) &&
      !(db.get(`ownermd_${client.user.id}_${message.author.id}`) === true) &&
      !perm &&
      !hasPermissionLevel(client, message, 6)
    ) {
      return message.reply({
        embeds: [errorEmbed('Accès Refusé', 'Vous devez avoir le niveau 6 (admin) pour utiliser cette commande.')]
      });
    }

    // Créer le message de configuration
    const loadingEmbed = configEmbed('Chargement...', {
      description: 'Initialisation du système de configuration...'
    });
    const configMsg = await message.channel.send({ embeds: [loadingEmbed] });

    await updateConfigMessage(configMsg, message.guild);

    // Créer le collecteur
    const collector = configMsg.createMessageComponentCollector({
      time: 300000 // 5 minutes
    });

    collector.on('collect', async (interaction) => {
      // Vérifier que c'est l'auteur
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({
          embeds: [errorEmbed('Accès Refusé', 'Seul l\'auteur de la commande peut utiliser ce menu.')],
          ephemeral: true
        });
      }

      await interaction.deferUpdate().catch(() => { });

      const config = getWelcomeConfig(message.guild.id);

      // Gérer les boutons
      if (interaction.isButton()) {
        switch (interaction.customId) {
          case 'refresh':
            await updateConfigMessage(configMsg, message.guild);
            break;

          case 'view_embed':
            if (config.embed) {
              const previewEmbed = new EmbedBuilder(config.embed);
              await message.channel.send({ embeds: [previewEmbed] })
                .then(msg => setTimeout(() => msg.delete().catch(() => { }), 15000));
            }
            break;

          case 'close_menu':
            collector.stop('user_closed');
            break;
        }
        return;
      }

      // Gérer le menu déroulant
      if (interaction.isStringSelectMenu()) {
        const value = interaction.values[0];

        switch (value) {
          case 'toggle_status':
            config.enabled = !config.enabled;
            saveWelcomeConfig(message.guild.id, { enabled: config.enabled });
            await message.channel.send({
              embeds: [successEmbed(
                config.enabled ? 'Système Activé' : 'Système Désactivé',
                config.enabled
                  ? 'Le système de bienvenue est maintenant actif.'
                  : 'Le système de bienvenue est maintenant désactivé.'
              )]
            }).then(msg => setTimeout(() => msg.delete().catch(() => { }), 5000));
            break;

          case 'style_embed':
            saveWelcomeConfig(message.guild.id, { style: 'embed' });
            await message.channel.send({
              embeds: [successEmbed('Mode Embed', 'Le système utilisera maintenant des embeds élégants.')]
            }).then(msg => setTimeout(() => msg.delete().catch(() => { }), 5000));
            break;

          case 'style_message':
            saveWelcomeConfig(message.guild.id, { style: 'message' });
            await message.channel.send({
              embeds: [successEmbed('Mode Message', 'Le système utilisera maintenant des messages texte.')]
            }).then(msg => setTimeout(() => msg.delete().catch(() => { }), 5000));
            break;

          case 'modify_channel':
            const targetChannel = await promptChannel(message.channel, message.author, message.guild);
            if (targetChannel) {
              saveWelcomeConfig(message.guild.id, { channelId: targetChannel.id });
              await message.channel.send({
                embeds: [successEmbed('Salon Configuré', `Le salon de bienvenue est maintenant ${targetChannel}.`)]
              }).then(msg => setTimeout(() => msg.delete().catch(() => { }), 5000));
            }
            break;

          case 'delete_channel':
            saveWelcomeConfig(message.guild.id, { channelId: null });
            await message.channel.send({
              embeds: [successEmbed('Salon Supprimé', 'Le salon de bienvenue a été retiré.')]
            }).then(msg => setTimeout(() => msg.delete().catch(() => { }), 5000));
            break;

          case 'modify_message':
            const msgText = await promptText(
              message.channel,
              message.author,
              '📝 Message de Bienvenue',
              'Entrez votre message de bienvenue\n\nVariables disponibles:\n' +
              '`{user}` `{user:name}` `{inviter}` `{invite:count}` `{member:counter}` `{guild:name}`'
            );
            if (msgText) {
              saveWelcomeConfig(message.guild.id, { message: msgText, embed: null });
              await message.channel.send({
                embeds: [successEmbed('Message Configuré', 'Le message de bienvenue a été enregistré.')]
              }).then(msg => setTimeout(() => msg.delete().catch(() => { }), 5000));
            }
            break;

          case 'delete_message':
            saveWelcomeConfig(message.guild.id, { message: null });
            await message.channel.send({
              embeds: [successEmbed('Message Supprimé', 'Le message de bienvenue a été supprimé.')]
            }).then(msg => setTimeout(() => msg.delete().catch(() => { }), 5000));
            break;

          case 'modify_embed':
            const embedData = await embedEditor(message.channel, message.author, message.guild);
            if (embedData) {
              saveWelcomeConfig(message.guild.id, { embed: embedData, message: null });
              await message.channel.send({
                embeds: [successEmbed('Embed Configuré', 'L\'embed de bienvenue a été enregistré.')]
              }).then(msg => setTimeout(() => msg.delete().catch(() => { }), 5000));
