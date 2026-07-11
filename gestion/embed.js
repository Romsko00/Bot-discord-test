const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonStyle, resolveColor } = require('discord.js');
const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'embed',
  aliases: ['embedbuilder', 'createembed'],
  description: "Créateur d'embed avancé",
  category: 'gestion',
  run: async (client, message) => {
    let hasPerm = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!hasPerm) message.member?.roles?.cache?.forEach(role => { if (db.get(`admin_${message.guild.id}_${role.id}`) || db.get(`ownerp_${message.guild.id}_${role.id}`)) hasPerm = true; });
    if (!hasPerm) return reply(message, errorContainer('Permission insuffisante.'));

    let embedData = { title: null, description: '📝 **Embed Builder** — Configurez votre embed', author: null, footer: null, thumbnail: null, image: null, url: null, color: 0x1a1a1a };
    const buildEmbed = () => { const e = new EmbedBuilder().setColor(embedData.color||0x1a1a1a); if (embedData.title) e.setTitle(embedData.title); if (embedData.description) e.setDescription(embedData.description); if (embedData.author) e.setAuthor(embedData.author); if (embedData.footer) e.setFooter(embedData.footer); if (embedData.thumbnail) e.setThumbnail(embedData.thumbnail); if (embedData.image) e.setImage(embedData.image); if (embedData.url) e.setURL(embedData.url); return e; };
    const isValidUrl = s => { try { new URL(s); return true; } catch { return false; } };

    const selectMenu = new StringSelectMenuBuilder().setCustomId('embed_menu_'+message.id).setPlaceholder('Sélectionnez une option...').addOptions([
      new StringSelectMenuOptionBuilder().setLabel('Copier un embed existant').setValue('copy_embed').setEmoji('📥'),
      new StringSelectMenuOptionBuilder().setLabel('Modifier le titre').setValue('edit_title').setEmoji('🖊️'),
      new StringSelectMenuOptionBuilder().setLabel('Supprimer le titre').setValue('delete_title').setEmoji('💥'),
      new StringSelectMenuOptionBuilder().setLabel('Modifier la description').setValue('edit_description').setEmoji('💬'),
      new StringSelectMenuOptionBuilder().setLabel('Supprimer la description').setValue('delete_description').setEmoji('📝'),
      new StringSelectMenuOptionBuilder().setLabel('Modifier le footer').setValue('edit_footer').setEmoji('🔻'),
      new StringSelectMenuOptionBuilder().setLabel('Supprimer le footer').setValue('delete_footer').setEmoji('🔺'),
      new StringSelectMenuOptionBuilder().setLabel('Modifier le thumbnail').setValue('edit_thumbnail').setEmoji('🔳'),
      new StringSelectMenuOptionBuilder().setLabel("Modifier l'image").setValue('edit_image').setEmoji('🖼️'),
      new StringSelectMenuOptionBuilder().setLabel('Modifier la couleur').setValue('edit_color').setEmoji('🎨'),
      new StringSelectMenuOptionBuilder().setLabel('Couleur par défaut').setValue('delete_color').setEmoji('🔵')
    ]);
    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('embed_validate_'+message.id).setLabel('✅ Envoyer').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('embed_edit_'+message.id).setLabel('✏️ Modifier msg').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('embed_refresh_'+message.id).setLabel('👁️ Aperçu').setStyle(ButtonStyle.Secondary)
    );
    const msg = await message.channel.send({ embeds: [buildEmbed()], components: [row1, row2] });
    setTimeout(() => msg.edit({ components: [] }).catch(()=>{}), 900000);
    const filter = m => m.author.id===message.author.id && m.channel.id===message.channel.id;
    const ask = async (question) => { const qMsg = await message.channel.send(question); try { const c = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] }); const r=c.first(); qMsg.delete().catch(()=>{}); r.delete().catch(()=>{}); return r.content; } catch { qMsg.delete().catch(()=>{}); return null; } };
    const notify = async (text, ok=true) => { const m = await message.channel.send({ embeds: [new EmbedBuilder().setColor(ok?0x57F287:0xED4245).setDescription(text)] }).catch(()=>null); if (m) setTimeout(()=>m.delete().catch(()=>{}), 3000); };

    const collector = msg.createMessageComponentCollector({ filter: i=>i.user.id===message.author.id, time: 900000 });
    collector.on('collect', async interaction => {
      try {
        await interaction.deferUpdate().catch(()=>{});
        if (interaction.isStringSelectMenu()) {
          const sel = interaction.values[0];
          if (sel==='copy_embed') { const ci=await ask('Mentionnez le salon ou son ID :'); if (!ci) return notify('Temps écoulé.',false); const chan=message.guild.channels.cache.get(ci.replace(/\D/g,''))||message.guild.channels.cache.find(c=>`<#${c.id}>`===ci); if (!chan) return notify('Salon introuvable.',false); const mi=await ask("ID du message à copier :"); if (!mi) return notify('Temps écoulé.',false); try { const target=await chan.messages.fetch(mi); if (!target.embeds.length) return notify('Pas d\'embed.',false); const src=target.embeds[0]; embedData={title:src.title||null,description:src.description||null,author:src.author?{name:src.author.name,iconURL:src.author.iconURL||undefined}:null,footer:src.footer?{text:src.footer.text,iconURL:src.footer.iconURL||undefined}:null,thumbnail:src.thumbnail?.url||null,image:src.image?.url||null,url:src.url||null,color:src.color||0x1a1a1a}; await msg.edit({ embeds: [buildEmbed()] }).catch(()=>{}); notify('Embed copié.'); } catch { notify('Message introuvable.',false); } }
          else if (sel==='edit_title') { const v=await ask('Nouveau titre (max 256 car.) :'); if (!v) return notify('Temps écoulé.',false); embedData.title=v.slice(0,256); await msg.edit({ embeds: [buildEmbed()] }).catch(()=>{}); }
          else if (sel==='delete_title') { embedData.title=null; await msg.edit({ embeds: [buildEmbed()] }).catch(()=>{}); }
          else if (sel==='edit_description') { const v=await ask('Nouvelle description (max 4096 car.) :'); if (!v) return notify('Temps écoulé.',false); embedData.description=v.slice(0,4096); await msg.edit({ embeds: [buildEmbed()] }).catch(()=>{}); }
          else if (sel==='delete_description') { embedData.description=null; await msg.edit({ embeds: [buildEmbed()] }).catch(()=>{}); }
          else if (sel==='edit_footer') { const t=await ask('Texte du footer :'); if (!t) return notify('Temps écoulé.',false); const fi=await ask("URL icône footer (ou `non`) :"); embedData.footer={text:t.slice(0,2048),iconURL:fi&&fi.toLowerCase()!=='non'&&isValidUrl(fi)?fi:undefined}; await msg.edit({ embeds: [buildEmbed()] }).catch(()=>{}); }
          else if (sel==='delete_footer') { embedData.footer=null; await msg.edit({ embeds: [buildEmbed()] }).catch(()=>{}); }
          else if (sel==='edit_thumbnail') { const u=await ask('URL du thumbnail :'); if (!u) return notify('Temps écoulé.',false); if (!isValidUrl(u)) return notify('URL invalide.',false); embedData.thumbnail=u; await msg.edit({ embeds: [buildEmbed()] }).catch(()=>{}); }
          else if (sel==='edit_image') { const u=await ask("URL de l'image principale :"); if (!u) return notify('Temps écoulé.',false); if (!isValidUrl(u)) return notify('URL invalide.',false); embedData.image=u; await msg.edit({ embeds: [buildEmbed()] }).catch(()=>{}); }
          else if (sel==='edit_color') { const c=await ask('Couleur hex (ex: `#FF0000`) :'); if (!c) return notify('Temps écoulé.',false); try { embedData.color=resolveColor(c); await msg.edit({ embeds: [buildEmbed()] }).catch(()=>{}); } catch { notify('Couleur invalide.',false); } }
          else if (sel==='delete_color') { embedData.color=0x1a1a1a; await msg.edit({ embeds: [buildEmbed()] }).catch(()=>{}); }
        } else if (interaction.isButton()) {
          const cid = interaction.customId;
          if (cid==='embed_refresh_'+message.id) { await msg.edit({ embeds: [buildEmbed()] }).catch(()=>{}); return; }
          if (cid==='embed_validate_'+message.id) {
            const ci=await ask('Salon où envoyer embed (mention ou ID) :'); if (!ci) return notify('Temps écoulé.',false);
            const chan=message.mentions.channels.first()||message.guild.channels.cache.get(ci.replace(/\D/g,''));
            if (!chan) return notify('Salon introuvable.',false);
            try { await chan.send({ embeds: [buildEmbed()] }); notify(`Embed envoyé dans ${chan}.`); } catch { notify("Impossible d'envoyer dans ce salon.",false); }
          }
          if (cid==='embed_edit_'+message.id) {
            const ci=await ask('Salon du message à modifier :'); if (!ci) return notify('Temps écoulé.',false);
            const chan=message.guild.channels.cache.get(ci.replace(/\D/g,''));
            if (!chan) return notify('Salon introuvable.',false);
            const mi=await ask("ID du message à modifier :"); if (!mi) return notify('Temps écoulé.',false);
            try { const target=await chan.messages.fetch(mi); await target.edit({ embeds: [buildEmbed()] }); notify('Message modifié.'); } catch { notify('Impossible de modifier.',false); }
          }
        }
      } catch {}
    });
    collector.on('end', () => msg.edit({ components: [] }).catch(()=>{}));
  }
};
