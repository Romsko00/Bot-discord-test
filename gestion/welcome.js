const Discord = require('discord.js');
const { ChannelSelectMenuBuilder, ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/simpledb');
const logger = require('../../utils/logger');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, row, btn, reply, errorContainer, FLAGS } = require('../../utils/v2');

// ── Template ──────────────────────────────────────────────────────────────────
function formatTemplate(text, member, inviter = null, inviteCount = 0) {
  if (!text || !member?.user || !member?.guild) return text;
  try {
    const invName = inviter ? inviter.username : 'Inconnu';
    const invTag = inviter ? (inviter.tag || `${inviter.username}#0000`) : 'Inconnu';
    const invId = inviter ? inviter.id : 'Inconnu';
    return String(text)
      .replaceAll('{user}', member.toString()).replaceAll('{user:mention}', member.toString())
      .replaceAll('{user:name}', member.user.username).replaceAll('{user:tag}', member.user.tag || `${member.user.username}#0000`)
      .replaceAll('{user:id}', member.user.id)
      .replaceAll('{inviter}', inviter ? inviter.toString() : 'Inconnu').replaceAll('{inviter:mention}', inviter ? inviter.toString() : 'Inconnu')
      .replaceAll('{inviter:name}', invName).replaceAll('{inviter:tag}', invTag).replaceAll('{inviter:id}', invId)
      .replaceAll('{invite}', String(inviteCount)).replaceAll('{invites}', String(inviteCount)).replaceAll('{invite:count}', String(inviteCount))
      .replaceAll('{membre:counter}', String(member.guild.memberCount)).replaceAll('{member:counter}', String(member.guild.memberCount))
      .replaceAll('{member:count}', String(member.guild.memberCount))
      .replaceAll('{guild:name}', member.guild.name).replaceAll('{guild:members}', String(member.guild.memberCount))
      .replaceAll('{server:name}', member.guild.name).replaceAll('{server:members}', String(member.guild.memberCount));
  } catch { return text; }
}

// ── DB Helpers ────────────────────────────────────────────────────────────────
function getJoinConfig(guildId) {
  return {
    enabled: db.get(`welcome_enabled_${guildId}`) !== false,
    channelId: db.get(`joinchannelmessage_${guildId}`),
    style: db.get(`welcomestyle_${guildId}`) || 'message',
    message: db.get(`joinmessage_${guildId}`),
    embed: db.get(`joinmessageembed_${guildId}`),
    dmMessage: db.get(`joindmee_${guildId}`),
    dmEmbed: db.get(`joindmembed_${guildId}`),
    autoroleId: db.get(`autorole_${guildId}`)
  };
}

function getLeaveConfig(guildId) {
  return {
    enabled: db.get(`leave_enabled_${guildId}`) !== false,
    channelId: db.get(`leavechannelmessage_${guildId}`),
    style: db.get(`leavestyle_${guildId}`) || 'message',
    message: db.get(`leavemessage_${guildId}`),
    embed: db.get(`leavemessageembed_${guildId}`),
    dmMessage: db.get(`leavedmee_${guildId}`)
  };
}

// ── Invite detection ──────────────────────────────────────────────────────────
async function detectInviter(client, member) {
  try {
    if (!member.guild.members.me.permissions.has(Discord.PermissionFlagsBits.ManageGuild)) return { inviter: null, inviteCount: 0 };
    const currentInvites = await member.guild.invites.fetch().catch(() => null);
    if (!currentInvites) return { inviter: null, inviteCount: 0 };
    if (!client.guildInvites) client.guildInvites = new Map();
    const cached = client.guildInvites.get(member.guild.id);
    if (cached) {
      for (const [code, inv] of currentInvites) {
        const c = cached.get(code);
        if (c && inv.uses > c.uses) { client.guildInvites.set(member.guild.id, currentInvites); return { inviter: inv.inviter, inviteCount: inv.uses }; }
      }
    }
    client.guildInvites.set(member.guild.id, currentInvites);
    return { inviter: null, inviteCount: 0 };
  } catch { return { inviter: null, inviteCount: 0 }; }
}

// ── Member join handler ───────────────────────────────────────────────────────
async function handleMemberJoin(client, member) {
  try {
    const guildId = member.guild.id;
    const config = getJoinConfig(guildId);
    if (!config.enabled) return;
    const { inviter, inviteCount } = await detectInviter(client, member);
    if (config.autoroleId) {
      try {
        const role = member.guild.roles.cache.get(config.autoroleId);
        if (role && member.guild.members.me?.roles.highest.position > role.position) await member.roles.add(role);
      } catch {}
    }
    if (config.channelId && (config.message || config.embed)) {
      try {
        const channel = member.guild.channels.cache.get(config.channelId);
        if (channel?.isTextBased() && channel.permissionsFor(member.guild.members.me)?.has(Discord.PermissionFlagsBits.SendMessages)) {
          if (config.style === 'embed' && config.embed) {
            const ed = JSON.parse(JSON.stringify(config.embed));
            if (ed.title) ed.title = formatTemplate(ed.title, member, inviter, inviteCount);
            if (ed.description) ed.description = formatTemplate(ed.description, member, inviter, inviteCount);
            if (ed.footer?.text) ed.footer.text = formatTemplate(ed.footer.text, member, inviter, inviteCount);
            if (ed.author?.name) ed.author.name = formatTemplate(ed.author.name, member, inviter, inviteCount);
            if (ed.fields) ed.fields = ed.fields.map(f => ({ ...f, name: formatTemplate(f.name, member, inviter, inviteCount), value: formatTemplate(f.value, member, inviter, inviteCount) }));
            await channel.send({ embeds: [new EmbedBuilder(ed)] });
          } else if (config.message) {
            await channel.send(formatTemplate(config.message, member, inviter, inviteCount));
          }
        }
      } catch {}
    }
    if (config.dmMessage) { try { await member.send(formatTemplate(config.dmMessage, member, inviter, inviteCount)); } catch {} }
    if (config.dmEmbed) {
      try {
        const ed = JSON.parse(JSON.stringify(config.dmEmbed));
        if (ed.description) ed.description = formatTemplate(ed.description, member, inviter, inviteCount);
        await member.send({ embeds: [new EmbedBuilder(ed)] });
      } catch {}
    }
  } catch (err) { logger.error('[WELCOME] handleMemberJoin:', err); }
}

// ── Container Builder ─────────────────────────────────────────────────────────
function buildContainer(guild, tab = 'join') {
  const guildId = guild.id;
  const isJoin = tab === 'join';
  const cfg = isJoin ? getJoinConfig(guildId) : getLeaveConfig(guildId);

  const currentStyle = cfg.style || 'message';

  const tabMenu = new StringSelectMenuBuilder()
    .setCustomId('welcome_tab')
    .setPlaceholder(isJoin ? '👋 Arrivée' : '🚪 Départ')
    .addOptions([
      new StringSelectMenuOptionBuilder().setLabel('Arrivée').setValue('join').setEmoji('👋').setDefault(isJoin),
      new StringSelectMenuOptionBuilder().setLabel('Départ').setValue('leave').setEmoji('🚪').setDefault(!isJoin)
    ]);

  const styleMenu = new StringSelectMenuBuilder()
    .setCustomId('welcome_style_select')
    .setPlaceholder('Choisir le style du message...')
    .addOptions([
      new StringSelectMenuOptionBuilder()
        .setLabel('💬 Message texte')
        .setValue('message')
        .setDescription('Message texte simple')
        .setDefault(currentStyle === 'message'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📋 Embed')
        .setValue('embed')
        .setDescription('Embed Discord personnalisé (titre, image, couleur...)')
        .setDefault(currentStyle === 'embed'),
    ]);

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('welcome_channel_select')
    .setPlaceholder('Sélectionner un salon')
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMinValues(1).setMaxValues(1);

  const salonText = cfg.channelId ? `<#${cfg.channelId}>` : '❌ Aucun salon configuré';
  const styleLabel = currentStyle === 'embed' ? '📋 Embed' : '💬 Message texte';

  const comps = [
    txt(`## ⚙️ Configuration Greeting — ${isJoin ? 'Arrivée' : 'Départ'}`),
    sep(),
    row(tabMenu),
    txt(`**Statut :** ${cfg.enabled ? '🟢 Actif' : '🔴 Désactivé'}`),
    row(btn('welcome_toggle', cfg.enabled ? '🔴 Désactiver' : '🟢 Activer', cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success)),
    sep(),
    txt(`**Salon :** ${salonText}`),
    row(btn('welcome_reset_channel', '🗑️ Réinitialiser le salon', ButtonStyle.Danger)),
    row(channelSelect),
    txt(`**Style :** ${styleLabel}`),
    row(styleMenu),
  ];

  // Show message or embed config depending on chosen style
  if (currentStyle === 'embed') {
    const embedStatus = cfg.embed ? '✅ Embed configuré' : '❌ Non configuré';
    comps.push(
      sep(),
      txt(`**Embed de ${isJoin ? 'bienvenue' : 'départ'} :** ${embedStatus}\n*Personnalisez : titre, description, image, thumbnail, couleur, footer, champs...*`),
      row(
        btn('welcome_reset_embed', '🗑️ Réinitialiser', ButtonStyle.Danger),
        btn('welcome_config_embed', '✏️ Personnaliser l\'embed', ButtonStyle.Primary)
      )
    );
  } else {
    const msgStatus = cfg.message ? `✅ Configuré` : '❌ Non configuré';
    comps.push(
      sep(),
      txt(`**Message texte de ${isJoin ? 'bienvenue' : 'départ'} :** ${msgStatus}${cfg.message ? `\n\`\`\`\n${String(cfg.message).slice(0, 100)}${cfg.message.length > 100 ? '...' : ''}\n\`\`\`` : ''}`),
      row(
        btn('welcome_reset_message', '🗑️ Réinitialiser', ButtonStyle.Danger),
        btn('welcome_config_message', '✏️ Configurer le message', ButtonStyle.Primary)
      )
    );
  }

  // DM section
  const dmText = cfg.dmMessage ? '✅ Configuré' : '❌ Non configuré';
  comps.push(
    sep(),
    txt(`**Message DM :** ${dmText}\n*Envoyé en message privé au membre*`),
    row(
      btn('welcome_reset_dm', '🗑️ Réinitialiser', ButtonStyle.Danger),
      btn('welcome_config_dm', '✏️ Configurer le DM', ButtonStyle.Primary)
    )
  );

  if (isJoin) {
    const dmEmbedText = cfg.dmEmbed ? '✅ Défini' : '❌ Non configuré';
    comps.push(
      txt(`**Embed DM :** ${dmEmbedText}`),
      row(
        btn('welcome_reset_dm_embed', '🗑️ Réinitialiser', ButtonStyle.Danger),
        btn('welcome_config_dm_embed', '✏️ Personnaliser l\'embed DM', ButtonStyle.Primary)
      ),
      txt(`**Rôle Automatique :** ${cfg.autoroleId ? (() => { const _wr = guild.roles.cache.get(cfg.autoroleId); return _wr ? `${_wr.name} (\`${cfg.autoroleId}\`)` : `~~${cfg.autoroleId}~~`; })() : '❌ Non configuré'}`),
      row(
        btn('welcome_reset_role', '🗑️ Réinitialiser', ButtonStyle.Danger),
        btn('welcome_config_role', '🎭 Configurer le rôle', ButtonStyle.Secondary)
      )
    );
  }

  comps.push(
    sep(),
    row(
      btn('welcome_variables', '🔍 Variables disponibles', ButtonStyle.Secondary),
      btn('welcome_test', '🧪 Tester', ButtonStyle.Secondary)
    )
  );

  return container(...comps);
}

// ── Prompt helpers ────────────────────────────────────────────────────────────
async function promptText(channel, author, title, description, timeout = 60_000) {
  const qMsg = await channel.send({ components: [container(txt(`## ${title}`), sep(), txt(description))], flags: FLAGS });
  try {
    const col = await channel.awaitMessages({ filter: m => m.author.id === author.id, max: 1, time: timeout, errors: ['time'] });
    const resp = col.first();
    await resp.delete().catch(() => {}); await qMsg.delete().catch(() => {});
    return resp.content;
  } catch { await qMsg.delete().catch(() => {}); return null; }
}

async function promptRole(channel, author, guild) {
  const text = await promptText(channel, author, '🎭 Rôle Automatique', 'Mentionnez le rôle ou envoyez son ID\n\n*60 secondes*');
  if (!text) return null;
  const match = text.match(/^<@&(\d+)>$/) || text.match(/^(\d+)$/);
  if (!match) return null;
  return guild.roles.cache.get(match[1]) || null;
}

// ── Embed Editor ──────────────────────────────────────────────────────────────
async function embedEditor(message, safeColor, existingEmbed = null) {
  let embedData = existingEmbed ? JSON.parse(JSON.stringify(existingEmbed)) : { description: '** **', color: safeColor };
  let embedBase = new EmbedBuilder(embedData);
  const VARS_TEXT = '```\n{user} {user:name} {user:tag} {user:id}\n{inviter} {inviter:name} {invite:count}\n{member:counter} {guild:name}\n```';
  const menuOptions = [
    { label: 'Modifier le titre', value: 'modify_title', emoji: '✏️' }, { label: 'Supprimer le titre', value: 'delete_title', emoji: '🗑️' },
    { label: 'Modifier la description', value: 'modify_description', emoji: '💬' }, { label: 'Supprimer la description', value: 'delete_description', emoji: '🗑️' },
    { label: "Modifier l'auteur", value: 'modify_author', emoji: '🕵️' }, { label: "Supprimer l'auteur", value: 'delete_author', emoji: '🗑️' },
    { label: 'Modifier le footer', value: 'modify_footer', emoji: '🔻' }, { label: 'Supprimer le footer', value: 'delete_footer', emoji: '🗑️' },
    { label: 'Modifier le thumbnail', value: 'modify_thumbnail', emoji: '🖼️' }, { label: 'Supprimer le thumbnail', value: 'delete_thumbnail', emoji: '🗑️' },
    { label: "Modifier l'image", value: 'modify_image', emoji: '🏞️' }, { label: "Supprimer l'image", value: 'delete_image', emoji: '🗑️' },
    { label: 'Modifier la couleur', value: 'modify_color', emoji: '🎨' },
    { label: 'Ajouter un champ', value: 'add_field', emoji: '➕' }, { label: 'Supprimer un champ', value: 'delete_field', emoji: '➖' },
    { label: 'Activer/Désactiver timestamp', value: 'toggle_timestamp', emoji: '🕐' },
  ];

  const buildEditorContainer = () => container(
    txt(`**Éditeur d'embed**\n${VARS_TEXT}\nUtilisez le menu pour modifier, puis **Valider**.`),
    sep(),
    row(new StringSelectMenuBuilder().setCustomId('welcome_embed_menu').setPlaceholder('Que voulez-vous modifier ?').addOptions(menuOptions.map(o => {
      const opt = new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value);
      if (o.emoji) opt.setEmoji(o.emoji);
      return opt;
    }))),
    row(
      new ButtonBuilder().setCustomId('welcome_embed_validate').setLabel('Valider').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('welcome_embed_cancel').setLabel('Annuler').setEmoji('✖️').setStyle(ButtonStyle.Danger)
    )
  );

  // Preview (embed only — cannot mix embeds + CV2 flags)
  const previewMsg = await message.channel.send({ content: '-# 👁️ Aperçu de l\'embed — se met à jour en temps réel', embeds: [embedBase] });
  // Editor controls (CV2 container, no embeds)
  const editorMsg = await message.channel.send({ components: [buildEditorContainer()], flags: FLAGS });

  const ask = async (prompt) => {
    const q = await message.channel.send({ components: [container(txt(prompt))], flags: FLAGS });
    try {
      const col = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 90_000, errors: ['time'] });
      const resp = col.first(); await q.delete().catch(() => {}); await resp.delete().catch(() => {});
      return resp.content === 'skip' ? null : resp.content;
    } catch { await q.delete().catch(() => {}); return null; }
  };

  const cleanUp = async () => {
    await editorMsg.delete().catch(() => {});
    await previewMsg.delete().catch(() => {});
  };

  return new Promise((resolve) => {
    const col = editorMsg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 600_000 });
    col.on('collect', async (interaction) => {
      await interaction.deferUpdate().catch(() => {});
      if (interaction.isButton()) {
        if (interaction.customId === 'welcome_embed_validate') {
          const payload = typeof embedBase.toJSON === 'function' ? embedBase.toJSON() : (embedBase.data || embedBase);
          await cleanUp(); col.stop('user_action'); resolve(payload); return;
        }
        if (interaction.customId === 'welcome_embed_cancel') { await cleanUp(); col.stop('user_action'); resolve(null); return; }
      }
      if (!interaction.isStringSelectMenu()) return;
      switch (interaction.values[0]) {
        case 'modify_title': { const v = await ask('**Titre** (max 256 car.) — tapez `skip` pour annuler'); if (v) embedBase.setTitle(v.slice(0, 256)); break; }
        case 'delete_title': try { embedBase.setTitle(null); } catch {} break;
        case 'modify_description': { const v = await ask('**Description** (max 4096 car.)'); if (v) embedBase.setDescription(v.slice(0, 4096)); break; }
        case 'delete_description': embedBase.setDescription('** **'); break;
        case 'modify_author': { const name = await ask("**Nom de l'auteur**"); if (name) { const icon = await ask("**URL icône auteur** (ou `skip`)"); embedBase.setAuthor({ name: name.slice(0, 256), iconURL: icon || undefined }); } break; }
        case 'delete_author': embedBase.setAuthor(null); break;
        case 'modify_footer': { const text = await ask('**Texte du footer**'); if (text) { const icon = await ask("**URL icône footer** (ou `skip`)"); embedBase.setFooter({ text: text.slice(0, 2048), iconURL: icon || undefined }); } break; }
        case 'delete_footer': embedBase.setFooter(null); break;
        case 'modify_thumbnail': { const v = await ask('**URL du thumbnail**'); if (v) { try { embedBase.setThumbnail(v); } catch {} } break; }
        case 'delete_thumbnail': try { embedBase.setThumbnail(null); } catch {} break;
        case 'modify_image': { const v = await ask("**URL de l'image**"); if (v) { try { embedBase.setImage(v); } catch {} } break; }
        case 'delete_image': try { embedBase.setImage(null); } catch {} break;
        case 'modify_color': { const v = await ask('**Couleur** hex `#RRGGBB`'); if (v) { try { embedBase.setColor(v); } catch {} } break; }
        case 'add_field': {
          const fields = embedBase.data?.fields || [];
          if (fields.length >= 25) break;
          const name = await ask('**Nom du champ**'); if (!name) break;
          const value = await ask('**Valeur du champ**'); if (!value) break;
          const inl = await ask('**Inline ?** (`oui`/`non`)');
          embedBase.addFields({ name: name.slice(0, 256), value: value.slice(0, 1024), inline: inl?.toLowerCase() === 'oui' }); break;
        }
        case 'delete_field': {
          const fields = embedBase.data?.fields || []; if (!fields.length) break;
          const selRow = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('wemb_field_del').setPlaceholder('Champ à supprimer').addOptions(fields.slice(0, 25).map((f, i) => ({ label: `${i + 1}. ${f.name.slice(0, 90)}`, value: String(i) }))));
          const selMsg = await message.channel.send({ content: 'Quel champ supprimer ?', components: [selRow] });
          const selInt = await selMsg.awaitMessageComponent({ filter: i => i.user.id === message.author.id, time: 30_000 }).catch(() => null);
          await selMsg.delete().catch(() => {});
          if (selInt) { await selInt.deferUpdate().catch(() => {}); const nf = [...(embedBase.data?.fields || [])]; nf.splice(parseInt(selInt.values[0]), 1); embedBase.setFields(nf); }
          break;
        }
        case 'toggle_timestamp': { if (embedBase.data?.timestamp) embedBase.data.timestamp = null; else embedBase.setTimestamp(); break; }
      }
      // Update preview embed separately (no CV2 flags)
      await previewMsg.edit({ embeds: [embedBase] }).catch(() => {});
    });
    col.on('end', (_, reason) => { if (reason !== 'user_action') { cleanUp().catch(() => {}); resolve(null); } });
  });
}

// ── Module ────────────────────────────────────────────────────────────────────
module.exports = {
  name: 'welcome', aliases: ['setwelcome', 'welcome-config', 'bienvenue'],
  description: 'Configure le système de bienvenue', usage: 'welcome', category: 'gestion',
  handleMemberJoin,

  run: async (client, message, args, prefix, color) => {
    let perm = false;
    message.member.roles.cache.forEach(r => { if (db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
    if (!client.config.superadmin.includes(message.author.id) && !client.config.owners.includes(message.author.id) && db.get(`ownermd_${client.user.id}_${message.author.id}`) !== true && !perm && !hasPermissionLevel(client, message, 6))
      return reply(message, errorContainer('**Accès Refusé** — Niveau 6 (admin) requis.'));

    const safeColor = color || 0x1a1a1a;
    let currentTab = 'join';

    const configMsg = await message.channel.send({ components: [container(txt('⏳ Chargement...'))], flags: FLAGS });
    await configMsg.edit({ components: [buildContainer(message.guild, currentTab)], flags: FLAGS }).catch((e) => console.error('[welcome] edit initial error:', e?.message || e));

    const notify = async (msg) => {
      const m = await message.channel.send({ components: [container(txt(msg))], flags: FLAGS }).catch(() => null);
      if (m) setTimeout(() => m.delete().catch(() => {}), 5_000);
    };

    const collector = configMsg.createMessageComponentCollector({ time: 300_000 });
    const refresh = () => configMsg.edit({ components: [buildContainer(message.guild, currentTab)], flags: FLAGS }).catch((e) => console.error('[welcome] refresh error:', e?.message || e));

    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== message.author.id) return interaction.reply({ content: "Seul l'auteur peut utiliser ce menu.", ephemeral: true });
      await interaction.deferUpdate().catch(() => {});

      const cid = interaction.customId;

      if (cid === 'welcome_tab') {
        currentTab = interaction.values[0];
        await refresh(); return;
      }

      // Style selector (message vs embed)
      if (cid === 'welcome_style_select') {
        const newStyle = interaction.values[0];
        const gId = message.guild.id;
        if (currentTab === 'join') db.set(`welcomestyle_${gId}`, newStyle);
        else db.set(`leavestyle_${gId}`, newStyle);
        await refresh(); return;
      }

      // Channel select menu
      if (cid === 'welcome_channel_select') {
        const channelId = interaction.values[0];
        if (currentTab === 'join') db.set(`joinchannelmessage_${message.guild.id}`, channelId);
        else db.set(`leavechannelmessage_${message.guild.id}`, channelId);
        await refresh(); return;
      }

      const guildId = message.guild.id;

      if (currentTab === 'join') {
        switch (cid) {
          case 'welcome_toggle': {
            const cfg = getJoinConfig(guildId);
            db.set(`welcome_enabled_${guildId}`, !cfg.enabled);
            await refresh(); return;
          }
          case 'welcome_reset_channel': db.set(`joinchannelmessage_${guildId}`, null); await refresh(); return;
          case 'welcome_reset_message': db.set(`joinmessage_${guildId}`, null); await refresh(); return;
          case 'welcome_config_message': {
            const t = await promptText(message.channel, message.author, '📝 Message de bienvenue',
              'Entrez le message.\n\n**Variables :** `{user}` `{user:name}` `{inviter}` `{invite:count}` `{member:counter}` `{guild:name}`');
            if (t) { db.set(`joinmessage_${guildId}`, t); db.set(`joinmessageembed_${guildId}`, null); db.set(`welcomestyle_${guildId}`, 'message'); await notify('✅ Message configuré.'); }
            await refresh(); return;
          }
          case 'welcome_reset_embed': db.set(`joinmessageembed_${guildId}`, null); await refresh(); return;
          case 'welcome_config_embed': {
            const cfg = getJoinConfig(guildId);
            const result = await embedEditor(message, safeColor, cfg.embed);
            if (result) { db.set(`joinmessageembed_${guildId}`, result); db.set(`joinmessage_${guildId}`, null); db.set(`welcomestyle_${guildId}`, 'embed'); await notify('✅ Embed configuré.'); }
            await refresh(); return;
          }
          case 'welcome_reset_dm': db.set(`joindmee_${guildId}`, null); await refresh(); return;
          case 'welcome_config_dm': {
            const t = await promptText(message.channel, message.author, '💬 Message DM',
              'Ce message sera envoyé en MP au nouveau membre.\n\n**Variables :** `{user:name}` `{guild:name}` `{member:counter}`');
            if (t) { db.set(`joindmee_${guildId}`, t); await notify('✅ DM configuré.'); }
            await refresh(); return;
          }
          case 'welcome_reset_dm_embed': db.set(`joindmembed_${guildId}`, null); await refresh(); return;
          case 'welcome_config_dm_embed': {
            const cfg = getJoinConfig(guildId);
            const result = await embedEditor(message, safeColor, cfg.dmEmbed);
            if (result) { db.set(`joindmembed_${guildId}`, result); await notify('✅ Embed DM configuré.'); }
            await refresh(); return;
          }
          case 'welcome_reset_role': db.set(`autorole_${guildId}`, null); await refresh(); return;
          case 'welcome_config_role': {
            const role = await promptRole(message.channel, message.author, message.guild);
            if (role) { db.set(`autorole_${guildId}`, role.id); await notify(`✅ Rôle auto : ${role}`); }
            await refresh(); return;
          }
          case 'welcome_variables': {
            await notify('**Variables disponibles :**\n`{user}` `{user:name}` `{user:tag}` `{user:id}`\n`{inviter}` `{inviter:name}` `{invite:count}`\n`{member:counter}` `{guild:name}`');
            return;
          }
          case 'welcome_test': {
            const cfg = getJoinConfig(guildId);
            if (!cfg.channelId || (!cfg.message && !cfg.embed)) { await notify('❌ Configurez un salon et un message/embed.'); return; }
            const fakeUser = { id: message.author.id, username: message.author.username, tag: message.author.tag, toString: () => message.author.toString() };
            const fakeMember = { user: fakeUser, guild: message.guild, toString: () => message.author.toString() };
            try {
              if (cfg.style === 'embed' && cfg.embed) {
                const ed = JSON.parse(JSON.stringify(cfg.embed));
                if (ed.title) ed.title = formatTemplate(ed.title, fakeMember, fakeUser, 42);
                if (ed.description) ed.description = formatTemplate(ed.description, fakeMember, fakeUser, 42);
                const ch = message.guild.channels.cache.get(cfg.channelId);
                if (ch) await ch.send({ embeds: [new EmbedBuilder(ed)] });
              } else if (cfg.message) {
                const ch = message.guild.channels.cache.get(cfg.channelId);
                if (ch) await ch.send(formatTemplate(cfg.message, fakeMember, fakeUser, 42));
              }
              await notify('✅ Test envoyé.');
            } catch { await notify('❌ Erreur lors du test.'); }
            return;
          }
        }
      } else {
        // Leave tab
        switch (cid) {
          case 'welcome_toggle': {
            const cfg = getLeaveConfig(guildId);
            db.set(`leave_enabled_${guildId}`, !cfg.enabled);
            await refresh(); return;
          }
          case 'welcome_reset_channel': db.set(`leavechannelmessage_${guildId}`, null); await refresh(); return;
          case 'welcome_reset_message': db.set(`leavemessage_${guildId}`, null); await refresh(); return;
          case 'welcome_config_message': {
            const t = await promptText(message.channel, message.author, '🚪 Message de départ',
              'Entrez le message de départ.\n\n**Variables :** `{user}` `{user:name}` `{guild:name}` `{guild:members}`');
            if (t) { db.set(`leavemessage_${guildId}`, t); db.set(`leavemessageembed_${guildId}`, null); db.set(`leavestyle_${guildId}`, 'message'); await notify('✅ Message configuré.'); }
            await refresh(); return;
          }
          case 'welcome_reset_embed': db.set(`leavemessageembed_${guildId}`, null); await refresh(); return;
          case 'welcome_config_embed': {
            const cfg = getLeaveConfig(guildId);
            const result = await embedEditor(message, safeColor, cfg.embed);
            if (result) { db.set(`leavemessageembed_${guildId}`, result); db.set(`leavemessage_${guildId}`, null); db.set(`leavestyle_${guildId}`, 'embed'); await notify('✅ Embed configuré.'); }
            await refresh(); return;
          }
          case 'welcome_reset_dm': db.set(`leavedmee_${guildId}`, null); await refresh(); return;
          case 'welcome_config_dm': {
            const t = await promptText(message.channel, message.author, '💬 MP de départ',
              'Ce message sera envoyé en MP quand un membre quitte.\n\n**Variables :** `{user:name}` `{guild:name}`');
            if (t) { db.set(`leavedmee_${guildId}`, t); await notify('✅ DM configuré.'); }
            await refresh(); return;
          }
          case 'welcome_variables': {
            await notify('**Variables disponibles :**\n`{user}` `{user:name}` `{user:tag}` `{user:id}`\n`{guild:name}` `{guild:members}`');
            return;
          }
          case 'welcome_test': {
            const cfg = getLeaveConfig(guildId);
            const fakeMember = { user: { id: message.author.id, username: message.author.username, tag: message.author.tag }, guild: message.guild };
            if (!cfg.channelId || (!cfg.message && !cfg.embed)) { await notify('❌ Configurez un salon et un message/embed.'); return; }
            try {
              if (cfg.style === 'embed' && cfg.embed) {
                const ed = JSON.parse(JSON.stringify(cfg.embed));
                if (ed.description) ed.description = formatTemplate(ed.description, fakeMember);
                const ch = message.guild.channels.cache.get(cfg.channelId);
                if (ch) await ch.send({ embeds: [new EmbedBuilder(ed)] });
              } else if (cfg.message) {
                const ch = message.guild.channels.cache.get(cfg.channelId);
                if (ch) await ch.send(formatTemplate(cfg.message, fakeMember));
              }
              await notify('✅ Test envoyé.');
            } catch { await notify('❌ Erreur lors du test.'); }
            return;
          }
        }
      }
    });

    collector.on('end', async () => {
      try { await configMsg.edit({ components: [container(txt('⏰ Menu expiré.'))], flags: FLAGS }); } catch {}
    });
  }
};
