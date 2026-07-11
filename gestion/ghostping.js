const { ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
const db = require('../../utils/simpledb');
const { container, txt, sep, row, btn, reply, errorContainer, paginationRow, FLAGS, ButtonStyle } = require('../../utils/v2');

const MAX = 20;
const PER_PAGE = 5;

function getIds(guildId) { return db.get(`ghostping_channels_${guildId}`) || []; }
function saveIds(guildId, ids) { db.set(`ghostping_channels_${guildId}`, ids); }

function buildContent(guild, page = 1) {
  const guildId = guild.id;
  const ids = getIds(guildId);
  const enabled = db.get(`ghostping_enabled_${guildId}`) !== false;
  const totalPages = Math.max(1, Math.ceil(ids.length / PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const slice = ids.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('gp_add_select')
    .setPlaceholder('Sélectionner un salon à surveiller')
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum)
    .setMinValues(1).setMaxValues(1);

  const comps = [
    txt(`## 👻 Configuration Ghostping`),
    sep(),
    txt(`**Statut :** ${enabled ? '🟢 Activé' : '🔴 Désactivé'} | **Salons :** ${ids.length}/${MAX}`),
    row(btn('gp_toggle', enabled ? 'Désactiver' : 'Activer', enabled ? ButtonStyle.Danger : ButtonStyle.Success)),
    sep(),
    txt('**Ajouter un salon à surveiller :**'),
    row(channelSelect),
    sep()
  ];

  if (ids.length === 0) {
    comps.push(txt('*Aucun salon configuré. Sélectionnez-en un ci-dessus.*'));
  } else {
    comps.push(txt(`**Salons surveillés :**`));
    for (const chanId of slice) {
      const ch = guild.channels.cache.get(chanId);
      comps.push(
        txt(`• ${ch ? `<#${chanId}>` : `~~${chanId}~~ *(supprimé)*`}`),
        row(btn(`gp_del_${chanId}`, `Supprimer`, ButtonStyle.Danger))
      );
    }
    const extraBtns = [btn('gp_clear', 'Tout supprimer', ButtonStyle.Danger)];
    comps.push(sep());
    if (totalPages > 1) {
      comps.push(paginationRow(safePage, totalPages, `gp_prev`, `gp_next`, extraBtns));
    } else {
      comps.push(row(...extraBtns));
    }
  }

  return { c: container(...comps), page: safePage, totalPages };
}

module.exports = {
  name: 'ghostping',
  aliases: ['gp', 'antighost'],
  description: 'Détection des ghost pings — configure les salons surveillés',
  category: 'gestion',

  run: async (client, message) => {
    let perm = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!perm) message.member.roles.cache.forEach(r => { if (db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
    if (!perm) return reply(message, errorContainer('Permission refusée.'));

    const guildId = message.guild.id;
    let currentPage = 1;

    const { c } = buildContent(message.guild, currentPage);
    const configMsg = await message.channel.send({ components: [c], flags: FLAGS });

    const refresh = () => {
      const { c: nc } = buildContent(message.guild, currentPage);
      return configMsg.edit({ components: [nc], flags: FLAGS }).catch(() => {});
    };

    const collector = configMsg.createMessageComponentCollector({ time: 300_000, filter: i => i.user.id === message.author.id });

    collector.on('collect', async interaction => {
      await interaction.deferUpdate().catch(() => {});
      const cid = interaction.customId;

      if (cid === 'gp_add_select') {
        const channelId = interaction.values[0];
        const ids = getIds(guildId);
        if (!ids.includes(channelId) && ids.length < MAX) { ids.push(channelId); saveIds(guildId, ids); }
        await refresh(); return;
      }

      if (cid === 'gp_toggle') {
        const enabled = db.get(`ghostping_enabled_${guildId}`) !== false;
        db.set(`ghostping_enabled_${guildId}`, !enabled);
        await refresh(); return;
      }

      if (cid.startsWith('gp_del_')) {
        const chanId = cid.replace('gp_del_', '');
        const ids = getIds(guildId).filter(id => id !== chanId);
        saveIds(guildId, ids);
        const total = Math.max(1, Math.ceil(ids.length / PER_PAGE));
        if (currentPage > total) currentPage = total;
        await refresh(); return;
      }

      if (cid === 'gp_clear') {
        saveIds(guildId, []); currentPage = 1;
        await refresh(); return;
      }

      if (cid === 'gp_prev') { currentPage = Math.max(1, currentPage - 1); await refresh(); return; }
      if (cid === 'gp_next') {
        const total = Math.max(1, Math.ceil(getIds(guildId).length / PER_PAGE));
        currentPage = Math.min(total, currentPage + 1);
        await refresh(); return;
      }
    });

    collector.on('end', () => configMsg.edit({ components: [container(txt('⏰ Menu expiré.'))], flags: FLAGS }).catch(() => {}));
  },

  isGhostPingChannel: (guildId, channelId) => {
    if (db.get(`ghostping_enabled_${guildId}`) === false) return false;
    return getIds(guildId).includes(channelId);
  }
};
