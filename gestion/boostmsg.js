const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, EmbedBuilder } = require('discord.js');
const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

const DB_CHAN = (g) => `boostmsg_channel_${g}`;
const DB_MSG  = (g) => `boostmsg_message_${g}`;
const DB_EMB  = (g) => `boostmsg_embed_${g}`;
const DB_STYLE= (g) => `boostmsg_style_${g}`;
const DB_ON   = (g) => `boostmsg_enabled_${g}`;

function format(text, member, guild) {
  if (!text) return '';
  return String(text).replaceAll('{user}', member.toString()).replaceAll('{user:name}', member.user.username).replaceAll('{guild:name}', guild.name).replaceAll('{boost:count}', String(guild.premiumSubscriptionCount||0)).replaceAll('{boost:level}', String(guild.premiumTier||0));
}

async function handleBoostEvent(client, guild, member) {
  const guildId = guild.id;
  if (!db.get(DB_ON(guildId))) return;
  const chanId = db.get(DB_CHAN(guildId)); if (!chanId) return;
  const channel = guild.channels.cache.get(chanId); if (!channel?.isTextBased()) return;
  const style = db.get(DB_STYLE(guildId)) || 'text';
  try {
    if (style === 'embed') {
      const stored = db.get(DB_EMB(guildId));
      if (stored) { const ed = JSON.parse(JSON.stringify(stored)); if (ed.title) ed.title=format(ed.title,member,guild); if (ed.description) ed.description=format(ed.description,member,guild); if (ed.footer?.text) ed.footer.text=format(ed.footer.text,member,guild); await channel.send({ embeds: [new EmbedBuilder(ed)] }); }
      else await channel.send(defaultBoostText(member, guild));
    } else {
      const msg = db.get(DB_MSG(guildId));
      await channel.send(msg ? format(msg, member, guild) : defaultBoostText(member, guild));
    }
  } catch(e) { console.error('[boostmsg]', e); }
}

function defaultBoostText(member, guild) {
  return `💎 **${member.user.username}** vient de booster **${guild.name}** ! Niveau **${guild.premiumTier}** avec **${guild.premiumSubscriptionCount}** boost(s). Merci !`;
}

module.exports = {
  name: 'boostmsg',
  aliases: ['boostmessage', 'boostconfig'],
  description: 'Configure le message envoyé quand un membre booste le serveur',
  category: 'gestion',
  handleBoostEvent,
  run: async (client, message) => {
    let perm = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!perm) message.member.roles.cache.forEach(r => { if (db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
    if (!perm) return reply(message, errorContainer('Permission refusée.'));
    const guildId = message.guild.id;
    const buildC = () => {
      const chanId = db.get(DB_CHAN(guildId)), style = db.get(DB_STYLE(guildId))||'text', enabled = db.get(DB_ON(guildId)), hasContent = !!(db.get(DB_MSG(guildId))||db.get(DB_EMB(guildId)));
      return container(txt('## 💎 Configuration Message de Boost'), sep(), txt([`**Statut :** ${enabled ? '✅ Activé' : '❌ Désactivé'} | **Salon :** ${chanId ? `<#${chanId}>` : 'Non configuré'}`, `**Style :** ${style === 'embed' ? 'Embed' : 'Texte'} | **Contenu :** ${hasContent ? '✅ Configuré' : '❌ Non configuré'}`, '', '**Variables :** `{user}` `{user:name}` `{guild:name}` `{boost:count}` `{boost:level}`'].join('\n')));
    };
    const buildMenu = () => new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('bm_menu').setPlaceholder('Choisissez une option').addOptions([
      { label: db.get(DB_ON(guildId)) ? 'Désactiver' : 'Activer', value: 'toggle', emoji: '🔔' },
      { label: 'Modifier le salon', value: 'set_channel', emoji: '📢' },
      { label: 'Supprimer le salon', value: 'del_channel', emoji: '🗑️' },
      db.get(DB_STYLE(guildId)) === 'embed' ? { label: 'Passer en mode texte', value: 'style_text', emoji: '📝' } : { label: 'Passer en mode embed', value: 'style_embed', emoji: '✨' },
      db.get(DB_STYLE(guildId)) === 'embed' ? { label: "Modifier l'embed", value: 'edit_embed', emoji: '✏️' } : { label: 'Modifier le message', value: 'edit_text', emoji: '✏️' },
      { label: 'Supprimer le message', value: 'del_content', emoji: '🗑️' },
      { label: 'Tester', value: 'test', emoji: '▶️' }
    ]));
    const msg = await message.channel.send({ components: [buildC(), buildMenu(), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bm_refresh').setLabel('🔄 Actualiser').setStyle(ButtonStyle.Secondary))], flags: FLAGS });
    const refresh = () => msg.edit({ components: [buildC(), buildMenu(), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bm_refresh').setLabel('🔄 Actualiser').setStyle(ButtonStyle.Secondary))], flags: FLAGS }).catch(() => {});
    const ask = async (prompt) => { const q = await message.channel.send(prompt); try { const c = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 60000, errors: ['time'] }); const r = c.first(); q.delete().catch(()=>{}); r.delete().catch(()=>{}); return r.content; } catch { q.delete().catch(()=>{}); return null; } };
    const col = msg.createMessageComponentCollector({ time: 300000, filter: i => i.user.id === message.author.id });
    col.on('collect', async i => {
      if (i.isButton() && i.customId === 'bm_refresh') { await i.deferUpdate(); await refresh(); return; }
      if (i.isButton() && i.customId === 'bm_back') { await i.deferUpdate(); await refresh(); return; }
      if (i.customId === 'bm_chan_select') { await i.deferUpdate(); db.set(DB_CHAN(guildId), i.values[0]); await refresh(); return; }
      if (!i.isStringSelectMenu()) return;
      await i.deferUpdate();
      const val = i.values[0];
      if (val === 'toggle') { db.set(DB_ON(guildId), !db.get(DB_ON(guildId))); }
      else if (val === 'set_channel') { await msg.edit({ components: [container(txt('## 📢 Sélection Salon Boost')), new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('bm_chan_select').setPlaceholder('Sélectionner un salon').setChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bm_back').setLabel('↩ Retour').setStyle(ButtonStyle.Secondary))], flags: FLAGS }).catch(()=>{}); return; }
      else if (val === 'del_channel') { db.delete(DB_CHAN(guildId)); }
      else if (val === 'style_text') { db.set(DB_STYLE(guildId), 'text'); }
      else if (val === 'style_embed') { db.set(DB_STYLE(guildId), 'embed'); }
      else if (val === 'edit_text') { const t = await ask('📝 Quel message envoyer lors d\'un boost ?\nVariables: `{user}` `{user:name}` `{guild:name}` `{boost:count}` `{boost:level}`'); if (t) db.set(DB_MSG(guildId), t); }
      else if (val === 'edit_embed') { const title = await ask('✏️ Titre de l\'embed (ou `skip`) :'); if (title===null) { await refresh(); return; } const desc = await ask('✏️ Description :'); if (desc===null) { await refresh(); return; } db.set(DB_EMB(guildId), { title: title!=='skip'?title:undefined, description: desc, color: 0xf47fff, footer: { text: '{guild:name}' }, timestamp: new Date().toISOString() }); db.set(DB_STYLE(guildId), 'embed'); }
      else if (val === 'del_content') { db.delete(DB_MSG(guildId)); db.delete(DB_EMB(guildId)); }
      else if (val === 'test') { const chanId = db.get(DB_CHAN(guildId)); if (!chanId) { message.channel.send('❌ Aucun salon configuré.').then(m => setTimeout(()=>m.delete().catch(()=>{}), 3000)); } else { await handleBoostEvent(client, message.guild, message.member); message.channel.send(`✅ Test envoyé dans <#${chanId}>.`).then(m => setTimeout(()=>m.delete().catch(()=>{}), 3000)); } }
      await refresh();
    });
    col.on('end', () => msg.edit({ components: [buildC()], flags: FLAGS }).catch(() => {}));
  }
};
