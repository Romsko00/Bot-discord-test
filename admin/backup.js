const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { container, txt, sep, selectRow, row, btn, reply, errorContainer, FLAGS } = require('../../utils/v2');
const { createBackup, getBackupInfos, getBackupData, loadBackup, deleteBackup } = require('../../utils/backupUtils');

module.exports = {
  name: 'backup',
  description: 'Gère les sauvegardes complètes du serveur',
  category: 'admin',
  usage: '<create|load|list|info|delete> [id]',
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has('Administrator') && !client.config.owner?.includes(message.author.id)) {
      return reply(message, errorContainer('**Permission insuffisante** — Administrateur requis.'));
    }

    const sub = args[0]?.toLowerCase();
    const backupId = args[1];

    if (!sub || !['create', 'load', 'list', 'info', 'delete'].includes(sub)) {
      return reply(message, container(
        txt('## 💾 Backup — Usage'),
        sep(),
        txt([
          `\`!backup create\` — Créer une sauvegarde`,
          `\`!backup list\` — Lister les sauvegardes`,
          `\`!backup info <id>\` — Infos sur une sauvegarde`,
          `\`!backup load <id>\` — Charger une sauvegarde`,
          `\`!backup delete <id>\` — Supprimer une sauvegarde`
        ].join('\n'))
      ));
    }

    if (sub === 'create') {
      const sent = await reply(message, container(txt('## ⏳ Sauvegarde en cours...'), sep(), txt('Création de la sauvegarde, patientez...')));
      try {
        const id = await createBackup(message.guild);
        await sent.edit({ components: [container(txt('## ✅ Sauvegarde Créée'), sep(), txt(`**ID :** \`${id}\`\nSauvegarde créée avec succès !`))], flags: FLAGS });
      } catch (err) {
        console.error(err);
        await sent.edit({ components: [errorContainer('**Erreur** lors de la création de la sauvegarde.')], flags: FLAGS });
      }
      return;
    }

    if (sub === 'list') {
      const backups = getBackupInfos();
      if (backups.length === 0) return reply(message, container(txt('## 💾 Sauvegardes du Serveur'), sep(), txt('Aucune sauvegarde trouvée.')));

      const PAGE_SIZE = 3;
      let page = 0;
      const totalPages = Math.ceil(backups.length / PAGE_SIZE);

      const buildListPage = (p) => {
        const slice = backups.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
        const components = [txt('## 💾 Sauvegardes du Serveur'), sep()];

        for (const b of slice) {
          const createdAt = b.createdAt ? `<t:${Math.floor(b.createdAt / 1000)}:f>` : 'Date inconnue';
          const channels = b.channels?.length ?? '?';
          const roles = b.roles?.length ?? '?';
          const sizeKo = b.sizeBytes ? `${Math.round(b.sizeBytes / 1024)} Ko` : '? Ko';
          components.push(txt(
            `**${b.id}**\nCréée le ${createdAt} • Salons : ${channels} • Rôles : ${roles} • Taille : ${sizeKo}`
          ));
          components.push(row(
            btn(`bk_load_${b.id}`, 'Charger', ButtonStyle.Primary),
            btn(`bk_del_${b.id}`, 'Supprimer', ButtonStyle.Danger)
          ));
          components.push(sep());
        }

        if (totalPages > 1) {
          components.push(row(
            btn('bk_prev', '‹', ButtonStyle.Secondary, null, p === 0),
            btn('bk_pageinfo', `Page ${p + 1}/${totalPages}`, ButtonStyle.Secondary, null, true),
            btn('bk_next', '›', ButtonStyle.Secondary, null, p === totalPages - 1),
            btn('bk_create', '+ Créer une Backup', ButtonStyle.Success)
          ));
        } else {
          components.push(row(btn('bk_create', '+ Créer une Backup', ButtonStyle.Success)));
        }

        return container(...components);
      };

      const listMsg = await reply(message, buildListPage(0));

      const collector = listMsg.createMessageComponentCollector({
        filter: i => i.user.id === message.author.id,
        time: 300000
      });

      collector.on('collect', async i => {
        if (i.customId === 'bk_prev') { page = Math.max(0, page - 1); return i.update({ components: [buildListPage(page)], flags: FLAGS }); }
        if (i.customId === 'bk_next') { page = Math.min(totalPages - 1, page + 1); return i.update({ components: [buildListPage(page)], flags: FLAGS }); }

        if (i.customId === 'bk_create') {
          await i.update({ components: [container(txt('## ⏳ Sauvegarde en cours...'), sep(), txt('Création de la sauvegarde, patientez...'))], flags: FLAGS });
          try {
            const newId = await createBackup(message.guild);
            await listMsg.edit({ components: [container(txt('## ✅ Sauvegarde Créée'), sep(), txt(`**ID :** \`${newId}\`\nSauvegarde créée avec succès !`))], flags: FLAGS });
          } catch (err) {
            console.error(err);
            await listMsg.edit({ components: [errorContainer('**Erreur** lors de la création de la sauvegarde.')], flags: FLAGS });
          }
          return;
        }

        if (i.customId.startsWith('bk_load_')) {
          const bkId = i.customId.replace('bk_load_', '');
          const data = getBackupData(bkId);
          if (!data) return i.update({ components: [errorContainer('**Sauvegarde introuvable.**')], flags: FLAGS });

          await i.update({
            components: [container(
              txt(`## ⚠️ Charger la Sauvegarde \`${bkId}\``),
              sep(),
              txt('Confirmer le chargement de cette sauvegarde ? Les données actuelles seront remplacées.'),
              sep(),
              row(
                btn('bkload_yes_' + bkId, 'Confirmer', ButtonStyle.Success),
                btn('bkload_no', 'Annuler', ButtonStyle.Secondary)
              )
            )],
            flags: FLAGS
          });
        }

        if (i.customId.startsWith('bk_del_')) {
          const bkId = i.customId.replace('bk_del_', '');
          await i.update({
            components: [container(
              txt(`## ⚠️ Supprimer \`${bkId}\``),
              sep(),
              txt('Cette action est **irréversible**. Confirmer la suppression ?'),
              sep(),
              row(
                btn('bkdel_yes_' + bkId, 'Supprimer', ButtonStyle.Danger),
                btn('bkdel_no', 'Annuler', ButtonStyle.Secondary)
              )
            )],
            flags: FLAGS
          });
        }

        if (i.customId.startsWith('bkdel_yes_')) {
          const bkId = i.customId.replace('bkdel_yes_', '');
          const ok = deleteBackup(bkId);
          return i.update({ components: [ok
            ? container(txt('## ✅ Sauvegarde Supprimée'), sep(), txt(`Sauvegarde \`${bkId}\` supprimée avec succès.`))
            : errorContainer('**Sauvegarde introuvable.**')], flags: FLAGS });
        }

        if (i.customId === 'bkdel_no' || i.customId === 'bkload_no') {
          return i.update({ components: [buildListPage(page)], flags: FLAGS });
        }

        if (i.customId.startsWith('bkload_yes_')) {
          const bkId = i.customId.replace('bkload_yes_', '');
          const data = getBackupData(bkId);
          if (!data) return i.update({ components: [errorContainer('**Sauvegarde introuvable.**')], flags: FLAGS });
          await i.update({ components: [container(txt('## ⏳ Restauration en cours...'))], flags: FLAGS });
          try {
            await loadBackup(message.guild, data, { deleteRoles: false, deleteChannels: false, loadRoles: true, loadChannels: true, loadSettings: true }, async () => {});
            await listMsg.edit({ components: [container(txt('## ✅ Restauration Terminée'), sep(), txt(`Sauvegarde \`${bkId}\` chargée avec succès.`))], flags: FLAGS });
          } catch (err) {
            console.error(err);
            await listMsg.edit({ components: [errorContainer('**Erreur critique** pendant la restauration.')], flags: FLAGS });
          }
        }
      });

      collector.on('end', () => listMsg.edit({ components: [buildListPage(page)], flags: FLAGS }).catch(() => {}));
      return;
    }

    if (sub === 'info') {
      if (!backupId) return reply(message, errorContainer(`**Usage :** \`!backup info <id>\``));
      const data = getBackupData(backupId);
      if (!data) return reply(message, errorContainer('**Sauvegarde introuvable.**'));
      return reply(message, container(
        txt(`## 💾 Backup — ${data.id}`),
        sep(),
        txt([
          `**Nom original :** ${data.name}`,
          `**Rôles :** ${data.roles.length}`,
          `**Catégories :** ${data.categories.length}`,
          `**Salons :** ${data.channels.length}`,
          `**Config Bot :** ${Object.keys(data.botConfig || {}).length} clés`,
          `**Créée le :** <t:${Math.floor(data.createdAt / 1000)}:F>`
        ].join('\n'))
      ));
    }

    if (sub === 'delete') {
      if (!backupId) return reply(message, errorContainer(`**Usage :** \`!backup delete <id>\``));
      if (deleteBackup(backupId)) return reply(message, container(txt('## ✅ Sauvegarde Supprimée'), sep(), txt(`Sauvegarde \`${backupId}\` supprimée.`)));
      return reply(message, errorContainer('**Sauvegarde introuvable.**'));
    }

    if (sub === 'load') {
      if (!backupId) return reply(message, errorContainer(`**Usage :** \`!backup load <id>\``));
      const data = getBackupData(backupId);
      if (!data) return reply(message, errorContainer('**Sauvegarde introuvable.**'));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('backup_load_select')
        .setPlaceholder('Sélectionner les actions à effectuer')
        .setMinValues(1).setMaxValues(5)
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('Supprimer Rôles Existants').setValue('delete_roles').setEmoji('🗑️'),
          new StringSelectMenuOptionBuilder().setLabel('Supprimer Salons Existants').setValue('delete_channels').setEmoji('🗑️'),
          new StringSelectMenuOptionBuilder().setLabel('Charger Rôles').setValue('load_roles').setEmoji('📤'),
          new StringSelectMenuOptionBuilder().setLabel('Charger Salons & Catégories').setValue('load_channels').setEmoji('📤'),
          new StringSelectMenuOptionBuilder().setLabel('Charger Configurations').setValue('load_settings').setEmoji('⚙️')
        );
      const rowMenu = new ActionRowBuilder().addComponents(selectMenu);
      const continueBtn = new ButtonBuilder().setCustomId('backup_continue').setLabel('Continuer').setStyle(ButtonStyle.Success);
      const cancelBtn = new ButtonBuilder().setCustomId('backup_cancel').setLabel('Annuler').setStyle(ButtonStyle.Danger);
      const rowBtns = new ActionRowBuilder().addComponents(continueBtn, cancelBtn);

      const c = container(
        txt(`## ⚠️ Charger la Sauvegarde \`${data.id}\``),
        sep(),
        txt('Sélectionnez les éléments à restaurer dans le menu, puis cliquez **Continuer**.')
      );
      const interactiveMsg = await message.reply({ components: [c, rowMenu, rowBtns], flags: FLAGS });
      let selectedOptions = [];

      const collector = interactiveMsg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60000 });
      collector.on('collect', async i => {
        if (i.isStringSelectMenu()) {
          selectedOptions = i.values;
          await i.reply({ content: `✅ ${selectedOptions.length} option(s) sélectionnée(s)`, ephemeral: true });
        } else if (i.isButton()) {
          if (i.customId === 'backup_cancel') {
            collector.stop('cancel');
            return i.update({ components: [container(txt('## ❌ Chargement Annulé'))], flags: FLAGS });
          }
          if (i.customId === 'backup_continue') {
            if (!selectedOptions.length) return i.reply({ content: 'Sélectionnez au moins une option !', ephemeral: true });
            collector.stop('continue');
            await i.update({ components: [container(txt('## ⏳ Restauration en cours...'))], flags: FLAGS });
            const options = {
              deleteRoles: selectedOptions.includes('delete_roles'),
              deleteChannels: selectedOptions.includes('delete_channels'),
              loadRoles: selectedOptions.includes('load_roles'),
              loadChannels: selectedOptions.includes('load_channels'),
              loadSettings: selectedOptions.includes('load_settings')
            };
            const progressMsg = await i.followUp({ components: [container(txt('⏳ Restauration : Préparation...'))], flags: FLAGS });
            try {
              await loadBackup(message.guild, data, options, async (progressText) => {
                await progressMsg.edit({ components: [container(txt(progressText))], flags: FLAGS }).catch(() => {});
              });
            } catch (err) {
              console.error(err);
              await progressMsg.edit({ components: [errorContainer('**Erreur critique** pendant la restauration.')], flags: FLAGS }).catch(() => {});
            }
          }
        }
      });
      collector.on('end', (_, reason) => {
        if (reason === 'time') interactiveMsg.edit({ components: [container(txt('## ⏱️ Délai expiré.'))], flags: FLAGS }).catch(() => {});
      });
    }
  }
};
