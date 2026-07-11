const { RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const db = require('../../utils/simpledb');
const { container, txt, sep, row, btn, reply, errorContainer, paginationRow, FLAGS } = require('../../utils/v2');

// ── DB Helpers ────────────────────────────────────────────────────────────────
function getRewards(guildId) { return db.get(`level_rewards_${guildId}`) || []; }
function setRewards(guildId, arr) { db.set(`level_rewards_${guildId}`, arr); }
function isEnabled(guildId) { return db.get(`levels_enabled_${guildId}`) !== false; }
function getXpMin(guildId) { return db.get(`levels_xp_min_${guildId}`) ?? 5; }
function getXpMax(guildId) { return db.get(`levels_xp_max_${guildId}`) ?? 10; }
function getFormulaPreset(guildId) { return db.get(`levels_formula_${guildId}`) || 'quadratic'; }
function getNotifChannel(guildId) { return db.get(`levelchannel_${guildId}`); }
function getNotifStyle(guildId) { return db.get(`levelstyle_${guildId}`) || 'message'; }
function getNotifMsg(guildId) { return db.get(`levelmsg_${guildId}`); }
function getNotifEmbed(guildId) { return db.get(`levelmessageembed_${guildId}`); }

const FORMULA_LABELS = { quadratic: 'Quadratique (niveau² × 10)', linear: 'Linéaire (niveau × 100)', progressive: 'Progressive (niveau × 50 + niveau² × 5)', hard: 'Difficile (niveau³)' };
function computeXp(preset, level) {
  switch (preset) {
    case 'linear':       return level * 100;
    case 'progressive':  return level * 50 + level * level * 5;
    case 'hard':         return level * level * level;
    case 'quadratic':
    default:             return level * level * 10;
  }
}

// ── Container Builder ─────────────────────────────────────────────────────────
function buildContent(guild, pendingLevel, pendingRoleId, rewardPage = 1) {
  const guildId = guild.id;
  const enabled = isEnabled(guildId);
  const xpMin = getXpMin(guildId), xpMax = getXpMax(guildId);
  const formulaPreset = getFormulaPreset(guildId);
  const notifChan = getNotifChannel(guildId);
  const notifStyle = getNotifStyle(guildId);
  const hasNotifMsg = getNotifMsg(guildId) || getNotifEmbed(guildId);
  const rewards = getRewards(guildId).sort((a, b) => a.level - b.level);

  const PER_PAGE = 4;
  const totalRewardPages = Math.max(1, Math.ceil(rewards.length / PER_PAGE));
  const safePage = Math.min(Math.max(1, rewardPage), totalRewardPages);
  const rewardSlice = rewards.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId('lvl_role_select')
    .setPlaceholder('Sélectionner un rôle récompense')
    .setMinValues(1).setMaxValues(1);

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('lvl_notif_channel_select')
    .setPlaceholder('Sélectionner un salon de notification')
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMinValues(1).setMaxValues(1);

  const comps = [
    txt('## 📊 Gestion du Système de Niveaux'),
    sep(),
    txt(`**Statut :** ${enabled ? '🟢 Activé' : '🔴 Désactivé'}`),
    row(btn('lvl_toggle', enabled ? 'Désactiver' : 'Activer', enabled ? ButtonStyle.Danger : ButtonStyle.Success)),
    sep(),
    txt(`**Gain d'XP par message :** ${xpMin} à ${xpMax}`),
    row(btn('lvl_edit_xp', 'Modifier', ButtonStyle.Primary)),
    sep(),
    txt(`**Formule de progression :** ${FORMULA_LABELS[formulaPreset] || formulaPreset} (XP lvl 10: **${computeXp(formulaPreset, 10)}**)`),
    row(btn('lvl_edit_formula', 'Modifier', ButtonStyle.Primary)),
    sep(),
    txt(`**Notification :** ${notifChan ? `<#${notifChan}>` : 'Non configuré'} | Style: ${notifStyle === 'embed' ? 'Embed' : 'Message'} | Contenu: ${hasNotifMsg ? '✅' : '❌'}`),
    row(
      btn('lvl_notif_style', notifStyle === 'embed' ? '📝 Style Message' : '📋 Style Embed', ButtonStyle.Secondary),
      btn('lvl_notif_msg', 'Configurer message', ButtonStyle.Primary),
      btn('lvl_notif_embed', "Configurer embed", ButtonStyle.Primary)
    ),
    row(channelSelect),
    sep(),
    txt('**── Ajouter une récompense ──**'),
    txt(`**Niveau :** ${pendingLevel !== null ? `Niveau **${pendingLevel}**` : 'Non défini'} | **Rôle :** ${pendingRoleId ? (() => { const _pr = guild.roles.cache.get(pendingRoleId); return _pr ? `${_pr.name} (\`${pendingRoleId}\`)` : `~~${pendingRoleId}~~`; })() : 'Non défini'}`),
    row(roleSelect),
    row(
      btn('lvl_set_level', 'Définir le niveau', ButtonStyle.Primary),
      btn('lvl_add_reward', 'Valider', ButtonStyle.Success, null, pendingLevel === null || !pendingRoleId)
    ),
    sep(),
    txt('**── Récompenses configurées ──**')
  ];

  if (rewards.length === 0) {
    comps.push(txt('*Aucune récompense configurée.*'));
  } else {
    for (const reward of rewardSlice) {
      const role = guild.roles.cache.get(reward.roleId);
      comps.push(
        txt(`• **Niveau ${reward.level}** → ${role ? `${role.name} (\`${reward.roleId}\`)` : `~~${reward.roleId}~~ *(supprimé)*`}`),
        row(btn(`lvl_del_${reward.level}`, 'Supprimer', ButtonStyle.Danger))
      );
    }
    if (totalRewardPages > 1) {
      comps.push(paginationRow(safePage, totalRewardPages, 'lvl_prev', 'lvl_next'));
    }
  }

  return container(...comps);
}

// ── Prompt ────────────────────────────────────────────────────────────────────
async function promptText(channel, author, title, description) {
  const qMsg = await channel.send({ components: [container(txt(`## ${title}`), sep(), txt(description))], flags: FLAGS });
  try {
    const col = await channel.awaitMessages({ filter: m => m.author.id === author.id, max: 1, time: 60_000, errors: ['time'] });
    const resp = col.first(); await resp.delete().catch(() => {}); await qMsg.delete().catch(() => {});
    return resp.content === 'skip' ? null : resp.content;
  } catch { await qMsg.delete().catch(() => {}); return null; }
}

// ── Embed Editor ──────────────────────────────────────────────────────────────
async function embedEditor(message, existing = null) {
  let embedBase = new EmbedBuilder(existing || { description: '** **', color: 0x1a1a1a });
  const VARS = '`{user}` `{user.name}` `{level}` `{xp}` `{guild:name}`';
  const editorContainer = container(
    txt(`**Éditeur d'embed de niveau**\nVariables : ${VARS}`),
    sep(),
    row(new StringSelectMenuBuilder().setCustomId('lvl_embed_menu').setPlaceholder('Que modifier ?').addOptions([
      { label: 'Titre', value: 'title', emoji: '✏️' }, { label: 'Supprimer titre', value: 'del_title', emoji: '🗑️' },
      { label: 'Description', value: 'description', emoji: '💬' }, { label: 'Supprimer description', value: 'del_description', emoji: '🗑️' },
      { label: 'Auteur', value: 'author', emoji: '🕵️' }, { label: 'Footer', value: 'footer', emoji: '🔻' },
      { label: 'Couleur', value: 'color', emoji: '🎨' }, { label: 'Thumbnail', value: 'thumbnail', emoji: '🖼️' },
      { label: 'Image', value: 'image', emoji: '🏞️' }
    ].map(o => { const opt = new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value); if (o.emoji) opt.setEmoji(o.emoji); return opt; }))),
    row(
      btn('lvl_embed_validate', 'Valider', ButtonStyle.Success),
      btn('lvl_embed_cancel', 'Annuler', ButtonStyle.Danger)
    )
  );
  const editorMsg = await message.channel.send({ components: [editorContainer], embeds: [embedBase], flags: FLAGS });
  const ask = async (q) => {
    const qMsg = await message.channel.send({ components: [container(txt(q))], flags: FLAGS });
    try { const col = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 60_000 }); const resp = col.first(); await qMsg.delete().catch(() => {}); await resp.delete().catch(() => {}); return resp.content; } catch { await qMsg.delete().catch(() => {}); return null; }
  };
  return new Promise(resolve => {
    const col = editorMsg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300_000 });
    col.on('collect', async interaction => {
      await interaction.deferUpdate().catch(() => {});
      if (interaction.isButton()) {
        if (interaction.customId === 'lvl_embed_validate') { const d = typeof embedBase.toJSON === 'function' ? embedBase.toJSON() : (embedBase.data || embedBase); await editorMsg.delete().catch(() => {}); col.stop('done'); resolve(d); return; }
        if (interaction.customId === 'lvl_embed_cancel') { await editorMsg.delete().catch(() => {}); col.stop('done'); resolve(null); return; }
      }
      if (interaction.isStringSelectMenu()) {
        switch (interaction.values[0]) {
          case 'title': { const v = await ask('Titre ?'); if (v) embedBase.setTitle(v); break; }
          case 'del_title': try { embedBase.setTitle(null); } catch {} break;
          case 'description': { const v = await ask('Description ?'); if (v) embedBase.setDescription(v); break; }
          case 'del_description': embedBase.setDescription('** **'); break;
          case 'author': { const v = await ask('Nom auteur ?'); if (v) embedBase.setAuthor({ name: v }); break; }
          case 'footer': { const v = await ask('Texte footer ?'); if (v) embedBase.setFooter({ text: v }); break; }
          case 'color': { const v = await ask('Couleur (#RRGGBB) ?'); if (v) { try { embedBase.setColor(v); } catch {} } break; }
          case 'thumbnail': { const v = await ask('URL thumbnail ?'); if (v) { try { embedBase.setThumbnail(v); } catch {} } break; }
          case 'image': { const v = await ask("URL image ?"); if (v) { try { embedBase.setImage(v); } catch {} } break; }
        }
        await editorMsg.edit({ embeds: [embedBase] }).catch(() => {});
      }
    });
    col.on('end', (_, reason) => { if (reason !== 'done') { editorMsg.edit({ components: [] }).catch(() => {}); resolve(null); } });
  });
}

// ── Module ────────────────────────────────────────────────────────────────────
module.exports = {
  name: 'levels',
  aliases: ['level', 'lvl', 'niveaux'],
  description: 'Gestion complète du système de niveaux',
  category: 'gestion',

  run: async (client, message) => {
    let perm = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!perm) message.member.roles.cache.forEach(r => { if (db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
    if (!perm) return reply(message, errorContainer('Permissions insuffisantes.'));

    const guildId = message.guild.id;
    let pendingLevel = null;
    let pendingRoleId = null;
    let rewardPage = 1;

    await message.guild.roles.fetch().catch(() => {});

    const configMsg = await message.channel.send({ components: [buildContent(message.guild, pendingLevel, pendingRoleId, rewardPage)], flags: FLAGS });
    const refresh = () => configMsg.edit({ components: [buildContent(message.guild, pendingLevel, pendingRoleId, rewardPage)], flags: FLAGS }).catch(() => {});

    const notify = async (msg) => {
      const m = await message.channel.send({ components: [container(txt(msg))], flags: FLAGS }).catch(() => null);
      if (m) setTimeout(() => m.delete().catch(() => {}), 5_000);
    };

    const collector = configMsg.createMessageComponentCollector({ time: 300_000 });

    collector.on('collect', async interaction => {
      if (interaction.user.id !== message.author.id) return interaction.reply({ content: 'Accès refusé.', ephemeral: true });
      await interaction.deferUpdate().catch(() => {});
      const cid = interaction.customId;

      if (cid === 'lvl_toggle') {
        db.set(`levels_enabled_${guildId}`, !isEnabled(guildId));
        await refresh(); return;
      }

      if (cid === 'lvl_edit_xp') {
        const val = await promptText(message.channel, message.author, "🎲 Gain d'XP",
          'Entrez le gain minimum et maximum séparés par un espace.\n\nExemple : `5 10` pour un gain aléatoire entre 5 et 10 XP\n\nTapez `skip` pour annuler.');
        if (val) {
          const parts = val.trim().split(/\s+/);
          const min = parseInt(parts[0]), max = parseInt(parts[1] || parts[0]);
          if (!isNaN(min) && !isNaN(max) && min > 0 && max >= min) {
            db.set(`levels_xp_min_${guildId}`, min);
            db.set(`levels_xp_max_${guildId}`, max);
            await notify(`✅ XP par message : **${min}** à **${max}**`);
          } else { await notify('❌ Format invalide. Ex: `5 10`'); }
        }
        await refresh(); return;
      }

      if (cid === 'lvl_edit_formula') {
        const PRESETS = { quadratic: 'Quadratique (niveau² × 10) — défaut', linear: 'Linéaire (niveau × 100)', progressive: 'Progressive (niveau × 50 + niveau² × 5)', hard: 'Difficile (niveau³)' };
        const formatDesc = { quadratic: '`niveau × niveau × 10`', linear: '`niveau × 100`', progressive: '`niveau × 50 + niveau² × 5`', hard: '`niveau³`' };
        const current = db.get(`levels_formula_${guildId}`) || 'quadratic';
        const listStr = Object.entries(PRESETS).map(([k, v]) => `${k === current ? '✅' : '◻️'} **${k}** — ${v}\n  XP niveau 10 : ${computeXp(k, 10)}`).join('\n');
        const val = await promptText(message.channel, message.author, '📐 Formule de progression',
          `**Presets disponibles :**\n${listStr}\n\nTapez le nom du preset (\`quadratic\`, \`linear\`, \`progressive\`, \`hard\`) ou \`skip\` pour annuler.`);
        if (val && val !== 'skip') {
          if (PRESETS[val.trim().toLowerCase()]) {
            db.set(`levels_formula_${guildId}`, val.trim().toLowerCase());
            await notify(`✅ Formule : **${PRESETS[val.trim().toLowerCase()]}** — ${formatDesc[val.trim().toLowerCase()]}`);
          } else { await notify(`❌ Preset invalide. Choisissez parmi : ${Object.keys(PRESETS).join(', ')}`); }
        }
        await refresh(); return;
      }

      if (cid === 'lvl_notif_style') {
        const current = getNotifStyle(guildId);
        db.set(`levelstyle_${guildId}`, current === 'embed' ? 'message' : 'embed');
        await refresh(); return;
      }

      if (cid === 'lvl_notif_msg') {
        const VARS = '{user} {user.name} {user.tag} {level} {xp} {guild:name} {guild:member}';
        const val = await promptText(message.channel, message.author, '📝 Message de montée de niveau', `Variables : \`${VARS}\`\n\nEntrez le message :`);
        if (val) { db.set(`levelmsg_${guildId}`, val); db.set(`levelmessageembed_${guildId}`, null); db.set(`levelstyle_${guildId}`, 'message'); await notify('✅ Message configuré.'); }
        await refresh(); return;
      }

      if (cid === 'lvl_notif_embed') {
        const existing = getNotifEmbed(guildId);
        const result = await embedEditor(message, existing);
        if (result) { db.set(`levelmessageembed_${guildId}`, result); db.set(`levelmsg_${guildId}`, null); db.set(`levelstyle_${guildId}`, 'embed'); await notify('✅ Embed configuré.'); }
        await refresh(); return;
      }

      if (cid === 'lvl_notif_channel_select') {
        db.set(`levelchannel_${guildId}`, interaction.values[0]);
        await refresh(); return;
      }

      if (cid === 'lvl_role_select') {
        pendingRoleId = interaction.values[0];
        await refresh(); return;
      }

      if (cid === 'lvl_set_level') {
        const val = await promptText(message.channel, message.author, '🎯 Définir le niveau',
          'Entrez le numéro de niveau pour cette récompense.\n\nExemple : `10` pour le niveau 10\n\nTapez `skip` pour annuler.');
        if (val) {
          const n = parseInt(val);
          if (!isNaN(n) && n > 0 && n <= 500) { pendingLevel = n; await notify(`✅ Niveau défini : **${n}**`); }
          else { await notify('❌ Niveau invalide (1-500).'); }
        }
        await refresh(); return;
      }

      if (cid === 'lvl_add_reward') {
        if (pendingLevel === null || !pendingRoleId) { await notify('❌ Définissez un niveau et un rôle.'); return; }
        const rewards = getRewards(guildId).filter(r => r.level !== pendingLevel);
        rewards.push({ level: pendingLevel, roleId: pendingRoleId });
        setRewards(guildId, rewards.sort((a, b) => a.level - b.level));
        const role = message.guild.roles.cache.get(pendingRoleId);
        await notify(`✅ Récompense ajoutée : Niveau **${pendingLevel}** → ${role ? role.toString() : pendingRoleId}`);
        pendingLevel = null; pendingRoleId = null; rewardPage = 1;
        await refresh(); return;
      }

      if (cid.startsWith('lvl_del_')) {
        const level = parseInt(cid.replace('lvl_del_', ''));
        const rewards = getRewards(guildId).filter(r => r.level !== level);
        setRewards(guildId, rewards);
        const total = Math.max(1, Math.ceil(rewards.length / 4));
        if (rewardPage > total) rewardPage = total;
        await refresh(); return;
      }

      if (cid === 'lvl_prev') { rewardPage = Math.max(1, rewardPage - 1); await refresh(); return; }
      if (cid === 'lvl_next') {
        const total = Math.max(1, Math.ceil(getRewards(guildId).length / 4));
        rewardPage = Math.min(total, rewardPage + 1);
        await refresh(); return;
      }
    });

    collector.on('end', () => configMsg.edit({ components: [container(txt('⏰ Menu expiré.'))], flags: FLAGS }).catch(() => {}));
  }
};
