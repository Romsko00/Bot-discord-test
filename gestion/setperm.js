const {
  ActionRowBuilder, RoleSelectMenuBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');
const { container, txt, sep, row, btn, FLAGS, ButtonStyle } = require('../../utils/v2');
const db = require('../../utils/simpledb');
const { setRolePermissionLevel, isBotOwner } = require('../../utils/permissionUtils');

const LEVEL_LABELS = {
  1: { label: 'Niveau 1 — Modérateur Junior',    desc: 'Accès aux commandes de base de modération' },
  2: { label: 'Niveau 2 — Modérateur',            desc: 'Commandes de modération standard' },
  3: { label: 'Niveau 3 — Admin Junior',          desc: 'Giveaway, lock/unlock, clear avancé' },
  4: { label: 'Niveau 4 — Administrateur',        desc: 'Tickets, logs, captcha, statistiques' },
  5: { label: 'Niveau 5 — Admin Senior',          desc: 'Attribution de rangs, gestion avancée' },
  6: { label: 'Niveau 6 — Responsable / Chef',   desc: 'Accès maximum au niveau serveur' }
};

function getAllPermRoles(guildId, guild) {
  return Object.keys(LEVEL_LABELS).flatMap(lvl =>
    guild.roles.cache
      .filter(r => Number(db.get(`permlevel_${guildId}_${r.id}`)) === Number(lvl))
      .map(r => ({ role: r, level: Number(lvl) }))
  ).sort((a, b) => b.level - a.level || a.role.name.localeCompare(b.role.name));
}

function buildOverview(guild) {
  const entries = getAllPermRoles(guild.id, guild);

  const grouped = {};
  for (const { role, level } of entries) {
    if (!grouped[level]) grouped[level] = [];
    grouped[level].push(role);
  }

  const lines = Object.keys(grouped).sort((a, b) => b - a).map(lvl => {
    const info  = LEVEL_LABELS[lvl];
    const roles = grouped[lvl].map(r => `<@&${r.id}>`).join(', ');
    return `**${info?.label || `Niveau ${lvl}`}**\n↳ ${roles}`;
  });

  return container(
    txt('## Permissions — Niveaux d\'accès'),
    sep(),
    txt(lines.length
      ? lines.join('\n\n')
      : '*Aucun rôle configuré.\nUtilisez **Définir** pour assigner un niveau à un rôle.*'
    ),
    sep(),
    txt(`**${entries.length}** rôle(s) configuré(s)`),
    row(
      btn('sp_set',    'Définir / Modifier', ButtonStyle.Success, '✏️'),
      btn('sp_remove', 'Retirer',            ButtonStyle.Danger,  '🗑️', entries.length === 0)
    )
  );
}

module.exports = {
  name: 'setperm',
  aliases: ['setpermission', 'perms'],
  description: 'Définit les niveaux de permission pour les rôles du serveur.',
  category: 'gestion',
  level: 7,

  run: async (client, message) => {
    if (!isBotOwner(client, message))
      return message.reply({
        components: [container(
          txt('## Accès refusé'),
          sep(),
          txt('Seuls les **propriétaires du bot** peuvent modifier les permissions.')
        )],
        flags: FLAGS
      });

    const gid = message.guild.id;
    const msg = await message.reply({
      components: [buildOverview(message.guild)],
      flags: FLAGS,
      allowedMentions: { repliedUser: false }
    });

    let pendingRoleId = null;

    const col = msg.createMessageComponentCollector({
      time: 300_000,
      filter: i => i.user.id === message.author.id
    });

    async function refresh(i) {
      if (i) await i.deferUpdate().catch(() => {});
      await msg.edit({ components: [buildOverview(message.guild)], flags: FLAGS }).catch(() => {});
    }

    col.on('collect', async (i) => {

      // ── DÉFINIR / MODIFIER ────────────────────────────────────────
      if (i.customId === 'sp_set') {
        await i.deferUpdate();
        await msg.edit({
          components: [
            container(
              txt('## Définir un niveau — Étape 1/2'),
              sep(),
              txt('Sélectionnez le rôle à configurer.'),
              row(btn('sp_back', 'Retour', ButtonStyle.Secondary, '↩️'))
            ),
            new ActionRowBuilder().addComponents(
              new RoleSelectMenuBuilder()
                .setCustomId('sp_role_pick')
                .setPlaceholder('Sélectionner un rôle…')
                .setMinValues(1)
                .setMaxValues(1)
            )
          ],
          flags: FLAGS
        }).catch(() => {});
        return;
      }

      if (i.customId === 'sp_role_pick') {
        await i.deferUpdate();
        pendingRoleId = i.values[0];
        const role         = message.guild.roles.cache.get(pendingRoleId);
        const currentLevel = db.get(`permlevel_${gid}_${pendingRoleId}`);

        const levelOpts = Object.entries(LEVEL_LABELS).map(([lvl, info]) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(info.label)
            .setValue(String(lvl))
            .setDescription(info.desc.slice(0, 100))
            .setDefault(Number(currentLevel) === Number(lvl))
        );

        await msg.edit({
          components: [
            container(
              txt(`## Définir un niveau — Étape 2/2`),
              sep(),
              txt([
                `**Rôle sélectionné :** ${role ? `<@&${role.id}>` : `\`${pendingRoleId}\``}`,
                currentLevel
                  ? `**Niveau actuel :** ${LEVEL_LABELS[currentLevel]?.label || `Niveau ${currentLevel}`}`
                  : '*Aucun niveau défini actuellement.*'
              ].join('\n')),
              sep(),
              txt('Choisissez le niveau de permission à attribuer à ce rôle.'),
              row(btn('sp_back', 'Retour', ButtonStyle.Secondary, '↩️'))
            ),
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('sp_level_pick')
                .setPlaceholder('Choisir le niveau…')
                .addOptions(levelOpts)
            )
          ],
          flags: FLAGS
        }).catch(() => {});
        return;
      }

      if (i.customId === 'sp_level_pick') {
        await i.deferUpdate();
        if (!pendingRoleId) { await refresh(null); return; }
        const level    = parseInt(i.values[0]);
        const info     = LEVEL_LABELS[level];
        const role     = message.guild.roles.cache.get(pendingRoleId);
        setRolePermissionLevel(gid, pendingRoleId, level);
        const savedRoleId = pendingRoleId;
        pendingRoleId  = null;
        await msg.edit({
          components: [container(
            txt('## Permission mise à jour'),
            sep(),
            txt([
              `**Rôle :** ${role ? `<@&${role.id}>` : `\`${savedRoleId}\``}`,
              `**Nouveau niveau :** ${info?.label || `Niveau ${level}`}`,
              `**Description :** ${info?.desc || ''}`,
            ].join('\n'))
          )],
          flags: FLAGS
        }).catch(() => {});
        setTimeout(() => msg.edit({ components: [buildOverview(message.guild)], flags: FLAGS }).catch(() => {}), 2000);
        return;
      }

      // ── RETIRER ───────────────────────────────────────────────────
      if (i.customId === 'sp_remove') {
        await i.deferUpdate();
        const entries = getAllPermRoles(gid, message.guild);
        if (!entries.length) { await refresh(null); return; }

        const opts = entries.slice(0, 25).map(({ role, level }) => {
          const info = LEVEL_LABELS[level];
          return new StringSelectMenuOptionBuilder()
            .setLabel(`${role.name}`.slice(0, 100))
            .setValue(role.id)
            .setDescription((info?.label || `Niveau ${level}`).slice(0, 100))
        });

        await msg.edit({
          components: [
            container(
              txt('## Retirer une permission'),
              sep(),
              txt('Sélectionnez le(s) rôle(s) dont vous souhaitez retirer le niveau.'),
              row(btn('sp_back', 'Retour', ButtonStyle.Secondary, '↩️'))
            ),
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('sp_remove_confirm')
                .setPlaceholder('Sélectionner un ou plusieurs rôles…')
                .addOptions(opts)
                .setMinValues(1)
                .setMaxValues(Math.min(opts.length, 25))
            )
          ],
          flags: FLAGS
        }).catch(() => {});
        return;
      }

      if (i.customId === 'sp_remove_confirm') {
        await i.deferUpdate();
        for (const roleId of i.values) {
          db.delete(`permlevel_${gid}_${roleId}`);
        }
        await msg.edit({
          components: [container(
            txt('## Permission(s) retirée(s)'),
            sep(),
            txt(`**${i.values.length}** rôle(s) ont perdu leur niveau de permission.`)
          )],
          flags: FLAGS
        }).catch(() => {});
        setTimeout(() => msg.edit({ components: [buildOverview(message.guild)], flags: FLAGS }).catch(() => {}), 2000);
        return;
      }

      // ── RETOUR ────────────────────────────────────────────────────
      if (i.customId === 'sp_back') {
        pendingRoleId = null;
        await refresh(i);
        return;
      }
    });

    col.on('end', () =>
      msg.edit({ components: [buildOverview(message.guild)], flags: FLAGS }).catch(() => {})
    );
  }
};
