const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

const PER_PAGE = 3;

function getPanels(guildId) {
  return db.get(`rolepanel_${guildId}`) || [];
}

function savePanels(guildId, panels) {
  db.set(`rolepanel_${guildId}`, panels);
}

function getRoleDisplay(guild, roleId) {
  if (!roleId) return '❌ Non défini';
  const role = guild.roles.cache.get(roleId);
  return role ? role.toString() : '❌ Rôle introuvable';
}

function getTypeLabel(type) {
  const labels = { toggle: 'Ajouter et Retirer', add: 'Ajouter uniquement', remove: 'Retirer uniquement' };
  return labels[type] || 'Ajouter et Retirer';
}

function buildListContainer(guild, panels, page) {
  const totalPages = Math.max(1, Math.ceil(panels.length / PER_PAGE));
  const start = (page - 1) * PER_PAGE;
  const pageItems = panels.slice(start, start + PER_PAGE);

  const lines = [`## 🎛️ Panels de rôles`, `Page ${page}/${totalPages}`];
  if (panels.length === 0) {
    lines.push('\n*Aucun panel configuré. Créez-en un pour commencer.*');
  }

  return container(
    txt(lines.join('\n')),
    sep(),
    ...(pageItems.length === 0 ? [txt('Aucun panel sur cette page.')] :
      pageItems.flatMap(p => [
        txt([
          `**${p.name || 'Sans nom'}** | ID: ${p.id}`,
          `Rôle : ${getRoleDisplay(guild, p.roleId)}`,
          `Émoji : ${p.emoji || '❌'} · Type : ${getTypeLabel(p.type)}`,
          `Description : ${p.description || '❌'}`,
        ].join('\n')),
        sep()
      ])
    )
  );
}

function buildListRows(panels, page) {
  const totalPages = Math.max(1, Math.ceil(panels.length / PER_PAGE));
  const start = (page - 1) * PER_PAGE;
  const pageItems = panels.slice(start, start + PER_PAGE);

  const rows = [];

  if (pageItems.length > 0) {
    const editSelect = new StringSelectMenuBuilder()
      .setCustomId('rolepanel_edit_select')
      .setPlaceholder('Modifier un panel...')
      .addOptions(pageItems.map(p => new StringSelectMenuOptionBuilder()
        .setLabel(`${p.name || 'Sans nom'} (ID: ${p.id})`)
        .setValue(String(p.id))
      ));
    rows.push(new ActionRowBuilder().addComponents(editSelect));
  }

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rolepanel_prev').setLabel('‹').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId('rolepanel_next').setLabel('›').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages),
    new ButtonBuilder().setCustomId('rolepanel_create').setLabel('+ Créer un panel').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('rolepanel_close').setLabel('Fermer').setStyle(ButtonStyle.Secondary),
  );
  rows.push(navRow);

  return rows;
}

function buildEditContainer(guild, panel) {
  return container(
    txt(`## ✏️ Édition du Panel — ID: ${panel.id}`),
    sep(),
    txt([
      `**Nom :** ${panel.name || 'Sans nom'}`,
      `**Rôle :** ${getRoleDisplay(guild, panel.roleId)}`,
      `**Émoji :** ${panel.emoji || '❌'}`,
      `**Type :** ${getTypeLabel(panel.type)}`,
      `**Description :** ${panel.description || '❌'}`,
    ].join('\n'))
  );
}

function buildEditRows(panel) {
  const typeSelect = new StringSelectMenuBuilder()
    .setCustomId('rolepanel_type_select')
    .setPlaceholder('Type d\'attribution...')
    .addOptions([
      new StringSelectMenuOptionBuilder().setLabel('Ajouter et Retirer (Toggle)').setValue('toggle').setDefault(panel.type === 'toggle'),
      new StringSelectMenuOptionBuilder().setLabel('Ajouter uniquement').setValue('add').setDefault(panel.type === 'add'),
      new StringSelectMenuOptionBuilder().setLabel('Retirer uniquement').setValue('remove').setDefault(panel.type === 'remove'),
    ]);

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId('rolepanel_role_select')
    .setPlaceholder('Sélectionner le rôle du panel...')
    .setMinValues(0)
    .setMaxValues(1);

  const btnRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rolepanel_edit_name').setLabel('Modifier nom').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rolepanel_edit_emoji').setLabel('Définir émoji').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rolepanel_edit_desc').setLabel('Définir description').setStyle(ButtonStyle.Primary),
  );
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rolepanel_delete').setLabel('🗑️ Supprimer ce panel').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('rolepanel_back').setLabel('↩️ Retour').setStyle(ButtonStyle.Secondary),
  );

  return [
    new ActionRowBuilder().addComponents(typeSelect),
    new ActionRowBuilder().addComponents(roleSelect),
    btnRow,
    actionRow,
  ];
}

module.exports = {
  name: 'rolepanel',
  aliases: ['panelrole'],
  description: 'Gestion des panels de rôles',
  category: 'gestion',
  level: 4,
  run: async (client, message) => {
    if (!hasPermissionLevel(client, message, 4)) {
      return reply(message, errorContainer('**Permission insuffisante** — Niveau 4 (Admin) requis.'));
    }

    const guildId = message.guild.id;
    let page = 1;
    let editingId = null;

    const panelMsg = await message.channel.send({
      components: [buildListContainer(message.guild, getPanels(guildId), page), ...buildListRows(getPanels(guildId), page)],
      flags: FLAGS
    });

    const timeout = setTimeout(() => panelMsg.edit({ components: [] }).catch(() => {}), 300_000);

    const collector = panelMsg.createMessageComponentCollector({
      filter: i => i.user.id === message.author.id,
      time: 300_000
    });

    const refreshList = async (interaction) => {
      const panels = getPanels(guildId);
      const totalPages = Math.max(1, Math.ceil(panels.length / PER_PAGE));
      if (page > totalPages) page = totalPages;
      await interaction.update({
        components: [buildListContainer(message.guild, panels, page), ...buildListRows(panels, page)]
      });
    };

    const refreshEdit = async (interaction) => {
      const panels = getPanels(guildId);
      const panel = panels.find(p => p.id === editingId);
      if (!panel) return refreshList(interaction);
      await interaction.update({
        components: [buildEditContainer(message.guild, panel), ...buildEditRows(panel)]
      });
    };

    const askModal = async (interaction, title, field, placeholder, current) => {
      const modal = new ModalBuilder()
        .setCustomId(`rolepanel_modal_${field}`)
        .setTitle(title)
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('modal_input')
              .setLabel(title)
              .setStyle(TextInputStyle.Short)
              .setPlaceholder(placeholder)
              .setValue(current || '')
              .setRequired(false)
              .setMaxLength(100)
          )
        );
      await interaction.showModal(modal);
      try {
        const mInter = await interaction.awaitModalSubmit({ time: 120_000, filter: i => i.user.id === message.author.id });
        await mInter.deferUpdate();
        return mInter.fields.getTextInputValue('modal_input').trim();
      } catch {
        return null;
      }
    };

    collector.on('collect', async interaction => {
      if (interaction.customId === 'rolepanel_close') {
        clearTimeout(timeout);
        collector.stop();
        return interaction.update({ components: [] });
      }

      if (interaction.customId === 'rolepanel_prev') {
        page = Math.max(1, page - 1);
        return refreshList(interaction);
      }
      if (interaction.customId === 'rolepanel_next') {
        const panels = getPanels(guildId);
        const totalPages = Math.max(1, Math.ceil(panels.length / PER_PAGE));
        page = Math.min(totalPages, page + 1);
        return refreshList(interaction);
      }

      if (interaction.customId === 'rolepanel_create') {
        const panels = getPanels(guildId);
        const newId = panels.length > 0 ? Math.max(...panels.map(p => p.id)) + 1 : 1;
        const newPanel = { id: newId, name: 'Sans nom', roleId: null, emoji: null, type: 'toggle', description: null };
        panels.push(newPanel);
        savePanels(guildId, panels);
        editingId = newId;
        return interaction.update({
          components: [buildEditContainer(message.guild, newPanel), ...buildEditRows(newPanel)]
        });
      }

      if (interaction.customId === 'rolepanel_edit_select') {
        editingId = parseInt(interaction.values[0]);
        const panels = getPanels(guildId);
        const panel = panels.find(p => p.id === editingId);
        if (!panel) return refreshList(interaction);
        return interaction.update({
          components: [buildEditContainer(message.guild, panel), ...buildEditRows(panel)]
        });
      }

      if (interaction.customId === 'rolepanel_back') {
        editingId = null;
        return refreshList(interaction);
      }

      if (interaction.customId === 'rolepanel_delete') {
        let panels = getPanels(guildId);
        panels = panels.filter(p => p.id !== editingId);
        savePanels(guildId, panels);
        editingId = null;
        return refreshList(interaction);
      }

      if (interaction.customId === 'rolepanel_type_select') {
        const panels = getPanels(guildId);
        const panel = panels.find(p => p.id === editingId);
        if (!panel) return refreshList(interaction);
        panel.type = interaction.values[0];
        savePanels(guildId, panels);
        return interaction.update({
          components: [buildEditContainer(message.guild, panel), ...buildEditRows(panel)]
        });
      }

      if (interaction.customId === 'rolepanel_role_select') {
        const panels = getPanels(guildId);
        const panel = panels.find(p => p.id === editingId);
        if (!panel) return refreshList(interaction);
        panel.roleId = interaction.values[0] || null;
        savePanels(guildId, panels);
        return interaction.update({
          components: [buildEditContainer(message.guild, panel), ...buildEditRows(panel)]
        });
      }

      if (interaction.customId === 'rolepanel_edit_name') {
        const panels = getPanels(guildId);
        const panel = panels.find(p => p.id === editingId);
        if (!panel) return;
        const val = await askModal(interaction, 'Nom du panel', 'name', 'Ex: Rôles de couleur...', panel.name);
        if (val !== null && val !== '') panel.name = val;
        savePanels(guildId, panels);
        await panelMsg.edit({ components: [buildEditContainer(message.guild, panel), ...buildEditRows(panel)], flags: FLAGS });
        return;
      }

      if (interaction.customId === 'rolepanel_edit_emoji') {
        const panels = getPanels(guildId);
        const panel = panels.find(p => p.id === editingId);
        if (!panel) return;
        const val = await askModal(interaction, 'Émoji du panel', 'emoji', 'Ex: 🎨 ou :nom_emoji:', panel.emoji);
        if (val !== null) panel.emoji = val || null;
        savePanels(guildId, panels);
        await panelMsg.edit({ components: [buildEditContainer(message.guild, panel), ...buildEditRows(panel)], flags: FLAGS });
        return;
      }

      if (interaction.customId === 'rolepanel_edit_desc') {
        const panels = getPanels(guildId);
        const panel = panels.find(p => p.id === editingId);
        if (!panel) return;
        const modal = new ModalBuilder()
          .setCustomId('rolepanel_modal_desc')
          .setTitle('Description du panel')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('modal_input')
                .setLabel('Description')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Description du panel de rôles...')
                .setValue(panel.description || '')
                .setRequired(false)
                .setMaxLength(200)
            )
          );
        await interaction.showModal(modal);
        try {
          const mInter = await interaction.awaitModalSubmit({ time: 120_000, filter: i => i.user.id === message.author.id });
          const val = mInter.fields.getTextInputValue('modal_input').trim();
          panel.description = val || null;
          savePanels(guildId, panels);
          await mInter.deferUpdate();
          await panelMsg.edit({ components: [buildEditContainer(message.guild, panel), ...buildEditRows(panel)], flags: FLAGS });
        } catch {}
        return;
      }
    });

    collector.on('end', () => {
      clearTimeout(timeout);
      panelMsg.edit({ components: [] }).catch(() => {});
    });
  }
};
