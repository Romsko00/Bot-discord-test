const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} = require('discord.js');
const { generateFromMessages } = require('discord-html-transcripts');

// Filtre les messages IS_COMPONENTS_V2 qui font planter discord-html-transcripts
async function safeCreateTranscript(channel, filename) {
  const IS_COMPONENTS_V2 = 1 << 15;
  const fetched = await channel.messages.fetch({ limit: 100 }).catch(() => new Map());
  const messages = [...fetched.values()].filter(m => !(m.flags?.bitfield & IS_COMPONENTS_V2));
  return generateFromMessages(messages, channel, {
    filename: filename || `transcript-${channel.name}.html`,
    saveImages: false,
    poweredBy: false,
  });
}
const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

function parseEmoji(raw) {
  if (!raw) return '🎫';
  const trimmed = String(raw).trim();
  if (!trimmed) return '🎫';
  // Emoji custom Discord : <:nom:id> ou <a:nom:id>
  const custom = trimmed.match(/^<?(a?):([^:]+):(\d+)>?$/);
  if (custom) return { animated: custom[1] === 'a', name: custom[2], id: custom[3] };
  // Si c'est du texte ASCII pur (pas un vrai emoji), on utilise le défaut
  if (/^[\x20-\x7E]+$/.test(trimmed)) return '🎫';
  // Emoji unicode valide (contient des caractères hors ASCII)
  return trimmed;
}

function safeLabel(name) {
  const label = (name || '').trim().substring(0, 25);
  return label.length > 0 ? label : 'Type sans nom';
}

module.exports = {
  name: 'ticket',
  aliases: ['tickets', 'support'],
  category: 'utility',
  description: 'Système de tickets personnalisable',

  handleInteraction: async (interaction) => {
    try {
      if (interaction.isButton() && interaction.customId === 'ticket_type_add_btn') {
        await addTicketTypeInteractive(interaction);
        return;
      }

      if (interaction.isButton() && interaction.customId === 'ticket_type_remove_btn') {
        const types = db.get(`ticket_types_${interaction.guild.id}`) || [];
        if (types.length === 0) {
          return interaction.reply({ content: 'Aucun type de ticket configuré.', ephemeral: true });
        }
        const menu = new StringSelectMenuBuilder()
          .setCustomId('ticket_type_remove_select')
          .setPlaceholder('Sélectionnez le type à supprimer')
          .addOptions(types.slice(0, 25).map((type) => ({
            label: safeLabel(type.name),
            value: type.id,
            description: (type.description || 'Sans description').substring(0, 50),
            emoji: parseEmoji(type.emoji)
          })));
        await interaction.reply({ content: 'Sélectionnez le type à supprimer :', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_type_remove_select') {
        const types = db.get(`ticket_types_${interaction.guild.id}`) || [];
        const removed = types.find(t => t.id === interaction.values[0]);
        db.set(`ticket_types_${interaction.guild.id}`, types.filter((t) => t.id !== interaction.values[0]));
        await interaction.update({
          content: `Type **${removed?.name || '?'}** supprimé avec succès.`,
          components: []
        });
        return;
      }

      if (interaction.isButton() && interaction.customId === 'ticket_type_role_btn') {
        const types = db.get(`ticket_types_${interaction.guild.id}`) || [];
        if (types.length === 0) return interaction.reply({ content: 'Aucun type configuré.', ephemeral: true });
        const menu = new StringSelectMenuBuilder()
          .setCustomId('ticket_type_role_type_select')
          .setPlaceholder('Sélectionnez un type')
          .addOptions(types.slice(0, 25).map((type) => ({ label: safeLabel(type.name), value: type.id, description: (type.description || 'Sans description').substring(0, 50), emoji: parseEmoji(type.emoji) })));
        await interaction.reply({ content: 'Sélectionnez le type pour associer un rôle :', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_type_role_type_select') {
        const types = db.get(`ticket_types_${interaction.guild.id}`) || [];
        const selectedType = types.find((t) => t.id === interaction.values[0]);
        if (!selectedType) return interaction.reply({ content: 'Type introuvable.', ephemeral: true });
        await interaction.reply({ content: `Mentionnez le rôle à associer au type **${selectedType.name}**, ou tapez \`none\` pour retirer :`, ephemeral: true });
        try {
          const response = await interaction.channel.awaitMessages({ filter: (m) => m.author.id === interaction.user.id, max: 1, time: 60000, errors: ['time'] });
          const msg = response.first();
          const role = msg.mentions.roles.first() || interaction.guild.roles.cache.get(msg.content);
          if (msg.content.toLowerCase() === 'none') { selectedType.roleId = null; }
          else if (role) { selectedType.roleId = role.id; }
          else { await msg.delete().catch(() => {}); return interaction.followUp({ content: 'Rôle invalide.', ephemeral: true }); }
          db.set(`ticket_types_${interaction.guild.id}`, types);
          await msg.delete().catch(() => {});
          await interaction.followUp({ content: `Rôle mis à jour pour **${selectedType.name}** : ${selectedType.roleId ? (() => { const _tr = interaction.guild.roles.cache.get(selectedType.roleId); return _tr ? `${_tr.name} (\`${selectedType.roleId}\`)` : `\`${selectedType.roleId}\``; })() : '*Aucun*'}`, ephemeral: true });
        } catch { await interaction.followUp({ content: 'Temps écoulé.', ephemeral: true }); }
        return;
      }

      if (interaction.isButton() && interaction.customId === 'ticket_type_category_btn') {
        const types = db.get(`ticket_types_${interaction.guild.id}`) || [];
        if (types.length === 0) return interaction.reply({ content: 'Aucun type configuré.', ephemeral: true });
        const menu = new StringSelectMenuBuilder()
          .setCustomId('ticket_type_category_type_select')
          .setPlaceholder('Quel type configurer ?')
          .addOptions(types.slice(0, 25).map((type) => ({
            label: safeLabel(type.name),
            value: type.id,
            description: type.categoryId ? `Catégorie perso définie` : 'Catégorie globale (défaut)',
            emoji: parseEmoji(type.emoji)
          })));
        await interaction.reply({
          content: 'Sélectionnez le type dont vous souhaitez définir la catégorie :',
          components: [new ActionRowBuilder().addComponents(menu)],
          ephemeral: true
        });
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_type_category_type_select') {
        const types = db.get(`ticket_types_${interaction.guild.id}`) || [];
        const selectedType = types.find((t) => t.id === interaction.values[0]);
        if (!selectedType) return interaction.reply({ content: 'Type introuvable.', ephemeral: true });

        await interaction.reply({
          content:
            `**${selectedType.emoji || '🎫'} ${selectedType.name}** — Catégorie actuelle : ${selectedType.categoryId ? `<#${selectedType.categoryId}>` : '*Catégorie globale*'}\n\n` +
            `Mentionnez ou envoyez l'ID de la catégorie Discord pour ce type.\n` +
            `Tapez \`global\` pour utiliser la catégorie globale du système de tickets.`,
          ephemeral: true
        });

        try {
          const response = await interaction.channel.awaitMessages({
            filter: (m) => m.author.id === interaction.user.id,
            max: 1, time: 60000, errors: ['time']
          });
          const msg = response.first();

          if (msg.content.toLowerCase() === 'global') {
            selectedType.categoryId = null;
            db.set(`ticket_types_${interaction.guild.id}`, types);
            await msg.delete().catch(() => {});
            await interaction.followUp({ content: `✅ **${selectedType.name}** utilisera désormais la catégorie globale.`, ephemeral: true });
            return;
          }

          const catId = msg.mentions.channels.first()?.id || msg.content.replace(/[<#>]/g, '').trim();
          const category = interaction.guild.channels.cache.get(catId);
          await msg.delete().catch(() => {});

          if (!category || category.type !== ChannelType.GuildCategory) {
            return interaction.followUp({ content: '❌ Catégorie invalide. Vérifiez que c\'est bien une catégorie Discord.', ephemeral: true });
          }

          selectedType.categoryId = category.id;
          db.set(`ticket_types_${interaction.guild.id}`, types);
          await interaction.followUp({ content: `✅ Catégorie **${category.name}** définie pour le type **${selectedType.name}**.`, ephemeral: true });
        } catch {
          await interaction.followUp({ content: 'Temps écoulé.', ephemeral: true });
        }
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_type_select') {
        await createTicketFromSelection(interaction);
        return;
      }

      if (interaction.isButton()) {
        if (interaction.customId === 'close_ticket')      await handleCloseTicket(interaction);
        if (interaction.customId === 'claim_ticket')      await handleClaimTicket(interaction);
        if (interaction.customId === 'unclaim_ticket')    await handleUnclaimTicket(interaction);
        if (interaction.customId === 'transcript_ticket') await handleTranscriptButton(interaction);
        if (interaction.customId === 'confirm_close')     await handleConfirmClose(interaction);
        if (interaction.customId === 'cancel_close')      await interaction.update({ content: 'Fermeture annulée.', components: [] }).catch(() => {});
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_create_modal_')) {
        await handleTicketCreationModal(interaction);
        return;
      }

    } catch (error) {
      console.error('Erreur handleInteraction ticket:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Erreur lors du traitement de l\'interaction.', ephemeral: true }).catch(() => {});
      }
    }
  },

  run: async (client, message, args, prefix, color) => {
    if (!message.member) {
      try { message.member = await message.guild.members.fetch(message.author.id); }
      catch (e) { return message.reply('Erreur : impossible de récupérer vos informations de membre.'); }
    }

    let perm = false;
    message.member?.roles?.cache?.forEach((role) => {
      if (db.get(`admin_${message.guild.id}_${role.id}`)) perm = true;
      if (db.get(`ownerp_${message.guild.id}_${role.id}`)) perm = true;
    });

    const isAdmin = perm ||
      (client.config.superadmin && client.config.superadmin.includes(message.author.id)) ||
      (client.config.owners && client.config.owners.includes(message.author.id)) ||
      db.get(`ownermd_${client.user.id}_${message.author.id}`);

    if (!args[0]) {
      if (isAdmin) return await showTicketConfig(client, message, prefix);
      return message.reply('Vous devez spécifier une action.');
    }

    const action = args[0].toLowerCase();
    if (isAdmin) {
      switch (action) {
        case 'config':  await showTicketConfig(client, message, prefix); return;
        case 'panel':   await createTicketPanel(client, message, args.slice(1)); return;
        case 'setup':   await setupTicketSystem(client, message, args.slice(1)); return;
        case 'add-type': await addTicketType(client, message, args.slice(1)); return;
        case 'remove-type': await removeTicketType(client, message, args.slice(1)); return;
        case 'types':   await viewTicketTypes(client, message); return;
        case 'set-type-role': await setTicketTypeRole(client, message, args.slice(1)); return;
      }
    }

    const config = db.get(`ticket_config_${message.guild.id}`) || {};
    const types = db.get(`ticket_types_${message.guild.id}`) || [];
    const isInTicketCategory =
      (config.categoryId && message.channel.parentId === config.categoryId) ||
      types.some(t => t.categoryId && message.channel.parentId === t.categoryId);

    if (isInTicketCategory) {
      switch (action) {
        case 'add':    await addUserToTicket(client, message, args.slice(1)); return;
        case 'remove': await removeUserFromTicket(client, message, args.slice(1)); return;
        case 'rename': await renameTicket(client, message, args.slice(1)); return;
        case 'close':  await closeTicket(client, message); return;
        case 'claim':  await claimTicket(client, message); return;
        case 'reopen': await reopenTicket(client, message); return;
        default: message.reply('Commande non reconnue. Utilisez `add`, `remove`, `rename`, `close`, `claim` ou `reopen`.');
      }
    } else {
      message.reply('Cette commande ne peut être utilisée que dans un salon de ticket.');
    }
  }
};

// ======================= CONFIG UI =======================

async function showTicketConfig(client, message, prefix) {
  const config = db.get(`ticket_config_${message.guild.id}`) || {};
  const types  = db.get(`ticket_types_${message.guild.id}`) || [];

  const configLines = [
    `**Catégorie globale :** ${config.categoryId ? `<#${config.categoryId}>` : 'Non configurée'}`,
    `**Salon de logs :** ${config.logsChannelId ? `<#${config.logsChannelId}>` : 'Non configuré'}`,
    `**Rôles staff :** ${config.staffRoles?.length > 0 ? `${config.staffRoles.length} rôle(s)` : 'Aucun'}`,
    `**Types de tickets :** ${types.length > 0 ? `${types.length} type(s)` : 'Aucun'}`,
  ].join('\n');

  const configContainer = container(
    txt('## 🎫 Configuration — Tickets'),
    sep(),
    txt('Gérez le système de tickets via le menu ci-dessous.'),
    sep(),
    txt(configLines)
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket_config_menu')
    .setPlaceholder('Options de configuration...')
    .addOptions([
      { label: 'Définir Catégorie globale',   value: 'set_category',      description: 'Catégorie par défaut pour tous les tickets' },
      { label: 'Ajouter Rôle Staff',          value: 'add_staff',         description: 'Ajouter un rôle au staff tickets' },
      { label: 'Retirer Rôle Staff',          value: 'remove_staff',      description: 'Retirer un rôle du staff tickets' },
      { label: 'Gérer Types Tickets',         value: 'manage_types',      description: 'Ajouter / supprimer des types' },
      { label: 'Catégorie par type',          value: 'manage_categories', description: 'Définir une catégorie par type de ticket' },
      { label: 'Configurer Message',          value: 'set_message',       description: 'Message affiché dans le panel' },
      { label: 'Supprimer Message',           value: 'delete_message',    description: 'Supprimer le panel du salon' },
      { label: 'Créer Panel',                 value: 'create_panel',      description: 'Envoyer le menu de sélection' },
      { label: 'Définir Salon de Logs',       value: 'set_logs',          description: 'Salon pour les logs et transcripts' },
      { label: 'Voir Configuration',          value: 'view_config',       description: 'Afficher la config complète' }
    ]);

  const row = new ActionRowBuilder().addComponents(menu);
  const initialMessage = await message.channel.send({ components: [configContainer, row], flags: FLAGS });

  try {
    if (!client.__automodBypass) client.__automodBypass = new Map();
    client.__automodBypass.set(`${message.guild.id}:${message.channel.id}:${message.author.id}`, Date.now() + 300000);
  } catch (_) {}

  const collector = initialMessage.createMessageComponentCollector({
    filter: (i) => i.user.id === message.author.id,
    componentType: ComponentType.StringSelect,
    time: 900000
  });

  collector.on('collect', async (interaction) => {
    try {
      if (interaction.replied || interaction.deferred) return;
      switch (interaction.values[0]) {
        case 'set_category':      await interaction.deferReply({ ephemeral: true }); await setCategory(interaction, message); return;
        case 'add_staff':         await interaction.deferReply({ ephemeral: true }); await addStaffRole(interaction, message); return;
        case 'remove_staff':      await interaction.deferReply({ ephemeral: true }); await removeStaffRole(interaction, message); return;
        case 'manage_types':      await interaction.deferReply({ ephemeral: true }); await manageTicketTypes(interaction, message); return;
        case 'manage_categories': await interaction.deferReply({ ephemeral: true }); await manageTypeCategories(interaction, message); return;
        case 'set_message':       await interaction.deferReply({ ephemeral: true }); await setPanelMessage(interaction, message); return;
        case 'delete_message':    await interaction.deferReply({ ephemeral: true }); await deletePanelMessage(interaction, message); return;
        case 'set_logs':          await interaction.deferReply({ ephemeral: true }); await setLogsChannel(interaction, message); return;
        case 'create_panel':      await interaction.deferReply({ ephemeral: true }); await createPanel(interaction, message); return;
        case 'view_config':       await interaction.deferReply({ ephemeral: true }); await viewFullConfig(interaction, message); return;
      }
    } catch (error) {
      console.error('Erreur collector ticket config:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Une erreur est survenue.', ephemeral: true }).catch(() => {});
      }
    }
  });

  collector.on('end', () => {
    initialMessage.edit({ components: [container(txt('*Menu de configuration expiré.*'))], flags: FLAGS }).catch(() => {});
    try { client.__automodBypass?.delete(`${message.guild.id}:${message.channel.id}:${message.author.id}`); } catch (_) {}
  });
}

// ======================= ACTIONS CONFIG =======================

async function setCategory(interaction, message) {
  await interaction.editReply({ content: 'Mentionnez ou envoyez l\'ID de la catégorie **globale** pour les tickets :' });
  try {
    const response = await message.channel.awaitMessages({ filter: (m) => m.author.id === message.author.id, max: 1, time: 60000, errors: ['time'] });
    const msg = response.first();
    const catId = msg.mentions.channels.first()?.id || msg.content.replace(/[<#>]/g, '').trim();
    const category = message.guild.channels.cache.get(catId);
    if (!category || category.type !== ChannelType.GuildCategory) { await interaction.editReply({ content: 'Catégorie invalide.' }); return; }
    const config = db.get(`ticket_config_${message.guild.id}`) || {};
    config.categoryId = category.id;
    db.set(`ticket_config_${message.guild.id}`, config);
    await interaction.editReply({ content: `Catégorie globale définie : **${category.name}**` });
    await msg.delete().catch(() => {});
  } catch { await interaction.editReply({ content: 'Temps écoulé.' }); }
}

async function addStaffRole(interaction, message) {
  await interaction.editReply({ content: 'Mentionnez le ou les rôles staff à ajouter :' });
  try {
    const response = await message.channel.awaitMessages({ filter: (m) => m.author.id === message.author.id, max: 1, time: 60000, errors: ['time'] });
    const msg = response.first();
    const config = db.get(`ticket_config_${message.guild.id}`) || {};
    config.staffRoles = config.staffRoles || [];
    let addedRoles = [];
    msg.mentions.roles.forEach(role => {
      if (!config.staffRoles.includes(role.id)) { config.staffRoles.push(role.id); addedRoles.push(role.toString()); }
    });
    msg.content.split(/\s+/).forEach(arg => {
      const role = message.guild.roles.cache.get(arg.replace(/[<@&>]/g, ''));
      if (role && !config.staffRoles.includes(role.id)) { config.staffRoles.push(role.id); if (!addedRoles.includes(role.toString())) addedRoles.push(role.toString()); }
    });
    if (!addedRoles.length) { await interaction.editReply({ content: 'Aucun rôle valide trouvé.' }); return; }
    db.set(`ticket_config_${message.guild.id}`, config);
    await interaction.editReply({ content: `Rôle(s) staff ajouté(s) : ${addedRoles.join(', ')}` });
    await msg.delete().catch(() => {});
  } catch { await interaction.editReply({ content: 'Temps écoulé.' }); }
}

async function removeStaffRole(interaction, message) {
  const config = db.get(`ticket_config_${message.guild.id}`) || {};
  if (!config.staffRoles?.length) { await interaction.editReply({ content: 'Aucun rôle staff configuré.' }); return; }
  const menu = new StringSelectMenuBuilder().setCustomId('remove_staff_menu').setPlaceholder('Sélectionnez un rôle à retirer')
    .addOptions(config.staffRoles.map((roleId) => {
      const role = message.guild.roles.cache.get(roleId);
      return { label: role?.name || 'Rôle inconnu', value: roleId, description: `ID: ${roleId}` };
    }));
  const response = await interaction.editReply({ content: 'Sélectionnez le rôle à retirer :', components: [new ActionRowBuilder().addComponents(menu)] });
  const collector = response.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, componentType: ComponentType.StringSelect, time: 60000 });
  collector.on('collect', async (i) => {
    await i.deferUpdate();
    config.staffRoles = config.staffRoles.filter((id) => id !== i.values[0]);
    db.set(`ticket_config_${interaction.guild.id}`, config);
    await i.editReply({ content: 'Rôle retiré avec succès.', components: [] });
  });
  collector.on('end', async (collected) => { if (!collected.size) await response.edit({ content: 'Temps écoulé.', components: [] }).catch(() => {}); });
}

async function manageTicketTypes(interaction, message) {
  const types = db.get(`ticket_types_${message.guild.id}`) || [];
  const typeList = types.length > 0 ? types.map((t, i) => `${i + 1}. ${t.emoji || '🎫'} **${t.name}**`).join('\n') : 'Aucun type configuré.';
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_type_add_btn').setLabel('Ajouter').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_type_remove_btn').setLabel('Supprimer').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_type_role_btn').setLabel('Rôle par type').setStyle(ButtonStyle.Primary)
  );
  await interaction.editReply({ content: `**Gestion des Types de Tickets**\n\n${typeList}`, components: [buttons] });
}

async function manageTypeCategories(interaction, message) {
  const types  = db.get(`ticket_types_${message.guild.id}`) || [];
  const config = db.get(`ticket_config_${message.guild.id}`) || {};

  if (!types.length) {
    await interaction.editReply({ content: 'Aucun type de ticket configuré. Ajoutez-en d\'abord.' });
    return;
  }

  const lines = types.map(t => {
    const cat = t.categoryId ? message.guild.channels.cache.get(t.categoryId) : null;
    const catLabel = cat ? `📁 **${cat.name}**` : (config.categoryId ? `*Globale — ${message.guild.channels.cache.get(config.categoryId)?.name || config.categoryId}*` : '*Non configurée*');
    return `${t.emoji || '🎫'} **${t.name}** → ${catLabel}`;
  }).join('\n');

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_type_category_btn')
      .setLabel('Définir catégorie par type')
      .setEmoji('📁')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ticket_type_category_reset_btn')
      .setLabel('Réinitialiser tout')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Danger),
  );

  const msg = await interaction.editReply({
    content: `**📁 Catégories par type de ticket**\n\nChaque type peut avoir sa propre catégorie Discord.\nSi aucune catégorie n'est définie pour un type, la catégorie globale est utilisée.\n\n${lines}`,
    components: [buttons]
  });

  const col = msg.createMessageComponentCollector({
    filter: i => i.user.id === message.author.id && i.customId === 'ticket_type_category_reset_btn',
    time: 120_000
  });

  col.on('collect', async i => {
    const freshTypes = db.get(`ticket_types_${message.guild.id}`) || [];
    freshTypes.forEach(t => { delete t.categoryId; });
    db.set(`ticket_types_${message.guild.id}`, freshTypes);
    await i.update({
      content: '✅ Toutes les catégories ont été réinitialisées. La catégorie globale sera utilisée pour tous les types.',
      components: []
    }).catch(() => i.followUp({ content: '✅ Catégories réinitialisées.', ephemeral: true }).catch(() => {}));
  });
}

async function setLogsChannel(interaction, message) {
  await interaction.editReply({ content: 'Mentionnez le salon où seront envoyés les logs et transcripts :' });
  try {
    const response = await message.channel.awaitMessages({ filter: (m) => m.author.id === message.author.id, max: 1, time: 60000, errors: ['time'] });
    const msg = response.first();
    const channel = msg.mentions.channels.first() || message.guild.channels.cache.get(msg.content);
    if (!channel || channel.type !== ChannelType.GuildText) { await interaction.editReply({ content: 'Salon textuel invalide.' }); return; }
    const config = db.get(`ticket_config_${message.guild.id}`) || {};
    config.logsChannelId = channel.id;
    db.set(`ticket_config_${message.guild.id}`, config);
    await interaction.editReply({ content: `Salon de logs défini : ${channel}` });
    await msg.delete().catch(() => {});
  } catch { await interaction.editReply({ content: 'Temps écoulé.' }); }
}

async function setPanelMessage(interaction, message) {
  await interaction.editReply({ content: `Entrez le message du panel de tickets.\n\nVariables : \`{user}\` \`{server}\`` });
  try {
    const response = await message.channel.awaitMessages({ filter: (m) => m.author.id === message.author.id, max: 1, time: 120000, errors: ['time'] });
    const msg = response.first();
    const config = db.get(`ticket_config_${message.guild.id}`) || {};
    config.panelMessage = msg.content;
    db.set(`ticket_config_${message.guild.id}`, config);
    await interaction.editReply({ content: 'Message du panel configuré.' });
    await msg.delete().catch(() => {});
  } catch { await interaction.editReply({ content: 'Temps écoulé.' }); }
}

async function deletePanelMessage(interaction, message) {
  const messages = await message.channel.messages.fetch({ limit: 50 });
  const panelMessage = messages.find((msg) => msg.components.length > 0 && msg.components[0].components[0]?.customId === 'ticket_type_select');
  if (!panelMessage) { await interaction.editReply({ content: 'Aucun panel trouvé dans ce salon.' }); return; }
  await panelMessage.delete();
  await interaction.editReply({ content: 'Panel supprimé.' });
}

async function createPanel(interaction, message) {
  const types = db.get(`ticket_types_${message.guild.id}`) || [];
  if (!types.length) { return interaction.editReply({ content: 'Aucun type configuré. Ajoutez-en d\'abord.' }); }
  const menu = new StringSelectMenuBuilder().setCustomId('ticket_type_select').setPlaceholder('Choisissez un type de ticket')
    .addOptions(types.slice(0, 25).map((type) => ({
      label: safeLabel(type.name),
      value: type.id,
      description: (type.description || 'Sans description').substring(0, 50),
      emoji: parseEmoji(type.emoji)
    })));
  await message.channel.send({ components: [new ActionRowBuilder().addComponents(menu)] });
  await interaction.editReply({ content: 'Panel créé avec succès.' });
}

async function viewFullConfig(interaction, message) {
  const config = db.get(`ticket_config_${message.guild.id}`) || {};
  const types  = db.get(`ticket_types_${message.guild.id}`) || [];

  const typeLines = types.length > 0
    ? types.map((t, i) => {
        const cat = t.categoryId ? message.guild.channels.cache.get(t.categoryId) : null;
        const catLabel = cat ? `📁 ${cat.name}` : '*Catégorie globale*';
        const _tRole = t.roleId ? message.guild.roles.cache.get(t.roleId) : null;
        return `${i + 1}. ${t.emoji || '🎫'} **${t.name}**${t.roleId ? ` — ${_tRole ? `${_tRole.name} (\`${t.roleId}\`)` : `\`${t.roleId}\``}` : ''} — ${catLabel}`;
      }).join('\n')
    : '*Aucun type configuré*';

  const lines = [
    `**Catégorie globale :** ${config.categoryId ? `<#${config.categoryId}>` : '*Non configurée*'}`,
    `**Salon de logs :** ${config.logsChannelId ? `<#${config.logsChannelId}>` : '*Non configuré*'}`,
    `**Rôles staff :** ${config.staffRoles?.length > 0 ? config.staffRoles.map((id) => { const _sr = message.guild.roles.cache.get(id); return _sr ? `${_sr.name} (\`${id}\`)` : `\`${id}\``; }).join(', ') : '*Aucun rôle défini*'}`,
    `\n**Types de tickets :**\n${typeLines}`,
  ].join('\n');
  await interaction.editReply({ content: `**Configuration complète — Tickets**\n\n${lines}` });
}

// ======================= CRÉATION TICKET =======================

async function createTicketFromSelection(interaction) {
  try {
    const value    = interaction.values[0];
    const modal    = new ModalBuilder().setCustomId(`ticket_create_modal_${value}`).setTitle('Créer un ticket');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('ticket_reason')
        .setLabel('Décrivez votre demande')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Expliquez votre problème en détail...')
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(1000)
    ));
    await interaction.showModal(modal);
  } catch (error) {
    console.error('Erreur ouverture modal ticket:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Erreur lors de l\'ouverture du formulaire.', ephemeral: true });
    }
  }
}

async function handleTicketCreationModal(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const config = db.get(`ticket_config_${interaction.guild.id}`) || {};
    const types  = db.get(`ticket_types_${interaction.guild.id}`) || [];
    const typeId = interaction.customId.replace('ticket_create_modal_', '');
    const reason = interaction.fields.getTextInputValue('ticket_reason');

    const type = types.find(t => t.id === typeId);
    if (!type) {
      return interaction.editReply({ content: 'Type de ticket invalide ou introuvable.' });
    }
    const effectiveCategoryId = type.categoryId || config.categoryId;

    if (!effectiveCategoryId) {
      return interaction.editReply({
        content: `❌ Aucune catégorie configurée pour le type **${type.name}** ni de catégorie globale. Configurez-en une avec \`+ticket config\`.`
      });
    }

    const category = interaction.guild.channels.cache.get(effectiveCategoryId);
    if (!category) {
      return interaction.editReply({
        content: `❌ La catégorie configurée pour **${type.name}** est introuvable. Reconfigurez-la.`
      });
    }

    const me = interaction.guild.members.me;
    if (!category.permissionsFor(me).has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply({ content: 'Je n\'ai pas la permission de gérer les salons dans cette catégorie.' });
    }

    const overwrites = [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
      { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
    ];

    let staffRoleMentions = [];
    if (config.staffRoles?.length) {
      config.staffRoles.forEach(roleId => {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role) {
          overwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] });
          staffRoleMentions.push(`<@&${roleId}>`);
        }
      });
    }

    let typeRoleMention = null;
    if (type.roleId) {
      const typeRole = interaction.guild.roles.cache.get(type.roleId);
      if (typeRole) {
        overwrites.push({ id: type.roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
        typeRoleMention = `<@&${type.roleId}>`;
      }
    }

    let cleanName = interaction.user.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || interaction.user.id;
    const ticketNumber = (db.get(`ticket_count_${interaction.guild.id}`) || 0) + 1;
    db.set(`ticket_count_${interaction.guild.id}`, ticketNumber);

    const channel = await interaction.guild.channels.create({
      name: `ticket-${String(ticketNumber).padStart(4, '0')}-${cleanName}`,
      type: ChannelType.GuildText,
      parent: effectiveCategoryId,
      permissionOverwrites: overwrites,
      topic: `Ticket de ${interaction.user.tag} | Type: ${type.name} | ID: ${interaction.user.id}`
    });

    const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const roleToPing = typeRoleMention || (staffRoleMentions.length > 0 ? staffRoleMentions[0] : null);

    const openPanel = container(
      txt(`## ${type.emoji || '🎫'} Ticket — ${type.name}`),
      sep(),
      txt([
        `Bonjour ${interaction.user}, votre ticket a bien été créé.`,
        `Un membre du staff va prendre en charge votre demande dans les plus brefs délais.`,
        '',
        `**Demandeur :** ${interaction.user} — \`${interaction.user.tag}\``,
        `**Type :** ${type.emoji || '🎫'} ${type.name}`,
        `**Ticket :** \`#${String(ticketNumber).padStart(4, '0')}\``,
        `**Catégorie :** 📁 ${category.name}`,
        `**Raison :** ${reason.slice(0, 900)}`,
        '',
        `*${interaction.guild.name}  •  Aujourd'hui à ${timeStr}*`
      ].join('\n'))
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('Unclaim').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('transcript_ticket').setLabel('Transcript').setStyle(ButtonStyle.Primary).setEmoji('📄'),
      new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer').setStyle(ButtonStyle.Danger)
    );

    db.set(`ticket_data_${channel.id}`, { userId: interaction.user.id, userTag: interaction.user.tag, type: type.name, typeEmoji: type.emoji || '🎫', ticketNumber, categoryName: category.name, reason: reason.slice(0, 900), timeStr, claimedBy: null });

    await channel.send({
      content: roleToPing ? `${interaction.user} ${roleToPing}` : `${interaction.user}`
    });
    await channel.send({
      components: [openPanel, row],
      flags: FLAGS
    });

    await sendTicketLog(interaction.guild, 'created', interaction.user, {
      channel, ticketName: channel.name, reason, type: type.name, ticketNumber,
      categoryName: category.name
    });

    await interaction.editReply({ content: `Ticket créé avec succès : ${channel}` });

  } catch (error) {
    console.error('Erreur handleTicketCreationModal:', error);
    if (!interaction.replied) await interaction.editReply({ content: `Erreur : ${error.message}` }).catch(() => {});
  }
}

// ======================= ACTIONS SUR UN TICKET =======================

async function handleCloseTicket(interaction) {
  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('confirm_close').setLabel('Confirmer la fermeture').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
    new ButtonBuilder().setCustomId('cancel_close').setLabel('Annuler').setStyle(ButtonStyle.Secondary)
  );
  await interaction.reply({ content: '⚠️ Confirmer la fermeture de ce ticket ? Un transcript HTML sera généré automatiquement.', components: [confirmRow], ephemeral: true });
}

async function handleConfirmClose(interaction) {
  const channel = interaction.channel;
  const guild   = interaction.guild;
  const closedBy = interaction.user;

  await interaction.update({ content: 'Fermeture en cours — génération du transcript...', components: [] }).catch(() => {});

  try {
    await sendTicketLog(guild, 'closed', closedBy, { channel, ticketName: channel.name });
  } catch (e) {
    console.error('[TICKET] Erreur sendTicketLog lors de la fermeture:', e);
  }

  try {
    await logTicketTranscript(channel, guild, closedBy);
  } catch (e) {
    console.error('[TICKET] Erreur logTicketTranscript lors de la fermeture:', e);
  }

  // DM au créateur — toujours envoyé, indépendamment du salon de logs
  try {
    const ticketData = db.get(`ticket_data_${channel.id}`) || {};
    if (ticketData.userId) {
      const creator = await guild.members.fetch(ticketData.userId).catch(() => null);
      if (creator) {
        const dmEmbed = buildTicketClosedEmbed(guild, channel, ticketData, closedBy);
        let dmAttachment = null;
        try {
          dmAttachment = await safeCreateTranscript(channel, `transcript-${channel.name}.html`);
        } catch (_) {}

        const dmPayload = { embeds: [dmEmbed] };
        if (dmAttachment) dmPayload.files = [dmAttachment];

        await creator.send(dmPayload).catch(() => {});
      }
    }
  } catch (e) {
    console.error('[TICKET] Erreur DM fermeture:', e);
  }

  setTimeout(() => channel.delete().catch((e) => console.error('[TICKET] Erreur suppression salon:', e)), 3000);
}

async function handleTranscriptButton(interaction) {
  const config = db.get(`ticket_config_${interaction.guild.id}`) || {};
  const staffRoles = config.staffRoles || [];
  const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || interaction.member.roles.cache.some(r => staffRoles.includes(r.id));
  const ticketData = db.get(`ticket_data_${interaction.channel.id}`) || {};
  const isOwner = ticketData.userId === interaction.user.id;

  if (!isStaff && !isOwner) {
    return interaction.reply({ content: 'Seul le staff ou le créateur du ticket peut générer un transcript.', ephemeral: true });
  }

  await interaction.reply({ content: 'Génération du transcript en cours...', ephemeral: true });
  try {
    const attachment = await safeCreateTranscript(interaction.channel, `transcript-${interaction.channel.name}.html`);

    const logsChannel = config.logsChannelId ? interaction.guild.channels.cache.get(config.logsChannelId) : null;
    const meta = [
      `**Ticket :** \`${interaction.channel.name}\``,
      `**Demandé par :** ${interaction.user} — \`${interaction.user.tag}\``,
      `**Serveur :** ${interaction.guild.name}`,
    ].join('\n');

    if (logsChannel) {
      await logsChannel.send({
        components: [container(txt('## 📄 Transcript — Ticket'), sep(), txt(meta))],
        files: [attachment],
        flags: FLAGS
      });
    }

    // DM le transcript au créateur du ticket si staff le demande
    if (isStaff && ticketData.userId) {
      try {
        const creator = await interaction.guild.members.fetch(ticketData.userId);
        const dmAttachment = await safeCreateTranscript(interaction.channel, `transcript-${interaction.channel.name}.html`);
        await creator.send({ content: `Voici le transcript de votre ticket \`${interaction.channel.name}\` sur **${interaction.guild.name}** :`, files: [dmAttachment] }).catch(() => {});
      } catch (_) {}
    }

    await interaction.editReply({ content: logsChannel ? `✅ Transcript envoyé dans ${logsChannel}.` : '✅ Transcript généré (aucun salon de logs configuré).', ephemeral: true });
  } catch (err) {
    console.error('[TICKET] Erreur transcript button:', err);
    await interaction.editReply({ content: `❌ Erreur lors de la génération du transcript : ${err.message}`, ephemeral: true });
  }
}

async function handleClaimTicket(interaction) {
  const config     = db.get(`ticket_config_${interaction.guild.id}`) || {};
  const staffRoles = config.staffRoles || [];
  const member     = interaction.member;
  const isStaff    = member.permissions.has(PermissionFlagsBits.Administrator) || member.roles.cache.some(r => staffRoles.includes(r.id));
  if (!isStaff) return interaction.reply({ content: 'Seul le staff peut claim un ticket.', ephemeral: true });

  const topic     = interaction.channel.topic || '';
  const match     = topic.match(/ID: (\d+)/);
  const creatorId = match ? match[1] : null;
  if (creatorId && creatorId === interaction.user.id) return interaction.reply({ content: 'Vous ne pouvez pas claim votre propre ticket.', ephemeral: true });

  await interaction.deferUpdate();
  const ticketData = db.get(`ticket_data_${interaction.channel.id}`) || {};
  ticketData.claimedBy = interaction.user.id;
  ticketData.claimedByTag = interaction.user.tag;
  db.set(`ticket_data_${interaction.channel.id}`, ticketData);

  const newPanel = container(
    txt(`## ${ticketData.typeEmoji || '🎫'} Ticket — ${ticketData.type || 'Ticket'}`),
    sep(),
    txt([
      `**Demandeur :** <@${ticketData.userId}> — \`${ticketData.userTag || 'Inconnu'}\``,
      `**Type :** ${ticketData.typeEmoji || '🎫'} ${ticketData.type || 'Ticket'}`,
      `**Ticket :** \`#${String(ticketData.ticketNumber || 0).padStart(4, '0')}\``,
      `**Catégorie :** 📁 ${ticketData.categoryName || 'N/A'}`,
      `**Raison :** ${ticketData.reason || 'N/A'}`,
      '',
      `✅ **Pris en charge par :** ${interaction.user} — \`${interaction.user.tag}\``,
      '',
      `*${interaction.guild.name}  •  ${ticketData.timeStr || ''}*`
    ].join('\n'))
  );

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('Unclaim').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('transcript_ticket').setLabel('Transcript').setStyle(ButtonStyle.Primary).setEmoji('📄'),
    new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer').setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({ components: [newPanel, buttons], flags: FLAGS });
  await interaction.followUp({ content: `Ticket pris en charge par ${interaction.user}.`, ephemeral: true });
  await sendTicketLog(interaction.guild, 'claimed', interaction.user, { channel: interaction.channel, ticketName: interaction.channel.name });
}

async function handleUnclaimTicket(interaction) {
  const config     = db.get(`ticket_config_${interaction.guild.id}`) || {};
  const staffRoles = config.staffRoles || [];
  const isStaff    = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || interaction.member.roles.cache.some(r => staffRoles.includes(r.id));
  if (!isStaff) return interaction.reply({ content: 'Seul le staff peut unclaim un ticket.', ephemeral: true });

  await interaction.deferUpdate();
  const ticketData = db.get(`ticket_data_${interaction.channel.id}`) || {};
  ticketData.claimedBy = null;
  ticketData.claimedByTag = null;
  db.set(`ticket_data_${interaction.channel.id}`, ticketData);

  const newPanel = container(
    txt(`## ${ticketData.typeEmoji || '🎫'} Ticket — ${ticketData.type || 'Ticket'}`),
    sep(),
    txt([
      `**Demandeur :** <@${ticketData.userId}> — \`${ticketData.userTag || 'Inconnu'}\``,
      `**Type :** ${ticketData.typeEmoji || '🎫'} ${ticketData.type || 'Ticket'}`,
      `**Ticket :** \`#${String(ticketData.ticketNumber || 0).padStart(4, '0')}\``,
      `**Catégorie :** 📁 ${ticketData.categoryName || 'N/A'}`,
      `**Raison :** ${ticketData.reason || 'N/A'}`,
      '',
      `*${interaction.guild.name}  •  ${ticketData.timeStr || ''}*`
    ].join('\n'))
  );

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('Unclaim').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('transcript_ticket').setLabel('Transcript').setStyle(ButtonStyle.Primary).setEmoji('📄'),
    new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer').setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({ components: [newPanel, buttons], flags: FLAGS });
  await interaction.followUp({ content: `Ticket libéré par ${interaction.user}.`, ephemeral: true });
  await sendTicketLog(interaction.guild, 'unclaimed', interaction.user, { channel: interaction.channel, ticketName: interaction.channel.name });
}

// ======================= LOGS =======================

async function sendTicketLog(guild, eventType, user, extra = {}) {
  try {
    const config = db.get(`ticket_config_${guild.id}`) || {};
    if (!config.logsChannelId) return;
    const logsChannel = guild.channels.cache.get(config.logsChannelId);
    if (!logsChannel) return;

    const palette = {
      created: 0x57F287, claimed: 0x5865F2, unclaimed: 0xFEE75C,
      closed: 0xED4245, added: 0xEB459E, removed: 0x99AAB5, renamed: 0x3498DB,
    };
    const titles = {
      created: 'Ticket Ouvert', claimed: 'Ticket Claim', unclaimed: 'Ticket Unclaim',
      closed: 'Ticket Fermé', added: 'Membre Ajouté', removed: 'Membre Retiré', renamed: 'Ticket Renommé',
    };

    const emojiMap = { created: '🟢', claimed: '🔵', unclaimed: '🟡', closed: '🔴', added: '💜', removed: '⚫', renamed: '🔷' };
    const lines = [
      `## ${emojiMap[eventType] || '⚪'} ${titles[eventType] ?? `Ticket — ${eventType}`}`,
      '',
      `**Utilisateur :** ${user} — \`${user.tag}\``,
      `**ID :** \`${user.id}\``,
    ];
    if (extra.channel)      lines.push(`**Salon :** ${extra.channel} — \`${extra.channel.name}\``);
    if (extra.ticketNumber) lines.push(`**Numéro :** \`#${String(extra.ticketNumber).padStart(4, '0')}\``);
    if (extra.type)         lines.push(`**Type :** ${extra.type}`);
    if (extra.categoryName) lines.push(`**Catégorie :** 📁 ${extra.categoryName}`);
    if (extra.reason)       lines.push(`**Raison :** ${extra.reason.slice(0, 900)}`);
    if (extra.target)       lines.push(`**Cible :** ${extra.target} — \`${extra.target.tag}\``);
    if (extra.newName)      lines.push(`**Nouveau nom :** \`${extra.newName}\``);

    await logsChannel.send({ components: [container(txt(lines.join('\n')))], flags: FLAGS });
  } catch (err) {
    console.error('[TICKET-LOG] Erreur envoi log:', err);
  }
}

// ======================= EMBED DM TRANSCRIPT =======================

function buildTicketClosedEmbed(guild, channel, ticketData, closedBy) {
  const openedAt  = channel.createdAt;
  const closedAt  = new Date();
  const durationMs = closedAt - openedAt;
  const durationStr = formatDuration(durationMs);

  const openedFmt  = openedAt.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const closedFmt  = closedAt.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const fields = [
    { name: 'Ticket',      value: `\`${channel.name}\``,                                                              inline: true },
    { name: 'Numéro',      value: ticketData.ticketNumber ? `\`#${String(ticketData.ticketNumber).padStart(4, '0')}\`` : '—', inline: true },
    { name: 'Type',        value: ticketData.type ? `${ticketData.typeEmoji || '🎫'} ${ticketData.type}` : '—',      inline: true },
    { name: 'Ouvert le',   value: openedFmt,                                                                          inline: true },
    { name: 'Fermé le',    value: closedFmt,                                                                          inline: true },
    { name: 'Durée',       value: durationStr,                                                                        inline: true },
    { name: 'Fermé par',   value: closedBy ? `${closedBy} — \`${closedBy.tag}\`` : '—',                             inline: false },
    ticketData.claimedByTag ? { name: 'Pris en charge par', value: `\`${ticketData.claimedByTag}\``,                  inline: true } : null,
    ticketData.reason       ? { name: 'Raison initiale',    value: ticketData.reason.slice(0, 500),                   inline: false } : null,
  ].filter(Boolean);

  const embed = new EmbedBuilder()
    .setTitle('🔒 Votre ticket a été fermé')
    .setColor(0xED4245)
    .setDescription(`Merci d'avoir contacté le support de **${guild.name}**.\nVotre transcript est joint à ce message.`)
    .addFields(fields)
    .setFooter({ text: `${guild.name} • Support` })
    .setTimestamp()
    .setThumbnail(guild.iconURL({ dynamic: true }) || null);

  return embed;
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60)   return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}min ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ${m % 60}min`;
  const d = Math.floor(h / 24);
  return `${d}j ${h % 24}h`;
}

// ======================= TRANSCRIPT HTML (discord-html-transcripts) =======================

async function logTicketTranscript(channel, guild, closedBy) {
  try {
    const config = db.get(`ticket_config_${guild.id}`) || {};
    if (!config.logsChannelId) return;
    const logsChannel = guild.channels.cache.get(config.logsChannelId);
    if (!logsChannel) return;

    const ticketData = db.get(`ticket_data_${channel.id}`) || {};
    const createdAt  = channel.createdAt.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
    const closedAt   = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

    const attachment = await safeCreateTranscript(channel, `transcript-${channel.name}.html`);

    const meta = [
      `**Ticket :** \`${channel.name}\``,
      `**Fermé par :** ${closedBy} — \`${closedBy.tag}\``,
      `**Ouvert le :** ${createdAt}`,
      `**Fermé le :** ${closedAt}`,
      ticketData.type ? `**Type :** ${ticketData.typeEmoji || ''} ${ticketData.type}` : null,
      ticketData.ticketNumber ? `**Numéro :** \`#${String(ticketData.ticketNumber).padStart(4, '0')}\`` : null,
    ].filter(Boolean).join('\n');

    await logsChannel.send({
      components: [container(txt('## 📄 Transcript — Ticket Fermé'), sep(), txt(meta))],
      files: [attachment],
      flags: FLAGS
    });

  } catch (error) {
    console.error('[TICKET] Erreur génération transcript:', error);
  }
}

// ======================= COMMANDES TEXTE (legacy) =======================

async function createTicketPanel(client, message, args) {
  const types = db.get(`ticket_types_${message.guild.id}`) || [];
  if (!types.length) return message.reply('Aucun type de ticket configuré.');
  const menu = new StringSelectMenuBuilder().setCustomId('ticket_type_select').setPlaceholder('Choisissez un type de ticket')
    .addOptions(types.slice(0, 25).map((type) => ({
      label: safeLabel(type.name),
      value: type.id,
      description: (type.description || 'Sans description').substring(0, 50),
      emoji: parseEmoji(type.emoji)
    })));
  await message.channel.send({ components: [new ActionRowBuilder().addComponents(menu)] });
  await message.reply('Panel créé.');
}

async function setupTicketSystem(client, message, args) {
  await message.reply('Utilisez `+ticket` pour accéder au menu de configuration interactif.');
}

async function addTicketType(client, message, args) {
  if (!args.length) return message.reply('Usage : `+ticket add-type <nom>`');
  const name  = args.join(' ');
  const types = db.get(`ticket_types_${message.guild.id}`) || [];
  if (types.some(t => t.name.toLowerCase() === name.toLowerCase())) return message.reply('Ce type existe déjà.');
  types.push({ name, description: 'Aucune description', emoji: '🎫', id: Date.now().toString(), roleId: null, categoryId: null });
  db.set(`ticket_types_${message.guild.id}`, types);
  await message.reply(`Type "${name}" ajouté.`);
}

async function removeTicketType(client, message, args) {
  if (!args.length) return message.reply('Usage : `+ticket remove-type <nom>`');
  const name     = args.join(' ');
  const types    = db.get(`ticket_types_${message.guild.id}`) || [];
  const newTypes = types.filter(t => t.name.toLowerCase() !== name.toLowerCase());
  if (types.length === newTypes.length) return message.reply('Type introuvable.');
  db.set(`ticket_types_${message.guild.id}`, newTypes);
  await message.reply(`Type "${name}" supprimé.`);
}

async function viewTicketTypes(client, message) {
  const types  = db.get(`ticket_types_${message.guild.id}`) || [];
  const config = db.get(`ticket_config_${message.guild.id}`) || {};
  if (!types.length) return message.reply('Aucun type configuré.');
  const lines = types.map((t, i) => {
    const cat = t.categoryId ? message.guild.channels.cache.get(t.categoryId) : null;
    const catLabel = cat ? `📁 ${cat.name}` : '*Catégorie globale*';
    return `${i + 1}. ${t.emoji || '🎫'} **${t.name}** — ${t.description} — ${catLabel}`;
  }).join('\n');
  await message.channel.send({ components: [container(txt('## 🎫 Types de Tickets'), sep(), txt(lines))], flags: FLAGS });
}

async function setTicketTypeRole(client, message, args) {
  if (args.length < 2) return message.reply('Usage : `+ticket set-type-role <type> <@role>`');
  const roleMention = message.mentions.roles.first();
  if (!roleMention) return message.reply('Mentionnez un rôle valide.');
  const typeName = args.slice(0, -1).join(' ');
  const types    = db.get(`ticket_types_${message.guild.id}`) || [];
  const type     = types.find(t => t.name.toLowerCase() === typeName.toLowerCase());
  if (!type) return message.reply('Type introuvable.');
  type.roleId = roleMention.id;
  db.set(`ticket_types_${message.guild.id}`, types);
  await message.reply(`Rôle ${roleMention} associé au type "${type.name}".`);
}

async function addUserToTicket(client, message, args) {
  const config     = db.get(`ticket_config_${message.guild.id}`) || {};
  const staffRoles = config.staffRoles || [];
  const isStaff    = message.member.permissions.has(PermissionFlagsBits.Administrator)
                  || message.member.roles.cache.some(r => staffRoles.includes(r.id));
  const ticketData = db.get(`ticket_data_${message.channel.id}`) || {};
  const isOwner    = ticketData.userId === message.author.id;

  if (!isStaff && !isOwner) {
    return message.reply('❌ Seul le staff ou le créateur du ticket peut ajouter quelqu\'un.');
  }

  const user = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
  if (!user) return message.reply('❌ Utilisateur introuvable. Mentionnez-le ou donnez son ID.');
  if (user.id === message.author.id) return message.reply('❌ Vous êtes déjà dans ce ticket.');

  await message.channel.permissionOverwrites.create(user, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true
  });
  await message.reply(`✅ ${user} a été ajouté au ticket.`);
  try { await sendTicketLog(message.guild, 'added', message.author, { channel: message.channel, ticketName: message.channel.name, target: user }); } catch (_) {}

  // DM de notification à l'utilisateur ajouté
  try {
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (member) {
      const addFields = [
        { name: 'Ticket', value: `\`${message.channel.name}\``, inline: true },
        { name: 'Ajouté par', value: `${message.author.tag}`, inline: true },
        ticketData.type ? { name: 'Type', value: `${ticketData.typeEmoji || '🎫'} ${ticketData.type}`, inline: true } : null,
      ].filter(Boolean);

      await member.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('📨 Vous avez été ajouté à un ticket')
            .setColor(0x5865F2)
            .setDescription(`Vous avez été ajouté au ticket **${message.channel.name}** sur **${message.guild.name}**.`)
            .addFields(addFields)
            .setFooter({ text: `${message.guild.name} • Support` })
            .setTimestamp()
        ]
      }).catch(() => {});
    }
  } catch (_) {}
}

async function removeUserFromTicket(client, message, args) {
  const config     = db.get(`ticket_config_${message.guild.id}`) || {};
  const staffRoles = config.staffRoles || [];
  const isStaff    = message.member.permissions.has(PermissionFlagsBits.Administrator)
                  || message.member.roles.cache.some(r => staffRoles.includes(r.id));
  const ticketData = db.get(`ticket_data_${message.channel.id}`) || {};
  const isOwner    = ticketData.userId === message.author.id;

  if (!isStaff && !isOwner) {
    return message.reply('❌ Seul le staff ou le créateur du ticket peut retirer quelqu\'un.');
  }

  const user = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
  if (!user) return message.reply('❌ Utilisateur introuvable. Mentionnez-le ou donnez son ID.');
  if (user.id === ticketData.userId) return message.reply('❌ Impossible de retirer le créateur du ticket.');

  await message.channel.permissionOverwrites.delete(user);
  await message.reply(`✅ ${user} a été retiré du ticket.`);
  try { await sendTicketLog(message.guild, 'removed', message.author, { channel: message.channel, ticketName: message.channel.name, target: user }); } catch (_) {}
}

async function renameTicket(client, message, args) {
  if (!args.length) return message.reply('Usage : `+ticket rename <nouveau-nom>`');
  const newName = args.join('-').toLowerCase();
  await message.channel.setName(`ticket-${newName}`);
  await message.reply(`Ticket renommé en "ticket-${newName}".`);
  await sendTicketLog(message.guild, 'renamed', message.author, { channel: message.channel, ticketName: message.channel.name, newName });
}

async function closeTicket(client, message) {
  const channel  = message.channel;
  const guild    = message.guild;
  const closedBy = message.author;

  await message.reply('Fermeture du ticket dans 5 secondes — génération du transcript en cours...');

  try { await sendTicketLog(guild, 'closed', closedBy, { channel, ticketName: channel.name }); } catch (_) {}
  try { await logTicketTranscript(channel, guild, closedBy); } catch (_) {}

  // DM au créateur
  try {
    const ticketData = db.get(`ticket_data_${channel.id}`) || {};
    if (ticketData.userId) {
      const creator = await guild.members.fetch(ticketData.userId).catch(() => null);
      if (creator) {
        const dmEmbed = buildTicketClosedEmbed(guild, channel, ticketData, closedBy);
        let dmAttachment = null;
        try { dmAttachment = await safeCreateTranscript(channel, `transcript-${channel.name}.html`); } catch (_) {}
        const dmPayload = { embeds: [dmEmbed] };
        if (dmAttachment) dmPayload.files = [dmAttachment];
        await creator.send(dmPayload).catch(() => {});
      }
    }
  } catch (_) {}

  setTimeout(() => channel.delete().catch(() => {}), 5000);
}

async function claimTicket(client, message) {
  await message.channel.send(`${message.author} a pris en charge ce ticket.`);
  await sendTicketLog(message.guild, 'claimed', message.author, { channel: message.channel, ticketName: message.channel.name });
}

async function reopenTicket(client, message) {
  await message.reply('Fonctionnalité de réouverture non implémentée.');
}

async function addTicketTypeInteractive(interaction) {
  try {
    await interaction.reply({ content: 'Tapez le **nom** du nouveau type de ticket (max 25 caractères) :', ephemeral: true });
    const filter = (m) => m.author.id === interaction.user.id;
    const c1 = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });
    c1.on('collect', async (m1) => {
      const name = m1.content.substring(0, 25);
      await m1.delete().catch(() => {});
      const types = db.get(`ticket_types_${interaction.guild.id}`) || [];
      if (types.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
        return interaction.followUp({ content: 'Ce type existe déjà.', ephemeral: true });
      }
      await interaction.followUp({ content: `Nom : **${name}**\n\nTapez la **description** (max 100 caractères, ou \`skip\`) :`, ephemeral: true });
      const c2 = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });
      c2.on('collect', async (m2) => {
        const description = m2.content === 'skip' ? 'Aucune description' : m2.content.substring(0, 100);
        await m2.delete().catch(() => {});
        await interaction.followUp({ content: `Description : **${description}**\n\nEnvoyez l'**emoji** pour ce type (ou \`skip\` pour 🎫) :`, ephemeral: true });
        const c3 = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });
        c3.on('collect', async (m3) => {
          const emoji = m3.content === 'skip' ? '🎫' : m3.content;
          await m3.delete().catch(() => {});
          types.push({ name, description, emoji, id: Date.now().toString(), roleId: null, categoryId: null });
          db.set(`ticket_types_${interaction.guild.id}`, types);
          await interaction.followUp({
            content: `✅ Type **${name}** (${emoji}) ajouté.\n💡 Vous pouvez lui assigner une catégorie spécifique via **"Catégorie par type"** dans la config.`,
            ephemeral: true
          });
        });
        c3.on('end', (col, reason) => { if (reason === 'time' && !col.size) interaction.followUp({ content: 'Temps écoulé.', ephemeral: true }); });
      });
      c2.on('end', (col, reason) => { if (reason === 'time' && !col.size) interaction.followUp({ content: 'Temps écoulé.', ephemeral: true }); });
    });
    c1.on('end', (col, reason) => { if (reason === 'time' && !col.size) interaction.followUp({ content: 'Temps écoulé.', ephemeral: true }); });
  } catch (error) {
    console.error('Erreur addTicketTypeInteractive:', error);
    await interaction.followUp({ content: 'Une erreur est survenue.', ephemeral: true }).catch(() => {});
  }
}

module.exports.logTicketTranscript = logTicketTranscript;
module.exports.sendTicketLog = sendTicketLog;
