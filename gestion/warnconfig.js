const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  PermissionFlagsBits, EmbedBuilder,
} = require('discord.js');
const { container, txt, sep, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');
const EMOJIS = require('../../utils/emojis');
const { msToHuman } = require('../../utils/embedBuilder');

const DB_PALIERS = (g) => `warnconfig_paliers_${g}`;
const DB_ENABLED = (g) => `warnconfig_enabled_${g}`;
const DB_LOG     = (g) => `warnconfig_logchan_${g}`;
const DB_DM      = (g) => `warnconfig_dm_${g}`;

function toE(str) {
  if (!str) return null;
  const m = str.match(/^<(a?):([^:]+):(\d+)>$/);
  if (m) return { animated: !!m[1], name: m[2], id: m[3] };
  return str;
}

const ACTIONS = {
  mute:    { label: 'Mute (timeout)',     emoji: '🔇', needsDuration: true  },
  kick:    { label: 'Expulsion (kick)',   emoji: '👢', needsDuration: false },
  ban:     { label: 'Bannissement (ban)', emoji: '🔨', needsDuration: false },
  tempban: { label: 'Ban temporaire',     emoji: '⏳', needsDuration: true  },
  jail:    { label: 'Prison (jail)',      emoji: '🔒', needsDuration: false },
};

function parseDuration(str) {
  if (!str) return null;
  const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  return parseInt(match[1]) * (map[match[2].toLowerCase()] || 0);
}

function getPaliers(guildId) { return (db.get(DB_PALIERS(guildId)) || []).sort((a, b) => a.warnCount - b.warnCount); }
function setPaliers(guildId, paliers) { db.set(DB_PALIERS(guildId), paliers); }
function addPalier(guildId, palier) {
  const paliers = getPaliers(guildId);
  const idx = paliers.findIndex(p => p.warnCount === palier.warnCount);
  if (idx >= 0) paliers[idx] = palier; else paliers.push(palier);
  setPaliers(guildId, paliers);
}
function removePalier(guildId, warnCount) { setPaliers(guildId, getPaliers(guildId).filter(p => p.warnCount !== warnCount)); }
function formatPalier(p) {
  const action = ACTIONS[p.action];
  const dur    = p.duration ? ` (${msToHuman(p.duration)})` : '';
  return `${action?.emoji || '•'} **${p.warnCount} warn(s)** → **${action?.label || p.action}**${dur}`;
}

function buildStatusContainer(guild) {
  const guildId  = guild.id;
  const paliers  = getPaliers(guildId);
  const enabled  = db.get(DB_ENABLED(guildId)) !== false;
  const logChan  = db.get(DB_LOG(guildId));
  const dmNotif  = db.get(DB_DM(guildId)) !== false;
  const palierLines = paliers.length ? paliers.map(p => `→ ${formatPalier(p)}`).join('\n') : 'Aucun palier configuré';
  return container(
    txt('## ⚙️ Sanctions Automatiques — WarnConfig'),
    sep(),
    txt([
      `**Statut :** ${(paliers.length && enabled) ? '✅ Actif' : '❌ Inactif'}`,
      `**Logs :** ${logChan ? `<#${logChan}>` : 'Non configuré'}`,
      `**Notif DM :** ${dmNotif ? '✅ Activé' : '❌ Désactivé'}`,
      '',
      `**Paliers (${paliers.length}) :**`,
      palierLines
    ].join('\n'))
  );
}

function buildMainRows(guildId) {
  const enabled = db.get(DB_ENABLED(guildId)) !== false;
  const dmNotif = db.get(DB_DM(guildId)) !== false;
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('wc_add').setLabel('Ajouter un palier').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('wc_remove').setLabel('Supprimer un palier').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('wc_toggle').setLabel(enabled ? 'Désactiver' : 'Activer').setStyle(enabled ? ButtonStyle.Secondary : ButtonStyle.Success),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('wc_setlog').setLabel('Salon de logs').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('wc_toggledm').setLabel(dmNotif ? 'Désact. notif DM' : 'Act. notif DM').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('wc_reset').setLabel('Réinitialiser tout').setStyle(ButtonStyle.Danger),
    ),
  ];
}

function buildRemoveMenu(guildId) {
  const paliers = getPaliers(guildId);
  if (!paliers.length) return null;
  const options = paliers.map(p => {
    const action = ACTIONS[p.action];
    const dur    = p.duration ? ` (${msToHuman(p.duration)})` : '';
    return { label: `${p.warnCount} warn(s) → ${action?.label || p.action}${dur}`.slice(0, 100), value: String(p.warnCount), emoji: action?.emoji || '⚠️' };
  });
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('wc_remove_sel').setPlaceholder('Palier à supprimer').addOptions(options).setMinValues(1).setMaxValues(options.length)
  );
}

async function applyAutoSanction(client, guild, target, mod, warnCount) {
  const guildId = guild.id;
  if (db.get(DB_ENABLED(guildId)) === false) return;
  const paliers = getPaliers(guildId);
  if (!paliers.length) return;
  const palier = paliers.find(p => p.warnCount === warnCount);
  if (!palier) return;
  const action = palier.action, duration = palier.duration || null;
  const reason = `Sanction automatique — ${warnCount} warn(s) atteint(s)`;
  const dmNotif = db.get(DB_DM(guildId)) !== false;
  if (dmNotif) { try { const { container: c2, txt: t2, FLAGS: F2 } = require('../../utils/v2'); const dur = duration ? ` (${msToHuman(duration)})` : ''; await target.send({ components: [c2(t2(`## ⚠️ Sanction automatique\n**Serveur :** ${guild.name}\n**Action :** ${ACTIONS[action]?.label || action}${dur}\n**Raison :** ${reason}\n**Modérateur :** ${mod.tag}`))], flags: F2 }); } catch {} }
  let success = false, errorMsg = null;
  try {
    switch (action) {
      case 'mute': if (!duration || !target.moderatable) { errorMsg = 'Non modérable ou durée manquante'; break; } await target.timeout(duration, reason); success = true; break;
      case 'kick': if (!target.kickable) { errorMsg = 'Non expulsable'; break; } await target.kick(reason); success = true; break;
      case 'ban':  if (!target.bannable) { errorMsg = 'Non bannable'; break; } await target.ban({ reason, deleteMessageSeconds: 0 }); success = true; break;
      case 'tempban': if (!target.bannable || !duration) { errorMsg = 'Non bannable ou durée manquante'; break; } await target.ban({ reason, deleteMessageSeconds: 0 }); setTimeout(async () => { await guild.bans.remove(target.id, 'Fin ban temporaire').catch(() => {}); }, Math.min(duration, 2147483647)); success = true; break;
      case 'jail': { const jailCmd = client.commands?.get('jail'); if (jailCmd?.jailMember) { await jailCmd.jailMember(guild, target, mod, reason, duration); success = true; } else if (target.moderatable) { await target.timeout(duration || 3600000, reason); success = true; } break; }
    }
  } catch (e) { errorMsg = e.message; console.error('[warnconfig auto]', e); }
  const logChanId = db.get(DB_LOG(guildId)) || db.get(`logchannel_${guildId}`);
  if (logChanId) {
    const logCh = guild.channels.cache.get(logChanId);
    if (logCh) {
      const ai = ACTIONS[action];
      const { container: c3, txt: t3, sep: s3, FLAGS: F3 } = require('../../utils/v2'); logCh.send({ components: [c3(t3(`## ${ai?.emoji || '⚠️'} Sanction Automatique\n**Cible :** ${target.user.tag} (\`${target.id}\`)\n**Palier :** ${warnCount} warn(s)\n**Action :** ${ai?.label || action}\n**Statut :** ${success ? '✅ Appliquée' : `❌ Échec — ${errorMsg}`}`))], flags: F3 }).catch(() => {});
    }
  }
}

module.exports = {
  name:             'warnconfig',
  aliases:          ['warnsanction', 'autowarn', 'warnpalier'],
  description:      'Configure les sanctions automatiques par paliers de warns',
  usage:            '[list | reset]',
  applyAutoSanction,

  run: async (client, message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      let perm = false;
      message.member.roles.cache.forEach(r => { if (db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
      const isAuth = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) || perm;
      if (!isAuth) return message.reply({ components: [container(txt('❌ **Permission refusée.**'))], flags: FLAGS });
    }
    const guildId = message.guild.id;
    const sub = args[0]?.toLowerCase();

    if (sub === 'list') {
      const paliers = getPaliers(guildId);
      if (!paliers.length) return message.reply({ components: [container(txt('## ⚠️ Aucun Palier'), sep(), txt('Utilisez `+warnconfig` pour en ajouter.'))], flags: FLAGS });
      return message.reply({ components: [container(txt('## ⚙️ Paliers Configurés'), sep(), txt(paliers.map(p => `→ ${formatPalier(p)}`).join('\n')))], flags: FLAGS, allowedMentions: { repliedUser: false } });
    }
    if (sub === 'reset') {
      db.delete(DB_PALIERS(guildId)); db.delete(DB_ENABLED(guildId));
      return message.reply({ components: [container(txt('✅ **Tous les paliers ont été supprimés.**'))], flags: FLAGS, allowedMentions: { repliedUser: false } });
    }

    const msg = await message.reply({ components: [buildStatusContainer(message.guild), ...buildMainRows(guildId)], flags: FLAGS, allowedMentions: { repliedUser: false } });
    const refresh = async () => msg.edit({ components: [buildStatusContainer(message.guild), ...buildMainRows(guildId)], flags: FLAGS }).catch(() => {});
    const col = msg.createMessageComponentCollector({ time: 300000, filter: i => i.user.id === message.author.id });

    col.on('collect', async i => {
      const id = i.customId;
      if (id === 'wc_toggle') { await i.deferUpdate(); db.set(DB_ENABLED(guildId), db.get(DB_ENABLED(guildId)) === false ? true : false); await refresh(); return; }
      if (id === 'wc_toggledm') { await i.deferUpdate(); db.set(DB_DM(guildId), db.get(DB_DM(guildId)) === false ? true : false); await refresh(); return; }
      if (id === 'wc_reset') { await i.deferUpdate(); db.delete(DB_PALIERS(guildId)); db.delete(DB_ENABLED(guildId)); await refresh(); return; }
      if (id === 'wc_back') { await i.deferUpdate(); await msg.edit({ components: [buildStatusContainer(message.guild), ...buildMainRows(guildId)], flags: FLAGS }).catch(() => {}); return; }
      if (id === 'wc_setlog') {
        await i.deferUpdate();
        const { ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
        await msg.edit({ components: [container(txt('📌 Sélectionnez le salon de logs :')), new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('wc_log_chan').setPlaceholder('Salon de logs').setChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('wc_back').setLabel('↩ Retour').setStyle(ButtonStyle.Secondary))], flags: FLAGS }).catch(() => {}); return;
      }
      if (id === 'wc_log_chan') { await i.deferUpdate(); db.set(DB_LOG(guildId), i.values[0]); await refresh(); return; }
      if (id === 'wc_remove') {
        await i.deferUpdate();
        const removeMenu = buildRemoveMenu(guildId);
        if (!removeMenu) { await message.channel.send({ components: [container(txt('⚠️ Aucun palier à supprimer.'))], flags: FLAGS }).then(m => setTimeout(() => m.delete().catch(() => {}), 3000)); return; }
        await msg.edit({ components: [container(txt('🗑️ Sélectionnez les paliers à supprimer :')), removeMenu, new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('wc_back').setLabel('↩ Retour').setStyle(ButtonStyle.Secondary))], flags: FLAGS }).catch(() => {}); return;
      }
      if (id === 'wc_remove_sel') { await i.deferUpdate(); for (const v of i.values) removePalier(guildId, parseInt(v)); await refresh(); return; }
      if (id === 'wc_add') {
        const modal = new ModalBuilder().setCustomId('wc_modal_add').setTitle('Ajouter un palier de sanction');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('wc_warn_count').setLabel('Nombre de warns déclencheur').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 3').setRequired(true).setMinLength(1).setMaxLength(2)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('wc_action').setLabel('Action (mute/kick/ban/tempban/jail)').setStyle(TextInputStyle.Short).setPlaceholder('mute').setRequired(true).setMinLength(3).setMaxLength(7)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('wc_duration').setLabel('Durée (si mute/tempban) ex: 1h, 7d').setStyle(TextInputStyle.Short).setPlaceholder('1h').setRequired(false).setMaxLength(5)),
        );
        await i.showModal(modal);
        let sub; try { sub = await i.awaitModalSubmit({ filter: x => x.customId === 'wc_modal_add' && x.user.id === message.author.id, time: 60000 }); } catch { return; }
        const warnCount = parseInt(sub.fields.getTextInputValue('wc_warn_count').trim());
        const actionRaw = sub.fields.getTextInputValue('wc_action').trim().toLowerCase();
        const durationRaw = sub.fields.getTextInputValue('wc_duration').trim();
        if (isNaN(warnCount) || warnCount < 1 || warnCount > 50) { await sub.reply({ content: '❌ Nombre de warns invalide (1-50).', ephemeral: true }); return; }
        if (!ACTIONS[actionRaw]) { await sub.reply({ content: '❌ Action invalide. Choix : `mute` `kick` `ban` `tempban` `jail`', ephemeral: true }); return; }
        let duration = null;
        if (ACTIONS[actionRaw].needsDuration) {
          if (!durationRaw) { await sub.reply({ content: `❌ Durée requise pour **${actionRaw}** (ex: \`1h\`, \`7d\`).`, ephemeral: true }); return; }
          duration = parseDuration(durationRaw);
          if (!duration) { await sub.reply({ content: '❌ Durée invalide. Format : `30m`, `2h`, `7d`.', ephemeral: true }); return; }
        }
        addPalier(guildId, { warnCount, action: actionRaw, duration });
        if (db.get(DB_ENABLED(guildId)) == null) db.set(DB_ENABLED(guildId), true);
        await sub.deferUpdate();
        await msg.edit({ components: [buildStatusContainer(message.guild), ...buildMainRows(guildId)], flags: FLAGS }).catch(() => {}); return;
      }
    });
    col.on('end', () => msg.edit({ components: [buildStatusContainer(message.guild)], flags: FLAGS }).catch(() => {}));
  },
};
