const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');
const { container, txt, sep, row, btn, FLAGS, ButtonStyle } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

function getGroups(gid) { return db.get(`rankgroups_${gid}`) || []; }

function getCurrentGroupOfMember(member, groups) {
  for (const grp of groups) {
    for (const roleId of grp.roles) {
      if (member.roles.cache.has(roleId)) return grp;
    }
  }
  return null;
}

function buildGroupSelect(groups, currentGroup) {
  const opts = groups.map(g => {
    const isCurrent = currentGroup && currentGroup.id === g.id;
    return new StringSelectMenuOptionBuilder()
      .setLabel(g.name.slice(0, 100))
      .setValue(g.id)
      .setDescription(`${g.roles.length} rôle(s)${isCurrent ? ' — Groupe actuel' : ''}`)
      .setDefault(isCurrent);
  });
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rk_group_pick')
      .setPlaceholder('Choisir un groupe')
      .addOptions(opts)
  );
}

function buildRoleSelect(grp, member, guild) {
  const opts = grp.roles.slice(0, 25).map(roleId => {
    const role    = guild.roles.cache.get(roleId);
    const hasRole = member.roles.cache.has(roleId);
    const name    = role ? role.name : `ID : ${roleId}`;
    const opt = new StringSelectMenuOptionBuilder()
      .setLabel(name.slice(0, 100))
      .setValue(roleId);
    if (hasRole) {
      opt.setDescription('Déjà possédé').setDefault(true);
    } else {
      opt.setDescription(`ID : ${roleId}`);
    }
    return opt;
  });
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rk_roles_pick')
      .setPlaceholder('Sélectionner au moins 1 rôle')
      .addOptions(opts)
      .setMinValues(1)
      .setMaxValues(Math.min(opts.length, 25))
  );
}

module.exports = {
  name: 'rank',
  aliases: ['grade', 'ranger'],
  description: 'Attribue un rang à un membre via sélection de groupe et de rôle.',
  usage: '@membre',
  category: 'gestion',
  level: 5,

  run: async (client, message, args) => {
    try {
      if (!hasPermissionLevel(client, message, 5))
        return message.reply({
          components: [container(
            txt('## Accès refusé'),
            sep(),
            txt('Niveau 5 requis pour utiliser cette commande.')
          )],
          flags: FLAGS
        });

      const target = message.mentions.members.first()
        || (args[0] && /^\d{15,20}$/.test(args[0])
            && await message.guild.members.fetch(args[0]).catch(() => null));

      if (!target)
        return message.reply({
          components: [container(
            txt('## Utilisation incorrecte'),
            sep(),
            txt('**Usage :** `+rank @membre`\nMentionnez le membre à ranger.')
          )],
          flags: FLAGS
        });

      if (target.user.bot)
        return message.reply({
          components: [container(
            txt('## Erreur'),
            sep(),
            txt('Impossible d\'attribuer un rang à un bot.')
          )],
          flags: FLAGS
        });

      const gid    = message.guild.id;
      const groups = getGroups(gid);

      if (!groups.length)
        return message.reply({
          components: [container(
            txt('## Aucun groupe configuré'),
            sep(),
            txt('Utilisez `+setrank` pour créer des groupes de rangs.')
          )],
          flags: FLAGS
        });

      const currentGroup = getCurrentGroupOfMember(target, groups);

      const buildMain = () => container(
        txt('## Gestion des Rangs'),
        sep(),
        txt([
          `**Membre :** ${target}`,
          `**Groupe actuel :** ${currentGroup ? `**${currentGroup.name}**` : '*Aucun rang attribué*'}`,
          `**Groupes disponibles :** ${groups.length}`,
          '',
          'Sélectionne un groupe pour voir les rôles disponibles.'
        ].join('\n')),
        row(btn('rk_cancel', 'Fermer', ButtonStyle.Danger))
      );

      const msg = await message.reply({
        components: [buildMain(), buildGroupSelect(groups, currentGroup)],
        flags: FLAGS,
        allowedMentions: { repliedUser: false }
      });

      let selectedGroup = null;

      const col = msg.createMessageComponentCollector({
        time: 120_000,
        filter: i => i.user.id === message.author.id
      });

      col.on('collect', async (i) => {
        if (i.customId === 'rk_group_pick') {
          await i.deferUpdate();
          selectedGroup = groups.find(g => g.id === i.values[0]);
          if (!selectedGroup) return;

          const ownedCount = selectedGroup.roles.filter(id => target.roles.cache.has(id)).length;

          await msg.edit({
            components: [
              container(
                txt(`## Groupe — ${selectedGroup.name}`),
                sep(),
                txt([
                  `**Membre :** ${target}`,
                  `**Rôles affichés :** ${selectedGroup.roles.length}`,
                  ownedCount > 0 ? `**Déjà possédés :** ${ownedCount}` : '',
                  '',
                  'Sélectionne le(s) rôle(s) à attribuer.'
                ].filter(Boolean).join('\n')),
                row(btn('rk_back', 'Retour', ButtonStyle.Secondary))
              ),
              buildRoleSelect(selectedGroup, target, message.guild)
            ],
            flags: FLAGS
          }).catch(() => {});
          return;
        }

        if (i.customId === 'rk_roles_pick') {
          await i.deferUpdate();
          if (!selectedGroup) return;

          const allGroupRoleIds = new Set(groups.flatMap(g => g.roles));
          const selectedRoleIds = i.values;

          try {
            const toRemove = target.roles.cache
              .filter(r => allGroupRoleIds.has(r.id) && !selectedRoleIds.includes(r.id))
              .map(r => r.id);
            if (toRemove.length) await target.roles.remove(toRemove).catch(() => {});

            const toAdd = selectedRoleIds.filter(id => !target.roles.cache.has(id));
            if (toAdd.length) await target.roles.add(toAdd).catch(() => {});

            const givenNames = selectedRoleIds.map(id => {
              const r = message.guild.roles.cache.get(id);
              return r ? `<@&${r.id}>` : `\`${id}\``;
            });

            col.stop('done');
            await msg.edit({
              components: [container(
                txt('## Rang Attribué'),
                sep(),
                txt([
                  `**Membre :** ${target}`,
                  `**Groupe :** ${selectedGroup.name}`,
                  `**Rôle(s) attribué(s) :** ${givenNames.join(', ')}`,
                  toRemove.length ? `**Rôle(s) retirés :** ${toRemove.length}` : '',
                  `**Par :** ${message.author}`,
                ].filter(Boolean).join('\n'))
              )],
              flags: FLAGS
            }).catch(() => {});
          } catch (err) {
            await msg.edit({
              components: [container(
                txt('## Erreur'),
                sep(),
                txt(`Impossible de modifier les rôles : \`${err.message}\`\nVérifiez les permissions du bot.`)
              )],
              flags: FLAGS
            }).catch(() => {});
          }
          return;
        }

        if (i.customId === 'rk_back') {
          await i.deferUpdate();
          selectedGroup = null;
          const freshGroup = getCurrentGroupOfMember(target, groups);
          await msg.edit({
            components: [buildMain(), buildGroupSelect(groups, freshGroup)],
            flags: FLAGS
          }).catch(() => {});
          return;
        }

        if (i.customId === 'rk_cancel') {
          await i.deferUpdate();
          col.stop('cancelled');
          await msg.edit({
            components: [container(
              txt('## Annulé'),
              sep(),
              txt('Attribution de rang annulée.')
            )],
            flags: FLAGS
          }).catch(() => {});
          return;
        }
      });

      col.on('end', (_, reason) => {
        if (reason === 'time') {
          msg.edit({
            components: [container(
              txt('## Expiré'),
              sep(),
              txt('Temps écoulé. Relancez `+rank @membre`.')
            )],
            flags: FLAGS
          }).catch(() => {});
        }
      });

    } catch (error) {
      console.error('[rank]', error);
      return message.reply({
        components: [container(
          txt('## Erreur'),
          sep(),
          txt('Une erreur est survenue lors de l\'attribution du rang.')
        )],
        flags: FLAGS
      }).catch(() => {});
    }
  }
};
