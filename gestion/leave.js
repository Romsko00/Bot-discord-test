const { EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
const db = require('../../utils/simpledb');
const { container, txt, sep, row, btn, reply, errorContainer, FLAGS, ButtonStyle } = require('../../utils/v2');

function formatTemplate(text, member) {
  if (!text || !member?.user) return text;
  return String(text)
    .replaceAll('{user}', member.user.toString()).replaceAll('{user:name}', member.user.username)
    .replaceAll('{user:tag}', member.user.tag || member.user.username).replaceAll('{user:id}', member.user.id)
    .replaceAll('{membre:counter}', String(member.guild?.memberCount || 0))
    .replaceAll('{guild:name}', member.guild?.name || '').replaceAll('{guild:members}', String(member.guild?.memberCount || 0));
}

function buildContainer(guildId) {
  const isEmbedStyle = db.get(`leavestyle_${guildId}`) === 'embed';
  const chanId = db.get(`leavechannelmessage_${guildId}`);
  const leaveMsg = db.get(`leavemessage_${guildId}`);
  const leaveEmbed = db.get(`leavemessageembed_${guildId}`);
  const dmMsg = db.get(`leavedmee_${guildId}`);

  const lines = [
    `**Salon d'aurevoir :** ${chanId ? `<#${chanId}>` : '❌ Non configuré'}`,
    `**Style :** ${isEmbedStyle ? '📋 Embed' : '📝 Message'}`,
    `**Contenu :** ${leaveMsg ? leaveMsg.slice(0, 80) + (leaveMsg.length > 80 ? '...' : '') : leaveEmbed ? '✅ Embed configuré' : '❌ Non configuré'}`,
    `**MP :** ${dmMsg ? dmMsg.slice(0, 60) + (dmMsg.length > 60 ? '...' : '') : '❌ Non configuré'}`,
    `**Variables :** \`{user} {user:name} {guild:name} {guild:members}\``
  ].join('\n');

  const menuOpts = isEmbedStyle ? [
    { label: 'Style Message', value: 'style_message', emoji: '📑' },
    { label: "Modifier le salon d'aurevoir", value: 'modify_channel', emoji: '📍' },
    { label: "Supprimer le salon d'aurevoir", value: 'delete_channel', emoji: '🗑️' },
    { label: "Modifier l'embed d'aurevoir", value: 'modify_embed', emoji: '📋' },
    { label: "Supprimer l'embed d'aurevoir", value: 'delete_embed', emoji: '🗑️' },
    { label: "Modifier le MP d'aurevoir", value: 'modify_dm', emoji: '💬' },
    { label: "Supprimer le MP d'aurevoir", value: 'delete_dm', emoji: '🗑️' },
    { label: "Tester le système d'aurevoir", value: 'test_leave', emoji: '🧪' }
  ] : [
    { label: 'Style Embed', value: 'style_embed', emoji: '📋' },
    { label: "Modifier le salon d'aurevoir", value: 'modify_channel', emoji: '📍' },
    { label: "Supprimer le salon d'aurevoir", value: 'delete_channel', emoji: '🗑️' },
    { label: "Modifier le message d'aurevoir", value: 'modify_message', emoji: '💬' },
    { label: "Supprimer le message d'aurevoir", value: 'delete_message', emoji: '🗑️' },
    { label: "Modifier le MP d'aurevoir", value: 'modify_dm', emoji: '📨' },
    { label: "Supprimer le MP d'aurevoir", value: 'delete_dm', emoji: '🗑️' },
    { label: "Tester le système d'aurevoir", value: 'test_leave', emoji: '🧪' }
  ];

  const menuSelect = new StringSelectMenuBuilder()
    .setCustomId('leave_menu')
    .setPlaceholder('Faites un choix')
    .addOptions(menuOpts.map(o => {
      const opt = new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value);
      if (o.emoji) opt.setEmoji(o.emoji);
      return opt;
    }));

  const actionBtns = [
    btn('leave_refresh', '🔄 Rafraîchir', ButtonStyle.Secondary),
    btn('leave_close', '✖️ Fermer', ButtonStyle.Danger)
  ];
  if (isEmbedStyle && leaveEmbed) actionBtns.unshift(btn('leave_view_embed', '🔍 Aperçu embed', ButtonStyle.Secondary));

  return container(
    txt('## ⚙️ Configuration Leave'),
    sep(),
    txt(lines),
    sep(),
    row(menuSelect),
    row(...actionBtns)
  );
}

module.exports = {
  name: 'leave',
  aliases: ['setleave', 'leave-config', 'aurevoir'],
  description: 'Configure le message de départ du serveur',
  category: 'gestion',
  run: async (client, message) => {
    let perm = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!perm) message.member.roles.cache.forEach(r => { if (db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
    if (!perm) return reply(message, errorContainer("Vous n'avez pas les permissions nécessaires."));

    const guildId = message.guild.id;

    const initialMessage = await message.channel.send({ components: [buildContainer(guildId)], flags: FLAGS });
    const refresh = () => initialMessage.edit({ components: [buildContainer(guildId)], flags: FLAGS }).catch(() => {});

    const ask = async (prompt) => {
      const q = await message.channel.send({ components: [container(txt(prompt))], flags: FLAGS });
      try {
        const col = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 60_000 });
        const resp = col.first();
        await q.delete().catch(() => {}); await resp.delete().catch(() => {});
        return resp.content === 'skip' ? null : resp.content;
      } catch { await q.delete().catch(() => {}); return null; }
    };

    const collector = initialMessage.createMessageComponentCollector({ time: 300_000 });
    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== message.author.id) return interaction.reply({ content: 'Vous ne pouvez pas interagir avec ce menu.', ephemeral: true });
      await interaction.deferUpdate().catch(() => {});

      if (interaction.isButton()) {
        if (interaction.customId === 'leave_view_embed') {
          const stored = db.get(`leavemessageembed_${guildId}`);
          if (stored) { const pm = await message.channel.send({ content: '🔍 **Aperçu :**', embeds: [new EmbedBuilder(stored)] }); setTimeout(() => pm.delete().catch(() => {}), 15_000); }
          return;
        }
        if (interaction.customId === 'leave_refresh') { await refresh(); return; }
        if (interaction.customId === 'leave_close') {
          collector.stop('user_closed');
          await initialMessage.edit({ components: [container(txt('## ✅ Configuration terminée.'), sep(), txt('Menu fermé.'))], flags: FLAGS }).catch(() => {});
          return;
        }
        return;
      }

      if (!interaction.isStringSelectMenu()) return;
      const sel = interaction.values[0];

      if (sel === 'style_embed') { db.set(`leavestyle_${guildId}`, 'embed'); await refresh(); return; }
      if (sel === 'style_message') { db.set(`leavestyle_${guildId}`, 'message'); await refresh(); return; }
      if (sel === 'delete_embed') { db.set(`leavemessageembed_${guildId}`, null); await refresh(); return; }
      if (sel === 'delete_message') { db.delete(`leavemessage_${guildId}`); await refresh(); return; }
      if (sel === 'delete_channel') { db.delete(`leavechannelmessage_${guildId}`); await refresh(); return; }
      if (sel === 'delete_dm') { db.delete(`leavedmee_${guildId}`); await refresh(); return; }

      if (sel === 'modify_message') {
        const VARS = '`{user}` `{user:name}` `{guild:name}` `{guild:members}`';
        const text = await ask(`**Message d'aurevoir**\nVariables : ${VARS}\n\nEntrez le message :`);
        if (text) { db.set(`leavemessageembed_${guildId}`, null); db.set(`leavemessage_${guildId}`, text); }
        await refresh(); return;
      }
      if (sel === 'modify_dm') {
        const text = await ask("**MP d'aurevoir**\nVariables : `{user:name}` `{guild:name}`\n\nEntrez le message :");
        if (text) db.set(`leavedmee_${guildId}`, text);
        await refresh(); return;
      }
      if (sel === 'modify_channel') {
        const text = await ask("Mentionnez ou envoyez l'ID du salon d'aurevoir :");
        if (!text) { await refresh(); return; }
        const ch = message.guild.channels.cache.find(c => `<#${c.id}>` === text) || message.guild.channels.cache.get(text.replace(/[<#>]/g, ''));
        if (ch) db.set(`leavechannelmessage_${guildId}`, ch.id);
        await refresh(); return;
      }
      if (sel === 'modify_embed') {
        db.set(`leavemessage_${guildId}`, null);
        await embedEditor(guildId, message); return;
      }
      if (sel === 'test_leave') {
        const fakeMember = { user: { id: message.author.id, username: message.author.username, tag: message.author.tag, toString: () => message.author.toString() }, guild: message.guild };
        const leaveMsg = db.get(`leavemessage_${guildId}`), leaveEmbed = db.get(`leavemessageembed_${guildId}`), style = db.get(`leavestyle_${guildId}`) || (leaveEmbed ? 'embed' : 'message');
        if (style === 'embed' && leaveEmbed) {
          try { const ed = JSON.parse(JSON.stringify(leaveEmbed)); if (ed.description) ed.description = formatTemplate(ed.description, fakeMember); await message.channel.send({ content: "🧪 **Test embed d'aurevoir :**", embeds: [new EmbedBuilder(ed)] }); } catch (e) { await message.channel.send({ components: [errorContainer('Erreur génération embed: ' + e.message)], flags: FLAGS }).catch(() => {}); }
        } else if (leaveMsg) { await message.channel.send(`🧪 **Test message d'aurevoir :**\n${formatTemplate(leaveMsg, fakeMember)}`); }
        else { await message.channel.send({ components: [container(txt('## ⚠️ Rien à tester'), sep(), txt("Configurez un message ou un embed d'aurevoir."))], flags: FLAGS }).catch(() => {}); }
        return;
      }
      await refresh();
    });

    collector.on('end', (_, r) => {
      if (r === 'user_closed' || r === 'messageDelete') return;
      initialMessage.edit({ components: [container(txt('## ⏰ Menu Expiré'), sep(), txt('Le menu de configuration a expiré.'))], flags: FLAGS }).catch(() => {});
    });

    async function embedEditor(gId, msg) {
      const existingRaw = db.get(`leavemessageembed_${gId}`);
      let embedBase = existingRaw ? new EmbedBuilder(existingRaw) : new EmbedBuilder().setDescription('** **').setColor(0x1a1a1a);
      const VARS_TEXT = '**Variables :** `{user}` `{user:name}` `{guild:name}` `{guild:members}`';
      const menuOpts = [
        { label: 'Modifier le titre', value: 'modify_title', emoji: '✏️' }, { label: 'Supprimer le titre', value: 'delete_title', emoji: '🗑️' },
        { label: 'Modifier la description', value: 'modify_description', emoji: '💬' }, { label: 'Supprimer la description', value: 'delete_description', emoji: '🗑️' },
        { label: "Modifier l'auteur", value: 'modify_author', emoji: '🕵️' }, { label: "Supprimer l'auteur", value: 'delete_author', emoji: '🗑️' },
        { label: 'Modifier le footer', value: 'modify_footer', emoji: '🔻' }, { label: 'Supprimer le footer', value: 'delete_footer', emoji: '🗑️' },
        { label: 'Modifier le thumbnail', value: 'modify_thumbnail', emoji: '🖼️' }, { label: "Modifier l'image", value: 'modify_image', emoji: '🏞️' },
        { label: 'Modifier la couleur', value: 'modify_color', emoji: '🎨' }, { label: 'Ajouter un champ', value: 'add_field', emoji: '➕' },
        { label: 'Activer timestamp', value: 'toggle_timestamp', emoji: '🕐' }
      ];
      const editorC = container(
        txt(`**Éditeur d'embed d'aurevoir**\n${VARS_TEXT}`),
        sep(),
        row(new StringSelectMenuBuilder().setCustomId('leave_embed_menu').setPlaceholder('Que voulez-vous modifier ?').addOptions(menuOpts.map(o => { const opt = new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value); if (o.emoji) opt.setEmoji(o.emoji); return opt; }))),
        row(
          btn('leave_embed_validate', 'Valider', ButtonStyle.Success),
          btn('leave_embed_preview', 'Aperçu', ButtonStyle.Secondary),
          btn('leave_embed_cancel', 'Annuler', ButtonStyle.Danger)
        )
      );
      const editorMsg = await msg.channel.send({ components: [editorC], embeds: [embedBase], flags: FLAGS });
      const askE = async (prompt) => { const q = await msg.channel.send({ components: [container(txt(prompt))], flags: FLAGS }); try { const col = await msg.channel.awaitMessages({ filter: m => m.author.id === msg.author.id, max: 1, time: 90_000 }); const resp = col.first(); await q.delete().catch(() => {}); await resp.delete().catch(() => {}); return resp.content === 'skip' ? null : resp.content; } catch { await q.delete().catch(() => {}); return null; } };
      const col = editorMsg.createMessageComponentCollector({ filter: i => i.user.id === msg.author.id, time: 600_000 });
      col.on('collect', async (interaction) => {
        await interaction.deferUpdate().catch(() => {});
        if (interaction.isButton()) {
          if (interaction.customId === 'leave_embed_validate') { const payload = typeof embedBase.toJSON === 'function' ? embedBase.toJSON() : (embedBase.data || embedBase); db.set(`leavemessageembed_${gId}`, payload); db.delete(`leavemessage_${gId}`); await editorMsg.delete().catch(() => {}); col.stop('saved'); await refresh(); return; }
          if (interaction.customId === 'leave_embed_cancel') { await editorMsg.delete().catch(() => {}); col.stop('cancelled'); await refresh(); return; }
          if (interaction.customId === 'leave_embed_preview') { const pm = await msg.channel.send({ content: '🔍 **Aperçu :**', embeds: [embedBase] }); setTimeout(() => pm.delete().catch(() => {}), 15_000); return; }
        }
        if (!interaction.isStringSelectMenu()) return;
        switch (interaction.values[0]) {
          case 'modify_title': { const v = await askE('**Titre** (max 256) :'); if (v) embedBase.setTitle(v.slice(0, 256)); break; }
          case 'delete_title': try { embedBase.setTitle(null); } catch {} break;
          case 'modify_description': { const v = await askE('**Description** (max 4096) :'); if (v) embedBase.setDescription(v.slice(0, 4096)); break; }
          case 'delete_description': embedBase.setDescription('** **'); break;
          case 'modify_author': { const n = await askE("**Nom de l'auteur** :"); if (n) { const ic = await askE('**URL icône** (ou `skip`) :'); embedBase.setAuthor({ name: n.slice(0, 256), iconURL: ic || undefined }); } break; }
          case 'delete_author': embedBase.setAuthor(null); break;
          case 'modify_footer': { const t = await askE('**Texte footer** :'); if (t) embedBase.setFooter({ text: t.slice(0, 2048) }); break; }
          case 'delete_footer': embedBase.setFooter(null); break;
          case 'modify_thumbnail': { const v = await askE('**URL thumbnail** :'); if (v) { try { embedBase.setThumbnail(v); } catch {} } break; }
          case 'modify_image': { const v = await askE("**URL image** :"); if (v) { try { embedBase.setImage(v); } catch {} } break; }
          case 'modify_color': { const v = await askE('**Couleur** (`#RRGGBB`) :'); if (v) { try { embedBase.setColor(v); } catch {} } break; }
          case 'add_field': {
            const fields = embedBase.data?.fields || []; if (fields.length >= 25) break;
            const n = await askE('**Nom du champ** :'); if (!n) break;
            const val = await askE('**Valeur** :'); if (!val) break;
            const inl = await askE('**Inline ?** (`oui`/`non`) :');
            embedBase.addFields({ name: n.slice(0, 256), value: val.slice(0, 1024), inline: inl?.toLowerCase() === 'oui' }); break;
          }
          case 'toggle_timestamp': if (embedBase.data?.timestamp) embedBase.data.timestamp = null; else embedBase.setTimestamp(); break;
        }
        await editorMsg.edit({ embeds: [embedBase] }).catch(() => {});
      });
      col.on('end', (_, r) => { if (r !== 'saved' && r !== 'cancelled') editorMsg.edit({ components: [] }).catch(() => {}); });
    }
  }
};
