const Discord = require('discord.js');
const logger = require('../../utils/logger');
const { replyError } = require('../../utils/embedDesign');

logger.info('[INTERACTION-HANDLER] Module chargé');

if (!global._handledInteractions) {
  global._handledInteractions = new Set();
}

module.exports = async (client, interaction) => {
  try {
    const interactionKey = interaction.id;

    if (global._handledInteractions.has(interactionKey)) {
      return;
    }
    global._handledInteractions.add(interactionKey);
    setTimeout(() => global._handledInteractions.delete(interactionKey), 10000);

    logger.info(`[INTERACTION] Type: ${interaction.type} | CustomId: ${interaction.customId || 'N/A'} | User: ${interaction.user.tag}`);

    // ==================== COMMANDE SLASH ABONNEMENT (superadmin only) ====================
    if (interaction.isChatInputCommand() && interaction.commandName === 'abonnement') {
      const { addOsintAbonne } = require('../../utils/osintHelpers');
      const superadmin = client.config?.superadmin || [];
      const isSuper = Array.isArray(superadmin) && superadmin.includes(interaction.user?.id);

      if (!isSuper) {
        return replyError(interaction, 'Seul le superadmin peut utiliser cette commande.');
      }

      const targetUser = interaction.options.getUser('user');
      const credits = interaction.options.getInteger('credit');
      if (!targetUser || credits === null || credits < 0) {
        return replyError(interaction, 'Utilisation : `/abonnement @user <crédits>`');
      }

      addOsintAbonne(targetUser.id, credits, interaction.user.id);
      return interaction.reply({
        content: `<a:_:1483497369315315786> **${targetUser.tag}** a été ajouté aux abonnés OSINT avec **${credits}** crédits.`,
        ephemeral: true
      });
    }

    // ==================== COMMANDES SLASH OSINT ====================
    if (interaction.isChatInputCommand()) {
      const { OSINT_SLASH_NAMES, getArgsFromInteraction } = require('../../utils/osintSlashCommands');
      const { buildMessageFromInteraction, checkOsintPermission, getCredits, OSINT_COST, replyInsufficientCredits } = require('../../utils/osintHelpers');

      if (OSINT_SLASH_NAMES.includes(interaction.commandName)) {
        const isLookup = interaction.commandName === 'lookup';
        await interaction.deferReply({ ephemeral: true }).catch(() => {});

        const messageLike = buildMessageFromInteraction(interaction);
        const guildId = interaction.guild?.id;
        const userId = interaction.user?.id;

        if (!checkOsintPermission(client, interaction)) {
          return interaction.editReply({ content: 'Accès refusé.' }).catch(() => {});
        }

        const totalCredits = getCredits(userId, guildId);
        let cost = interaction.commandName === 'lookup' ? 100 : OSINT_COST;
        if (interaction.commandName === 'osint_resources') cost = 0;
        if (totalCredits < cost) {
          return replyInsufficientCredits((opt) => interaction.editReply(opt), cost, totalCredits);
        }

        const command = client.commands?.get(interaction.commandName);
        if (!command || typeof command.run !== 'function') {
          return interaction.editReply({ content: 'Commande introuvable.' }).catch(() => {});
        }

        const args = getArgsFromInteraction(interaction);
        const prefix = client.config?.prefix || '+';
        const color = client.config?.color || client.config?.SETTINGS?.EMBED_COLOR;

        try {
          await command.run(client, messageLike, args, prefix, color);
        } catch (err) {
          logger.error('[OSINT-SLASH]', err);
          await interaction.editReply({ content: 'Erreur : ' + (err.message || String(err)) }).catch(() => {});
        }
        return;
      }
    }

    // ==================== LOOKUP OSINT (menu de sélection / pagination) ====================
    const lookupCustomId = interaction.customId || '';
    if ((interaction.isButton() || interaction.isStringSelectMenu()) && (lookupCustomId.startsWith('lookup_section_') || lookupCustomId.startsWith('lookup_first_') || lookupCustomId.startsWith('lookup_prev_') || lookupCustomId.startsWith('lookup_next_') || lookupCustomId.startsWith('lookup_last_'))) {
      const lookupCommand = require('../../commands/osint/lookup');
      const state = lookupCommand.getLookupState(interaction.message?.id);
      if (!state) {
        return interaction.reply({ content: 'Session expirée ou bot redémarré. Relancez la commande lookup.', ephemeral: true }).catch(() => {});
      }
      if (interaction.user.id !== state.authorId) {
        return interaction.reply({ content: 'Ce menu est réservé à l\'auteur de la commande.', ephemeral: true }).catch(() => {});
      }
      const authorId = state.authorId;
      if (interaction.isStringSelectMenu() && lookupCustomId === `lookup_section_${authorId}`) {
        const val = interaction.values?.[0] || '';
        const idx = parseInt(val.replace('section_', ''), 10);
        if (!Number.isNaN(idx) && idx >= 0 && idx < state.sections.length) {
          state.sectionIndex = idx;
          state.pageIndex = 0;
        }
      } else {
        const payload = lookupCustomId.replace(/^lookup_/, '').split('_');
        const action = payload[0];
        const sec = state.sections[state.sectionIndex] || state.sections[0];
        const totalPages = Math.max(1, (sec?.contentPages || []).length);
        switch (action) {
          case 'first': state.pageIndex = 0; break;
          case 'prev': state.pageIndex = Math.max(0, state.pageIndex - 1); break;
          case 'next': state.pageIndex = Math.min(totalPages - 1, state.pageIndex + 1); break;
          case 'last': state.pageIndex = Math.max(0, totalPages - 1); break;
          default: break;
        }
      }
      const lookupContainer = lookupCommand.buildLookupEmbedFromState(state, client);
      const components = lookupCommand.buildLookupComponentsFromState(state);
      return interaction.update({ components: [lookupContainer, ...components], flags: 1 << 15 }).catch((err) => {
        logger.error('[LOOKUP] interaction.update failed', err);
        if (!interaction.replied && !interaction.deferred) {
          interaction.reply({ content: 'Erreur lors de la mise à jour du menu.', ephemeral: true }).catch(() => {});
        }
      });
    }

    // ==================== CAPTCHA ====================
    async function sendCaptchaLog(guild, user, role, type, failed = false, reason = null) {
      try {
        const { LogSystem } = require('../../utils/logSystem');
        const { EmbedBuilder } = require('discord.js');
        const now = new Date();
        const embed = new EmbedBuilder()
          .setTitle(failed ? '🔐 Échec de vérification CAPTCHA' : '🔐 Vérification CAPTCHA réussie')
          .setColor(failed ? 0xED4245 : 0x57F287)
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '👤 Membre', value: `<@${user.id}> \`${user.tag}\``, inline: true },
            { name: '🆔 ID', value: `\`${user.id}\``, inline: true },
            ...(role ? [{ name: '🎖️ Rôle cible', value: role.toString(), inline: true }] : []),
            { name: '🔑 Type', value: type === 'public' ? 'Bouton public' : 'Bouton personnalisé', inline: true },
            ...(failed && reason ? [{ name: '❌ Raison', value: reason, inline: false }] : []),
            { name: '🗓️ Date', value: `<t:${Math.floor(now.getTime() / 1000)}:F>`, inline: true },
          )
          .setFooter({ text: guild.name, iconURL: guild.iconURL() || undefined })
          .setTimestamp(now);
        await LogSystem.send(guild, 'MODERATION', embed);
        logger.info(`[CAPTCHA] Log ${failed ? 'échec' : 'succès'} envoyé pour ${user.tag}`);
      } catch (err) {
        logger.error('[CAPTCHA] Erreur envoi log:', err);
      }
    }

    if (interaction.isButton() && interaction.customId === 'captcha_verify') {
      const guild = interaction.guild;
      const db = require('../../utils/simpledb');
      const cfg = db.get(`captcha_${guild.id}`) || {};
      const roleId = cfg.roleId || db.get(`captcha_role_${guild.id}`);
      if (!roleId) return replyError(interaction, 'Rôle de vérification non configuré.');
      const role = guild.roles.cache.get(roleId);
      if (!role) return replyError(interaction, 'Rôle introuvable sur le serveur.');
      const member = await guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) return replyError(interaction, 'Membre introuvable.');
      try {
        await member.roles.add(role, '[CAPTCHA] Vérification réussie');
        if (cfg.muteRoleId) {
          const muteRole = guild.roles.cache.get(cfg.muteRoleId);
          if (muteRole && member.roles.cache.has(cfg.muteRoleId)) {
            await member.roles.remove(muteRole, '[CAPTCHA] Quarantaine levée').catch(() => {});
          }
        }
        await interaction.reply({ content: '✅ Vérification réussie, bienvenue !', ephemeral: true });
        sendCaptchaLog(guild, interaction.user, role, 'public');
      } catch (e) {
        sendCaptchaLog(guild, interaction.user, role, 'public', true, e?.message || 'Impossible d\'attribuer le rôle (permissions insuffisantes)');
        return replyError(interaction, 'Impossible d\'attribuer le rôle. Vérifiez mes permissions.');
      }
      return;
    }

    if (interaction.isButton() && interaction.customId && interaction.customId.startsWith('captcha_verify_')) {
      const targetId = interaction.customId.replace('captcha_verify_', '');
      if (interaction.user.id !== targetId) {
        return replyError(interaction, 'Ce bouton ne t\'est pas destiné.');
      }

      const guild = interaction.guild;
      const db = require('../../utils/simpledb');
      const cfg = db.get(`captcha_${guild.id}`) || {};
      const roleId = cfg.roleId || db.get(`captcha_role_${guild.id}`);

      if (!roleId) {
        return replyError(interaction, 'Rôle de vérification non configuré.');
      }

      const role = guild.roles.cache.get(roleId);
      if (!role) {
        return replyError(interaction, 'Rôle introuvable sur le serveur.');
      }

      const member = await guild.members.fetch(targetId).catch(() => null);
      if (!member) {
        return replyError(interaction, 'Membre introuvable.');
      }

      try {
        await member.roles.add(role, '[CAPTCHA] Vérification réussie');
        if (cfg.muteRoleId) {
          const muteRole = guild.roles.cache.get(cfg.muteRoleId);
          if (muteRole && member.roles.cache.has(cfg.muteRoleId)) {
            await member.roles.remove(muteRole, '[CAPTCHA] Quarantaine levée').catch(() => {});
          }
        }
        await interaction.reply({ content: '✅ Vérification réussie, bienvenue !', ephemeral: true });
        await interaction.message.delete().catch(() => {});
        sendCaptchaLog(guild, interaction.user, role, 'personal');
        logger.info(`[CAPTCHA] Vérification réussie pour ${interaction.user.tag}`);
      } catch (e) {
        sendCaptchaLog(guild, interaction.user, role, 'personal', true, e?.message || 'Impossible d\'attribuer le rôle (permissions insuffisantes)');
        return replyError(interaction, 'Impossible d\'attribuer le rôle. Vérifie mes permissions.');
      }
      return;
    }

    // ==================== SOUTIEN ====================
    if (
      (interaction.isModalSubmit() && interaction.customId.startsWith('soutien_')) ||
      (interaction.isStringSelectMenu() && interaction.customId === 'detection_type_menu')
    ) {
      logger.info('[SOUTIEN] Interaction détectée');
      const soutienCommand = require('../../commands/gestion/soutien');
      if (soutienCommand.handleInteraction) {
        await soutienCommand.handleInteraction(interaction);
        logger.info('[SOUTIEN] Interaction traitée avec succès');
        return;
      }
    }

    // ==================== WELCOME ====================
    if (
      (interaction.isStringSelectMenu() && interaction.customId === 'welcome_menu') ||
      (interaction.isButton() && ['refresh', 'view_embed'].includes(interaction.customId))
    ) {
      logger.info('[WELCOME] Interaction détectée');
      const welcomeCommand = require('../../commands/gestion/welcome');
      if (welcomeCommand.handleInteraction) {
        await welcomeCommand.handleInteraction(interaction);
        logger.info('[WELCOME] Interaction traitée avec succès');
        return;
      }
    }

    // ==================== ANTILINK WL (menus rôle + permissions) ====================
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('antilink_wl_')) {
      const antilinkCommand = require('../../commands/gestion/antilink');
      if (antilinkCommand.handleInteraction) {
        const handled = await antilinkCommand.handleInteraction(interaction);
        if (handled) return;
      }
    }

    // ==================== WARN REMOVE (sélection des warns à retirer) ====================
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('warn_remove_')) {
      const warnCommand = require('../../commands/mods/warn');
      if (warnCommand.handleInteraction) {
        const handled = await warnCommand.handleInteraction(interaction);
        if (handled) return;
      }
    }

    // ==================== TICKETS ====================
    const ticketCustomIds = [
      'ticket_type_select',
      'remove_staff_menu',
      'remove_ticket_type',
      'ticket_type_add_btn',
      'ticket_type_remove_btn',
      'ticket_type_role_btn',
      'ticket_type_remove_select',
      'ticket_type_role_type_select',
      'ticket_type_category_btn',
      'ticket_type_category_reset_btn',
      'ticket_type_category_type_select',
      'close_ticket',
      'claim_ticket',
      'unclaim_ticket',
      'transcript_ticket',
      'confirm_close',
      'cancel_close',
      'ticket_add_type_modal',
      'ticket_create_modal',
    ];

    if (ticketCustomIds.some(id => interaction.customId === id || interaction.customId?.startsWith(id))) {
      logger.info('[TICKET] Interaction détectée');
      const ticketCommand = require('../../commands/gestion/ticket');
      if (ticketCommand.handleInteraction) {
        await ticketCommand.handleInteraction(interaction);
        logger.info('[TICKET] Interaction traitée avec succès');
        return;
      }
    }

    // ==================== BOUTONS VN1 ====================
    if (interaction.isButton() && client.vn1Buttons && client.vn1Buttons.has(interaction.customId)) {
      logger.info('[VN1-BUTTON] Interaction détectée');
      const cfg = client.vn1Buttons.get(interaction.customId);
      const ephemeral = cfg.actionData?.ephemeral !== false;

      try {
        await interaction.deferReply({ ephemeral });
      } catch (_) { }

      try {
        if (cfg.actionType === 'message') {
          await interaction.editReply({ content: cfg.actionData?.text || 'Action !' });
        } else if (cfg.actionType === 'embed') {
          const embed = new Discord.EmbedBuilder()
            .setDescription(cfg.actionData?.text || '')
            .setColor('#00bfff');
          await interaction.editReply({ embeds: [embed], content: '' });
        } else if (cfg.actionType === 'salon') {
          const me = interaction.guild.members.me;
          if (!me || !me.permissions.has(Discord.PermissionFlagsBits.ManageChannels)) {
            await interaction.editReply({ content: 'Je n\'ai pas la permission de gérer les salons.' });
            return;
          }

          const name = cfg.actionData?.channelName || 'nouveau-salon';
          const type = cfg.actionData?.channelType === 2
            ? Discord.ChannelType.GuildVoice
            : Discord.ChannelType.GuildText;
          const parent = cfg.actionData?.categoryId || null;
          const overwrites = [];

          if (cfg.actionData?.private) {
            overwrites.push(
              { id: interaction.guild.id, deny: [Discord.PermissionFlagsBits.ViewChannel] },
              {
                id: interaction.user.id,
                allow: [
                  Discord.PermissionFlagsBits.ViewChannel,
                  Discord.PermissionFlagsBits.SendMessages,
                  Discord.PermissionFlagsBits.Connect,
                  Discord.PermissionFlagsBits.Speak
                ]
              }
            );
          }

          const created = await interaction.guild.channels.create({
            name,
            type,
            parent,
            permissionOverwrites: overwrites
          });

          await interaction.editReply({ content: `<a:_:1483497369315315786> Salon créé: ${created}` });
        } else if (cfg.actionType === 'role') {
          const roleId = cfg.actionData?.roleId;
          const guild = interaction.guild;
          const member = interaction.member;
          const role = guild?.roles?.cache.get(roleId);

          if (!guild || !member || !role) {
            await interaction.editReply({ content: 'Configuration role invalide.' });
            return;
          }

          const me = guild.members.me;
          if (!me || !me.permissions.has(Discord.PermissionFlagsBits.ManageRoles)) {
            await interaction.editReply({ content: 'Je n\'ai pas la permission de gérer les rôles.' });
            return;
          }

          if (role.managed || role.position >= me.roles.highest.position) {
            await interaction.editReply({ content: 'Je ne peux pas gérer ce rôle (position trop élevée ou rôle géré).' });
            return;
          }

          try {
            const hasRole = member.roles.cache.has(role.id);
            if (hasRole) {
              await member.roles.remove(role);
              await interaction.editReply({ content: `<a:_:1483497369315315786> Rôle retiré: ${role}` });
            } else {
              await member.roles.add(role);
              await interaction.editReply({ content: `<a:_:1483497369315315786> Rôle ajouté: ${role}` });
            }
          } catch (e) {
            return interaction.editReply({ content: 'Impossible d\'attribuer le rôle. Vérifie mes permissions.' });
          }
        } else {
          await interaction.editReply({ content: '<:_:1483497414575915268> Action non configurée.' });
        }

        logger.info('[VN1-BUTTON] Action exécutée avec succès');
      } catch (e) {
        logger.error('[VN1-BUTTON] Erreur:', e);
        const msg = e?.message || 'Erreur inconnue';
        await replyError(interaction, msg);
      }
      return;
    }

    // ==================== EMBED BUTTONS ====================
    if (interaction.isButton()) {
      logger.info('[EMBED-BUTTON] Tentative de traitement');
      try {
        const buttonInteraction = require('../../util/embedButton/start').buttonInteraction;
        if (buttonInteraction) {
          const handled = await buttonInteraction(interaction, client);
          if (handled) {
            logger.info('[EMBED-BUTTON] Traité avec succès');
            return;
          }
        }
      } catch (e) {
        logger.debug('[EMBED-BUTTON] Non géré par embedButton/start:', e.message);
      }
    }

    // ==================== CRUSH BOT (profils / guide / création) ====================
    if (
      (interaction.isButton() && interaction.customId && interaction.customId.startsWith('crush_')) ||
      (interaction.isModalSubmit() && interaction.customId && interaction.customId.startsWith('crush_'))
    ) {
      try {
        const crushProfil = require('../../commands/crush/profil');
        if (crushProfil.handleInteraction) {
          const handled = await crushProfil.handleInteraction(interaction);
          if (handled) return;
        }
      } catch (err) {
        logger.error('[CRUSH] Erreur handleInteraction:', err);
        if (!interaction.replied && !interaction.deferred) {
          await replyError(interaction, 'Erreur lors du traitement. Réessaie ou contacte un admin.');
        }
        return;
      }
    }

    // ==================== ROLEMENU CONFIG ====================
    const rolemenuConfigIds = [
      'rolemenu_select',
      'rolemenu_validate',
      'rolemenu_refresh'
    ];

    if (rolemenuConfigIds.some(id => interaction.customId === id)) {
      logger.info('[ROLEMENU-CONFIG] Interaction de configuration détectée');
      return;
    }

    // ==================== ROLEMENU ====================
    if (interaction.isButton() && interaction.customId && interaction.customId.startsWith('rolemenu_')) {
      logger.info('[ROLEMENU] Interaction détectée');
      const roleId = interaction.customId.slice('rolemenu_'.length);
      const guild = interaction.guild;
      const member = interaction.member;
      const role = guild?.roles?.cache.get(roleId);

      if (!guild || !member || !role) {
        if (!interaction.replied && !interaction.deferred) {
          await replyError(interaction, 'Configuration du rolemenu invalide.');
        }
        return;
      }

      const me = guild.members.me;
      if (!me || !me.permissions.has(Discord.PermissionFlagsBits.ManageRoles)) {
        await replyError(interaction, 'Je n\'ai pas la permission de gérer les rôles.');
        return;
      }

      if (role.managed || role.position >= me.roles.highest.position) {
        await replyError(interaction, 'Je ne peux pas gérer ce rôle (position trop élevée ou rôle géré).');
        return;
      }

      try {
        await interaction.deferReply({ ephemeral: true });
        const hasRole = member.roles.cache.has(role.id);

        if (hasRole) {
          await member.roles.remove(role);
          await interaction.editReply({ content: `<a:_:1483497369315315786> Rôle retiré: ${role}` });
          logger.info(`[ROLEMENU] Rôle retiré: ${role.name} pour ${member.user.tag}`);
        } else {
          await member.roles.add(role);
          await interaction.editReply({ content: `<a:_:1483497369315315786> Rôle ajouté: ${role}` });
          logger.info(`[ROLEMENU] Rôle ajouté: ${role.name} pour ${member.user.tag}`);
        }
      } catch (e) {
        logger.error('[ROLEMENU] Erreur:', e);
        const msg = e?.message || 'Erreur inconnue';
        await replyError(interaction, `Impossible de modifier le rôle: ${msg}`);
      }
      return;
    }

    // ==================== GHOST (ghostping général — niveau 6) ====================
    if (interaction.isChatInputCommand() && interaction.commandName === 'ghost') {
      logger.info('[GHOST] Commande slash détectée');
      const ghostCommand = require('../../commands/admin/ghost');
      await ghostCommand.execute(interaction, client);
      return;
    }

    // ==================== CONFESS (confession anonyme) ====================
    if (interaction.isChatInputCommand() && interaction.commandName === 'confess') {
      logger.info('[CONFESS] Commande slash détectée');
      const confessCommand = require('../../commands/fun/confess');
      await confessCommand.execute(interaction, client);
      return;
    }

    // ==================== CONFESS BOUTONS (répondre anonymement / signaler) ====================
    if (
      interaction.customId &&
      (interaction.customId.startsWith('confess_reply_') || interaction.customId.startsWith('confess_report_'))
    ) {
      logger.info('[CONFESS] Interaction bouton/modal détectée');
      const confessCommand = require('../../commands/fun/confess');
      if (confessCommand.handleInteraction) {
        await confessCommand.handleInteraction(interaction, client);
      }
      return;
    }

    // ==================== LINKCHANNEL (géré par le collector de la commande) ====================
    if (
      interaction.customId &&
      (interaction.customId.startsWith('lc_add_') ||
       interaction.customId.startsWith('lc_prev_') ||
       interaction.customId.startsWith('lc_next_') ||
       interaction.customId.startsWith('lc_del_') ||
       interaction.customId.startsWith('lc_delall_') ||
       interaction.customId.startsWith('lc_doremove_') ||
       interaction.customId.startsWith('lc_delcancel_'))
    ) {
      // Géré par le createMessageComponentCollector de la commande linkchannel
      logger.debug(`[LINKCHANNEL] Interaction ${interaction.customId} gérée par le collector`);
      return;
    }

    // ==================== AUTRES INTERACTIONS ====================
    logger.debug(`[INTERACTION] Aucun gestionnaire spécifique trouvé pour: ${interaction.customId || 'N/A'}`);

  } catch (error) {
    logger.error('[INTERACTION] Erreur dans interactionCreate:', error);
    logger.error('[INTERACTION] Stack:', error.stack);
    if (!interaction.replied) {
      try {
        await replyError(interaction, 'Une erreur est survenue lors du traitement de votre demande.');
      } catch (err) {
        logger.error('[INTERACTION] Erreur lors de la réponse d\'erreur:', err);
      }
    }
  }
};


logger.info('[INTERACTION-HANDLER] Module exporté avec succès');
module.exports.eventName = 'interactionCreate';
