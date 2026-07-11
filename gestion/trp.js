const Discord = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'trp',
  aliases: ['statsdaily'],
  category: 'gestion',
  description: 'Configure un Webhook de statistiques dynamique mis à jour toutes les 30 minutes.',
  usage: 'setup <#salon> | off',

  run: async (client, message, args, prefix) => {
    let perm = false;
    message.member.roles.cache.forEach(r => { if (db.get(`modsp_${message.guild.id}_${r.id}`) || db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
    const canUse = perm || client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) || db.get(`channelpublic_${message.guild.id}_${message.channel.id}`);
    if (!canUse) return reply(message, errorContainer('**Permission refusée.**'));

    const sub = (args[0] || '').toLowerCase();
    if (sub === 'off') {
      db.delete(`trp_webhook_${message.guild.id}`);
      db.delete(`trp_message_${message.guild.id}`);
      db.delete(`trp_embed_${message.guild.id}`);
      return reply(message, container(txt('## ✅ TRP Désactivé'), sep(), txt('Webhook TRP désactivé. Supprimez le message manuellement si besoin.')));
    }
    if (sub !== 'setup') return reply(message, container(txt('## 📊 TRP — Aide'), sep(), txt([`\`${prefix}trp setup <#salon>\` — Configurer le webhook`, `\`${prefix}trp off\` — Désactiver`].join('\n'))));

    const targetChannel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
    if (!targetChannel?.isTextBased()) return reply(message, errorContainer('**Salon texte valide requis.**'));

    let customEmbed = new EmbedBuilder().setColor('#2F3136').setTitle('Statistiques du Serveur').setDescription('Nous sommes actuellement **{members}** membres, dont **{online}** connectés !');

    const options = [
      new StringSelectMenuOptionBuilder().setLabel('Modifier le titre').setValue('edit_title').setEmoji('🖊️'),
      new StringSelectMenuOptionBuilder().setLabel('Supprimer le titre').setValue('delete_title').setEmoji('💥'),
      new StringSelectMenuOptionBuilder().setLabel('Modifier la description').setValue('edit_description').setEmoji('💬'),
      new StringSelectMenuOptionBuilder().setLabel('Supprimer la description').setValue('delete_description').setEmoji('📝'),
      new StringSelectMenuOptionBuilder().setLabel('Modifier l\'auteur').setValue('edit_author').setEmoji('🕵️'),
      new StringSelectMenuOptionBuilder().setLabel('Supprimer l\'auteur').setValue('delete_author').setEmoji('✂️'),
      new StringSelectMenuOptionBuilder().setLabel('Modifier le footer').setValue('edit_footer').setEmoji('🔻'),
      new StringSelectMenuOptionBuilder().setLabel('Modifier le thumbnail').setValue('edit_thumbnail').setEmoji('🔳'),
      new StringSelectMenuOptionBuilder().setLabel('Modifier l\'image').setValue('edit_image').setEmoji('🖼️'),
      new StringSelectMenuOptionBuilder().setLabel('Modifier la couleur').setValue('edit_color').setEmoji('🎨')
    ];
    const selectMenu = new StringSelectMenuBuilder().setCustomId('trp_menu_' + message.id).setPlaceholder('Sélectionnez une option...').addOptions(options);
    const validateButton = new ButtonBuilder().setCustomId('trp_validate_' + message.id).setLabel('Valider & Créer Webhook').setStyle(Discord.ButtonStyle.Success);
    const refreshButton = new ButtonBuilder().setCustomId('trp_refresh_' + message.id).setLabel('Prévisualiser').setStyle(Discord.ButtonStyle.Secondary);
    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(validateButton, refreshButton);

    const infoText = `**📊 Configuration TRP** — Variables : \`{members}\` \`{online}\` \`{in_voice}\` \`{streaming}\` \`{boosts}\``;
    const msg = await message.channel.send({ content: infoText, embeds: [customEmbed], components: [row1, row2] });
    const msgFilter = m => m.author.id === message.author.id && m.channelId === message.channelId;

    function isValidUrl(s) { try { new URL(s); return true; } catch { return false; } }
    async function askText(question) {
      const qMsg = await message.channel.send(question);
      try {
        const resp = await message.channel.awaitMessages({ filter: msgFilter, max: 1, time: 60000, errors: ['time'] });
        await qMsg.delete().catch(() => {});
        const content = resp.first().content;
        await resp.first().delete().catch(() => {});
        return content;
      } catch { await qMsg.delete().catch(() => {}); return null; }
    }

    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 900000 });
    collector.on('collect', async interaction => {
      await interaction.deferUpdate();
      if (interaction.isStringSelectMenu()) {
        const sel = interaction.values[0];
        if (sel === 'edit_title') { const t = await askText('📝 Nouveau titre :'); if (t) customEmbed.setTitle(t); }
        else if (sel === 'delete_title') customEmbed.setTitle(null);
        else if (sel === 'edit_description') { const d = await askText('💬 Nouvelle description (utilisez les variables) :'); if (d) customEmbed.setDescription(d); }
        else if (sel === 'delete_description') customEmbed.setDescription(null);
        else if (sel === 'edit_author') {
          const name = await askText('🕵️ Nom de l\'auteur :');
          if (name) { const icon = await askText('🖼️ URL icône (ou `non`) :'); customEmbed.setAuthor({ name, iconURL: (icon && icon !== 'non' && isValidUrl(icon)) ? icon : undefined }); }
        }
        else if (sel === 'delete_author') customEmbed.setAuthor(null);
        else if (sel === 'edit_footer') {
          const t = await askText('🔻 Texte du footer :');
          if (t) { const icon = await askText('🖼️ URL icône footer (ou `non`) :'); customEmbed.setFooter({ text: t, iconURL: (icon && icon !== 'non' && isValidUrl(icon)) ? icon : undefined }); }
        }
        else if (sel === 'edit_thumbnail') { const u = await askText('🔳 URL thumbnail :'); if (u && isValidUrl(u)) customEmbed.setThumbnail(u); }
        else if (sel === 'edit_image') { const u = await askText('🖼️ URL image :'); if (u && isValidUrl(u)) customEmbed.setImage(u); }
        else if (sel === 'edit_color') {
          const c = await askText('🎨 Couleur hex (ex: #FF0000) :');
          if (c) { try { customEmbed.setColor(Discord.resolveColor(c)); } catch {} }
        }
        await msg.edit({ embeds: [customEmbed] }).catch(() => {});
      } else if (interaction.isButton()) {
        if (interaction.customId === 'trp_refresh_' + message.id) { await msg.edit({ embeds: [customEmbed] }).catch(() => {}); }
        else if (interaction.customId === 'trp_validate_' + message.id) {
          collector.stop('valid');
          await msg.edit({ content: '⏳ Création du Webhook TRP en cours...', embeds: [], components: [] }).catch(() => {});
          try {
            const rawEmbedJSON = customEmbed.toJSON();
            let liveEmbed = rawEmbedJSON;
            try { const { applyStatsToEmbedJSON } = require('../../util/gestion/trpScheduler'); liveEmbed = await applyStatsToEmbedJSON(message.guild, rawEmbedJSON); } catch {}
            const webhook = await targetChannel.createWebhook({ name: 'VNS TRP Stats', avatar: client.user.displayAvatarURL() });
            const sentMsg = await webhook.send({ embeds: [liveEmbed] });
            db.set(`trp_webhook_${message.guild.id}`, { id: webhook.id, token: webhook.token, channelId: targetChannel.id });
            db.set(`trp_message_${message.guild.id}`, sentMsg.id);
            db.set(`trp_embed_${message.guild.id}`, rawEmbedJSON);
            await msg.edit({ content: `✅ Webhook TRP configuré dans ${targetChannel} ! Mise à jour automatique toutes les 30 minutes.` }).catch(() => {});
          } catch (err) { console.error('[trp webhook]', err); await msg.edit({ content: '❌ Erreur lors de la création du webhook.' }).catch(() => {}); }
        }
      }
    });
    collector.on('end', (_, reason) => { if (reason === 'time') msg.edit({ components: [] }).catch(() => {}); });
  }
};
