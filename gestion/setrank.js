const {
  ActionRowBuilder, RoleSelectMenuBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const { container, txt, sep, row, btn, FLAGS, ButtonStyle } = require('../../utils/v2');
const db = require('../../utils/simpledb');
const { hasPermissionLevel } = require('../../utils/permissionUtils');

const KEY   = (gid) => `rankgroups_${gid}`;
const mkId  = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function getGroups(gid) { return db.get(KEY(gid)) || []; }
function saveGroups(gid, g) { db.set(KEY(gid), g); }

function buildOverview(guild) {
  const groups = getGroups(guild.id);

  const lines = groups.length
    ? groups.map((g, i) => {
        const roleNames = g.roles.slice(0, 3).map(id => {
          const r = guild.roles.cache.get(id);
          return r ? `\`${r.name}\`` : `~~${id}~~`;
        });
        const more = g.roles.length > 3 ? ` +${g.roles.length - 3}` : '';
        return `**${i + 1}.** **${g.name}** — ${g.roles.length} rôle(s)\n↳ ${roleNames.join(', ')}${more}`;
      }).join('\n\n')
    : '*Aucun groupe configuré.*\n*Cliquez sur **Créer** pour commencer.*';

  return container(
    txt('## Groupes de Rangs — Configuration'),
    sep(),
    txt(lines),
    sep(),
    txt(`**${groups.length}** groupe(s) configuré(s)`),
    row(
      btn('sr_create',   'Créer',      ButtonStyle.Success,   '➕'),
      btn('sr_edit_pick','Modifier',   ButtonStyle.Primary,   '✏️',  groups.length === 0),
      btn('sr_del_pick', 'Supprimer',  ButtonStyle.Danger,    '🗑️', groups.length === 0)
    )
  );
}

module.exports = {
  name: 'setrank',
  aliases: ['set-rank', 'rankconfig'],
  description: 'Configure les groupes de rangs utilisés par la commande +rank.',
  category: 'gestion',
  level: 5,

  run: async (client, message) => {
    if (!hasPermissionLevel(client, message, 5))
      return message.reply({
        components: [container(
          txt('## Accès refusé'),
          sep(),
          txt('**Niveau 5 requis** pour configurer les groupes de rangs.')
        )],
        flags: FLAGS
      });

    const gid = message.guild.id;
    const msg = await message.reply({
      components: [buildOverview(message.guild)],
      flags: FLAGS,
      allowedMentions: { repliedUser: false }
    });

    let pendingCreate = null;
    let pendingEditId = null;

    const col = msg.createMessageComponentCollector({
      time: 300_000,
      filter: i => i.user.id === message.author.id
    });

    async function goBack(i) {
      if (i) await i.deferUpdate().catch(() => {});
      pendingCreate = null;
      pendingEditId = null;
      await msg.edit({ components: [buildOverview(message.guild)], flags: FLAGS }).catch(() => {});
    }

    col.on('collect', async (i) => {

      // ── CRÉER ────────────────────────────────────────────────────
      if (i.customId === 'sr_create') {
        const modal = new ModalBuilder()
          .setCustomId('sr_modal_create')
          .setTitle('Nouveau groupe de rang');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('grp_name')
              .setLabel('Nom du groupe (ex: Perm I, Pilier, Yonko…)')
              .setStyle(TextInputStyle.Short)
              .setMaxLength(50)
              .setRequired(true)
          )
        );
        await i.showModal(modal);

        let sub;
        try {
          sub = await i.awaitModalSubmit({
            filter: x => x.customId === 'sr_modal_create' && x.user.id === message.author.id,
            time: 60_000
          });
        } catch { return; }

        const name = sub.fields.getTextInputValue('grp_name').trim();
        if (!name) { await sub.reply({ content: 'Nom invalide.', ephemeral: true }); return; }

        pendingCreate = { id: mkId(), name };
        await sub.deferUpdate();

        await msg.edit({
          components: [
            container(
              txt(`## Nouveau groupe : ${name}`),
              sep(),
              txt('Sélectionnez les rôles à inclure dans ce groupe.\nVous pouvez en choisir jusqu\'à **25**.'),
              row(btn('sr_back', 'Annuler', ButtonStyle.Secondary, '↩️'))
            ),
            new ActionRowBuilder().addComponents(
              new RoleSelectMenuBuilder()
                .setCustomId('sr_roles_new')
                .setPlaceholder('Sélectionner les rôles du groupe')
                .setMinValues(1)
                .setMaxValues(25)
            )
          ],
          flags: FLAGS
        }).catch(() => {});
        return;
      }

      if (i.customId === 'sr_roles_new') {
        await i.deferUpdate();
        if (!pendingCreate) { await goBack(i); return; }
        const groups = getGroups(gid);
        groups.push({ id: pendingCreate.id, name: pendingCreate.name, roles: i.values });
        saveGroups(gid, groups);
        pendingCreate = null;
        await msg.edit({
          components: [container(
            txt('## Groupe créé'),
            sep(),
            txt(`Le groupe **${groups[groups.length - 1].name}** a été créé avec **${i.values.length}** rôle(s).`)
          )],
          flags: FLAGS
        }).catch(() => {});
        setTimeout(() => msg.edit({ components: [buildOverview(message.guild)], flags: FLAGS }).catch(() => {}), 1500);
        return;
      }

      // ── MODIFIER ─────────────────────────────────────────────────
      if (i.customId === 'sr_edit_pick') {
        await i.deferUpdate();
        const groups = getGroups(gid);
        if (!groups.length) { await goBack(i); return; }

        const opts = groups.map(g =>
          new StringSelectMenuOptionBuilder()
            .setLabel(g.name.slice(0, 100))
            .setValue(g.id)
            .setDescription(`${g.roles.length} rôle(s) configuré(s)`)
        );

        await msg.edit({
          components: [
            container(
              txt('## Modifier un groupe'),
              sep(),
              txt('Sélectionnez le groupe dont vous souhaitez modifier les rôles.'),
              row(btn('sr_back', 'Retour', ButtonStyle.Secondary, '↩️'))
            ),
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('sr_edit_group')
                .setPlaceholder('Choisir un groupe…')
                .addOptions(opts)
            )
          ],
          flags: FLAGS
        }).catch(() => {});
        return;
      }

      if (i.customId === 'sr_edit_group') {
        await i.deferUpdate();
        const groups = getGroups(gid);
        const grp    = groups.find(g => g.id === i.values[0]);
        if (!grp) { await goBack(i); return; }
        pendingEditId = grp.id;

        const roleLines = grp.roles.map(id => {
          const r = message.guild.roles.cache.get(id);
          return r ? `• ${r.name}` : `• ~~${id}~~ *(introuvable)*`;
        });

        await msg.edit({
          components: [
            container(
              txt(`## Modifier — ${grp.name}`),
              sep(),
              txt(`**Rôles actuels (${grp.roles.length}) :**\n${roleLines.join('\n') || '*Aucun*'}`),
              sep(),
              txt('Sélectionnez les **nouveaux** rôles pour remplacer la liste actuelle.'),
              row(btn('sr_back', 'Retour', ButtonStyle.Secondary, '↩️'))
            ),
            new ActionRowBuilder().addComponents(
              new RoleSelectMenuBuilder()
                .setCustomId('sr_roles_edit')
                .setPlaceholder('Nouveaux rôles du groupe')
                .setMinValues(1)
                .setMaxValues(25)
            )
          ],
          flags: FLAGS
        }).catch(() => {});
        return;
      }

      if (i.customId === 'sr_roles_edit') {
        await i.deferUpdate();
        if (!pendingEditId) { await goBack(i); return; }
        const groups = getGroups(gid);
        const grp    = groups.find(g => g.id === pendingEditId);
        if (grp) { grp.roles = i.values; saveGroups(gid, groups); }
        pendingEditId = null;
        await msg.edit({
          components: [container(
            txt('## Groupe modifié'),
            sep(),
            txt(`Le groupe **${grp?.name || '?'}** a été mis à jour avec **${i.values.length}** rôle(s).`)
          )],
          flags: FLAGS
        }).catch(() => {});
        setTimeout(() => msg.edit({ components: [buildOverview(message.guild)], flags: FLAGS }).catch(() => {}), 1500);
        return;
      }

      // ── SUPPRIMER ─────────────────────────────────────────────────
      if (i.customId === 'sr_del_pick') {
        await i.deferUpdate();
        const groups = getGroups(gid);
        if (!groups.length) { await goBack(i); return; }

        const opts = groups.map(g =>
          new StringSelectMenuOptionBuilder()
            .setLabel(g.name.slice(0, 100))
            .setValue(g.id)
            .setDescription(`${g.roles.length} rôle(s)`)
        );

        await msg.edit({
          components: [
            container(
              txt('## Supprimer un groupe'),
              sep(),
              txt('Sélectionnez le groupe à supprimer.\nCette action est **irréversible**.'),
              row(btn('sr_back', 'Annuler', ButtonStyle.Secondary, '↩️'))
            ),
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('sr_del_confirm')
                .setPlaceholder('Choisir un groupe à supprimer…')
                .addOptions(opts)
            )
          ],
          flags: FLAGS
        }).catch(() => {});
        return;
      }

      if (i.customId === 'sr_del_confirm') {
        await i.deferUpdate();
        const groups  = getGroups(gid);
        const removed = groups.find(g => g.id === i.values[0]);
        saveGroups(gid, groups.filter(g => g.id !== i.values[0]));
        await msg.edit({
          components: [container(
            txt('## Groupe supprimé'),
            sep(),
            txt(`Le groupe **${removed?.name || '?'}** a été supprimé.`)
          )],
          flags: FLAGS
        }).catch(() => {});
        setTimeout(() => msg.edit({ components: [buildOverview(message.guild)], flags: FLAGS }).catch(() => {}), 1500);
        return;
      }

      // ── RETOUR ────────────────────────────────────────────────────
      if (i.customId === 'sr_back') {
        await goBack(i);
        return;
      }
    });

    col.on('end', () =>
      msg.edit({ components: [buildOverview(message.guild)], flags: FLAGS }).catch(() => {})
    );
  }
};
