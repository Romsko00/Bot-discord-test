const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../../utils/simpledb');
const EMOJIS = require('../../utils/emojis');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

function formatTemplate(text, member, inviter = null, inviteCount = 0) {
  if (!member?.user || !member?.guild) return text;
  const invName = inviter ? inviter.username : 'Inconnu';
  const invTag  = inviter ? (inviter.tag || `${inviter.username}#0000`) : 'Inconnu';
  const invId   = inviter ? inviter.id : 'Inconnu';
  return String(text).replaceAll('{user}',member.user.toString()).replaceAll('{user:name}',member.user.username).replaceAll('{user:tag}',member.user.tag).replaceAll('{user:id}',member.user.id).replaceAll('{inviter}',inviter?inviter.toString():'Inconnu').replaceAll('{inviter:name}',invName).replaceAll('{inviter:tag}',invTag).replaceAll('{inviter:id}',invId).replaceAll('{invite}',String(inviteCount)).replaceAll('{invites}',String(inviteCount)).replaceAll('{membre:counter}',String(member.guild.memberCount)).replaceAll('{guild:name}',member.guild.name).replaceAll('{guild:member}',String(member.guild.memberCount)).replaceAll('{guild:members}',String(member.guild.memberCount));
}

module.exports = {
  name: 'invite',
  aliases: ['ivt'],
  description: 'Configure le système de suivi des invitations',
  category: 'gestion',
  run: async (client, message) => {
    let perm = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!perm) message.member.roles.cache.forEach(r => { if (db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
    if (!perm) return reply(message, errorContainer("Vous n'avez pas les permissions nécessaires."));

    const guildId = message.guild.id;

    function buildContent() {
      const isEmbedStyle = db.get(`invitestyle_${guildId}`) === 'embed';
      const chanId = db.get(`invitechannelmessage_${guildId}`);
      const inviteMsg = db.get(`invitemessage_${guildId}`);
      const inviteEmbed = db.get(`invitemessageembed_${guildId}`);
      const trackingOn = db.get(`invitetracking_${guildId}`) === true;
      const lines = [
        `**Salon d'invitations:** ${chanId ? `<#${chanId}>` : `${EMOJIS.ERROR} Non configuré`}`,
        `**${isEmbedStyle ? "Embed" : "Message"} d'invitation:** ${inviteMsg ? inviteMsg.slice(0,80) : inviteEmbed ? (isEmbedStyle ? `${EMOJIS.SUCCESS} Configuré` : 'Embed défini') : `${EMOJIS.ERROR} Non configuré`}`,
        `**Style:** ${isEmbedStyle ? 'Embed' : 'Message texte'}`,
        `**Système activé:** ${trackingOn ? `${EMOJIS.SUCCESS} Oui` : `${EMOJIS.ERROR} Non`}`
      ];
      return container(txt('## 📨 Configuration Invitations'), sep(), txt(lines.join('\n')));
    }

    function buildMenu() {
      const isEmbedStyle = db.get(`invitestyle_${guildId}`) === 'embed';
      const opts = isEmbedStyle ? [
        { label: 'Style Message', value: 'style_message', emoji: '📑' },
        { label: "Modifier le salon d'invitations", value: 'modify_channel', emoji: '🏷️' },
        { label: "Supprimer le salon d'invitations", value: 'delete_channel', emoji: '🗑️' },
        { label: "Modifier l'embed d'invitation", value: 'modify_embed', emoji: '📩' },
        { label: "Supprimer l'embed d'invitation", value: 'delete_embed', emoji: '✉️' },
        { label: 'Activer le système', value: 'enable_tracking', emoji: '✅' },
        { label: 'Désactiver le système', value: 'disable_tracking', emoji: '❌' },
        { label: "Tester le système d'invitations", value: 'test_invite', emoji: '🧪' }
      ] : [
        { label: 'Style Embed', value: 'style_embed', emoji: '📑' },
        { label: "Modifier le salon d'invitations", value: 'modify_channel', emoji: '🏷️' },
        { label: "Supprimer le salon d'invitations", value: 'delete_channel', emoji: '🗑️' },
        { label: "Modifier le message d'invitation", value: 'modify_message', emoji: '📩' },
        { label: "Supprimer le message d'invitation", value: 'delete_message', emoji: '✉️' },
        { label: 'Activer le système', value: 'enable_tracking', emoji: '✅' },
        { label: 'Désactiver le système', value: 'disable_tracking', emoji: '❌' },
        { label: "Tester le système d'invitations", value: 'test_invite', emoji: '🧪' }
      ];
      return new StringSelectMenuBuilder().setCustomId('invite_menu').setPlaceholder('Faites un choix').addOptions(opts.map(o => new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value).setEmoji(o.emoji)));
    }

    function buildButtonRow() {
      const isEmbedStyle = db.get(`invitestyle_${guildId}`) === 'embed';
      const btns = [];
      if (isEmbedStyle) btns.push(new ButtonBuilder().setCustomId('view_embed').setLabel("Voir l'embed").setEmoji('📝').setStyle(ButtonStyle.Secondary));
      btns.push(new ButtonBuilder().setCustomId('refresh').setLabel('Rafraîchir').setEmoji('🔄').setStyle(ButtonStyle.Secondary));
      return new ActionRowBuilder().addComponents(btns);
    }

    const initialMessage = await message.channel.send({ components: [buildContent(), new ActionRowBuilder().addComponents(buildMenu()), buildButtonRow()], flags: FLAGS });
    const refresh = () => initialMessage.edit({ components: [buildContent(), new ActionRowBuilder().addComponents(buildMenu()), buildButtonRow()], flags: FLAGS }).catch(()=>{});

    const ask = async (prompt) => {
      const q = await message.channel.send(prompt);
      try { const col = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 60000, errors: ['time'] }); const resp = col.first(); await q.delete().catch(()=>{}); await resp.delete().catch(()=>{}); return resp.content; }
      catch { await q.delete().catch(()=>{}); return null; }
    };

    const collector = initialMessage.createMessageComponentCollector({ time: 300000 });
    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== message.author.id) return interaction.reply({ content: 'Vous ne pouvez pas interagir avec ce menu.', ephemeral: true });
      await interaction.deferUpdate();

      if (interaction.isButton()) {
        if (interaction.customId === 'view_embed') {
          const stored = db.get(`invitemessageembed_${guildId}`);
          if (stored) message.channel.send({ embeds: [stored] }).then(m => setTimeout(() => m.delete().catch(()=>{}), 10000));
          else message.channel.send("Aucun embed d'invitation défini.").then(m => setTimeout(() => m.delete().catch(()=>{}), 3000));
        }
        if (interaction.customId === 'refresh') await refresh();
        return;
      }

      if (!interaction.isStringSelectMenu()) return;
      const sel = interaction.values[0];

      if (sel === 'style_embed') { db.set(`invitestyle_${guildId}`, 'embed'); await refresh(); return; }
      if (sel === 'style_message') { db.set(`invitestyle_${guildId}`, 'message'); await refresh(); return; }
      if (sel === 'delete_embed') { db.set(`invitemessageembed_${guildId}`, null); await refresh(); return; }
      if (sel === 'delete_message') { db.delete(`invitemessage_${guildId}`); await refresh(); return; }
      if (sel === 'delete_channel') { db.delete(`invitechannelmessage_${guildId}`); await refresh(); return; }
      if (sel === 'enable_tracking') { db.set(`invitetracking_${guildId}`, true); await refresh(); return; }
      if (sel === 'disable_tracking') { db.set(`invitetracking_${guildId}`, false); await refresh(); return; }

      if (sel === 'modify_message') {
        const text = await ask('```\n--- Variables ---\n{user} {user:name} {inviter} {inviter:name} {invites} {membre:counter} {guild:name}\n```\nQuel est le nouveau message d\'invitation ?');
        if (text) { db.set(`invitemessageembed_${guildId}`, null); db.set(`invitemessage_${guildId}`, text); }
        await refresh(); return;
      }

      if (sel === 'modify_channel') {
        const text = await ask("Mentionnez ou envoyez l'ID du salon d'invitations :");
        if (!text) { await refresh(); return; }
        const ch = message.guild.channels.cache.find(c => `<#${c.id}>` === text) || message.guild.channels.cache.get(text);
        if (ch) db.set(`invitechannelmessage_${guildId}`, ch.id);
        await refresh(); return;
      }

      if (sel === 'modify_embed') {
        db.set(`invitemessage_${guildId}`, null);
        await embedEditor(initialMessage, ask);
        return;
      }

      if (sel === 'test_invite') {
        const testMember = { user: { id: '123456789', username: 'UtilisateurTest', tag: 'UtilisateurTest#1234', toString: () => '<@123456789>' }, guild: message.guild };
        const testInviter = { id: '987654321', username: 'InviterTest', tag: 'InviterTest#5678', toString: () => '<@987654321>' };
        const inviteMsg = db.get(`invitemessage_${guildId}`);
        const inviteEmbed = db.get(`invitemessageembed_${guildId}`);
        const chanId = db.get(`invitechannelmessage_${guildId}`);
        const trackingOn = db.get(`invitetracking_${guildId}`) === true;
        const style = db.get(`invitestyle_${guildId}`) || (inviteEmbed ? 'embed' : 'message');
        const infoLines = [`**Style:** ${style==='embed'?'Embed':'Message texte'}`, `**Salon:** ${chanId?`<#${chanId}>`:'Non configuré'}`, `**Suivi:** ${trackingOn?`${EMOJIS.SUCCESS} Activé`:`${EMOJIS.ERROR} Désactivé`}`];
        if (style === 'embed' && inviteEmbed) {
          try { const payload = JSON.parse(JSON.stringify(inviteEmbed)); if (payload.description) payload.description = formatTemplate(payload.description, testMember, testInviter, 5); if (payload.title) payload.title = formatTemplate(payload.title, testMember, testInviter, 5); if (payload.footer?.text) payload.footer.text = formatTemplate(payload.footer.text, testMember, testInviter, 5); message.channel.send({ components: [container(txt('## 🧪 Test Invitations'), sep(), txt(infoLines.join('\n')+`\n${EMOJIS.SUCCESS} Embed configuré — sera envoyé lors d'une vraie arrivée.`))], flags: FLAGS }).catch(()=>{}); }
          catch { message.channel.send({ components: [container(txt('## 🧪 Test Invitations'), sep(), txt(infoLines.join('\n')+`\n${EMOJIS.ERROR} Erreur embed.`))], flags: FLAGS }).catch(()=>{}); }
        } else if (inviteMsg) {
          const toSend = formatTemplate(inviteMsg, testMember, testInviter, 5);
          message.channel.send({ components: [container(txt('## 🧪 Test Invitations'), sep(), txt(infoLines.join('\n')+`\n${EMOJIS.SUCCESS} Message: ${toSend.slice(0,200)}`))], flags: FLAGS }).catch(()=>{});
        } else {
          message.channel.send({ components: [container(txt('## 🧪 Test Invitations'), sep(), txt(infoLines.join('\n')+`\n${EMOJIS.WARNING} Aucun contenu configuré.`))], flags: FLAGS }).catch(()=>{});
        }
        return;
      }

      await refresh();
    });

    collector.on('end', () => initialMessage.edit({ components: [buildContent()], flags: FLAGS }).catch(()=>{}));

    async function embedEditor(m, ask) {
      let embedbase = new EmbedBuilder().setDescription('** **').setColor(0x1a1a1a);
      const row1 = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('embed_menu').setPlaceholder('Faites un choix').addOptions([
        { label: 'Modifier le titre', value: 'modify_title', emoji: '🖊️' }, { label: 'Supprimer le titre', value: 'delete_title', emoji: '💥' },
        { label: 'Modifier la description', value: 'modify_description', emoji: '💬' }, { label: 'Supprimer la description', value: 'delete_description', emoji: '📝' },
        { label: "Modifier l'auteur", value: 'modify_author', emoji: '🕵️' }, { label: "Supprimer l'auteur", value: 'delete_author', emoji: '✂️' },
        { label: 'Modifier le footer', value: 'modify_footer', emoji: '🔻' }, { label: 'Supprimer le footer', value: 'delete_footer', emoji: '🔺' },
        { label: 'Modifier le thumbnail', value: 'modify_thumbnail', emoji: '🔳' }, { label: "Modifier l'image", value: 'modify_image', emoji: '🖼️' },
        { label: "Modifier l'url du titre", value: 'modify_url', emoji: '🌐' }, { label: 'Modifier la couleur', value: 'modify_color', emoji: '🎨' }, { label: 'Supprimer la couleur', value: 'delete_color', emoji: '🔵' }
      ].map(o => new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value).setEmoji(o.emoji))));
      const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('validate_embed').setEmoji('✅').setLabel('Valider').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('cancel_embed').setEmoji('❌').setLabel('Annuler').setStyle(ButtonStyle.Danger));
      const infoText = '```\n--- Variables ---\n{user} {user:name} {inviter} {inviter:name} {invites} {guild:name}\n```';
      const embedMsg = await message.channel.send({ content: infoText, embeds: [embedbase], components: [row1, row2] });
      const embedCol = embedMsg.createMessageComponentCollector({ time: 300000 });
      embedCol.on('collect', async (interaction) => {
        if (interaction.user.id !== message.author.id) return interaction.reply({ content: 'Accès refusé.', ephemeral: true });
        await interaction.deferUpdate();
        if (interaction.isStringSelectMenu()) {
          const askField = async (q) => { const qMsg = await message.channel.send(q); try { const col = await message.channel.awaitMessages({ filter: x => x.author.id === message.author.id, max: 1, time: 60000, errors: ['time'] }); const resp = col.first(); await qMsg.delete().catch(()=>{}); await resp.delete().catch(()=>{}); return resp.content; } catch { await qMsg.delete().catch(()=>{}); return null; } };
          switch (interaction.values[0]) {
            case 'modify_title': { const v=await askField('Titre ?'); if (v) embedbase.setTitle(v); break; }
            case 'delete_title': embedbase.setTitle(null); break;
            case 'modify_description': { const v=await askField('Description ?'); if (v) embedbase.setDescription(v); break; }
            case 'delete_description': embedbase.setDescription('** **'); break;
            case 'modify_author': { const v=await askField('Nom auteur ?'); if (v) embedbase.setAuthor({name:v}); break; }
            case 'delete_author': embedbase.setAuthor(null); break;
            case 'modify_footer': { const v=await askField('Texte footer ?'); if (v) embedbase.setFooter({text:v}); break; }
            case 'delete_footer': embedbase.setFooter(null); break;
            case 'modify_thumbnail': { const v=await askField('URL thumbnail ?'); if (v) embedbase.setThumbnail(v); break; }
            case 'modify_image': { const v=await askField('URL image ?'); if (v) embedbase.setImage(v); break; }
            case 'modify_url': { const v=await askField('URL du titre ?'); if (v) embedbase.setURL(v); break; }
            case 'modify_color': { const v=await askField('Couleur (#RRGGBB) ?'); if (v) { try { embedbase.setColor(v); } catch {} } break; }
            case 'delete_color': { try { embedbase.setColor(0x1a1a1a); } catch {} break; }
          }
          await embedMsg.edit({ embeds: [embedbase] });
        }
        if (interaction.isButton()) {
          if (interaction.customId === 'validate_embed') { db.set(`invitemessageembed_${guildId}`, typeof embedbase.toJSON==='function'?embedbase.toJSON():(embedbase.data||embedbase)); await embedMsg.delete().catch(()=>{}); await refresh(); embedCol.stop(); }
          else if (interaction.customId === 'cancel_embed') { await embedMsg.delete().catch(()=>{}); embedCol.stop(); }
        }
      });
      embedCol.on('end', () => embedMsg.edit({ components: [] }).catch(()=>{}));
    }
  }
};
