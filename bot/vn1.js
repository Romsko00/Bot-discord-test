const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { reply, errorContainer, container, txt, sep, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

const VALID_BUTTON_STYLES = ['primary', 'secondary', 'success', 'danger', 'link'];
const VALID_COLORS = [/^#[0-9A-Fa-f]{6}$/];
const VALID_IMAGE_URL = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i;
const EMBED_LIMITS = { title: 256, description: 4096, footerText: 2048, fieldName: 256, fieldValue: 1024 };

function truncate(str, max) { return str && str.length > max ? str.slice(0, max - 1) + '…' : str; }
function isValidColor(c) { return VALID_COLORS.some(r => r.test(c)); }
function isValidImageUrl(u) { return VALID_IMAGE_URL.test(u); }
function genId(prefix = 'vn1') { return `${prefix}_${Math.random().toString(36).slice(2, 10)}`; }

function createEmbedFromConfig(cfg) {
  const embed = new EmbedBuilder().setColor(cfg.color || '#00bfff');
  if (cfg.title) embed.setTitle(cfg.title);
  if (cfg.description) embed.setDescription(cfg.description);
  if (cfg.image) embed.setImage(cfg.image);
  if (cfg.thumbnail) embed.setThumbnail(cfg.thumbnail);
  if (cfg.footerText) embed.setFooter({ text: cfg.footerText, iconURL: cfg.footerIcon || undefined });
  if (cfg.timestamp) embed.setTimestamp();
  if (cfg.fields?.length) embed.addFields(cfg.fields);
  return embed;
}

function createButtonsFromConfig(btnsConfig, disabled = false) {
  const rows = [];
  for (let i = 0; i < btnsConfig.length; i += 5) {
    const btns = btnsConfig.slice(i, i + 5).map(btn => {
      const isLink = btn.style === 'link';
      const button = new ButtonBuilder().setDisabled(disabled);
      const rawLabel = typeof btn.label === 'string' ? btn.label.trim() : '';
      if (rawLabel) button.setLabel(rawLabel);
      if (btn.emoji) button.setEmoji(btn.emoji);
      if (isLink) { button.setStyle(ButtonStyle.Link).setURL(btn.actionData?.url || 'https://discord.com'); }
      else { const sk = btn.style?.charAt(0).toUpperCase() + btn.style?.slice(1); button.setCustomId(btn.customid || genId('btn')).setStyle(ButtonStyle[sk] || ButtonStyle.Primary); }
      return button;
    });
    rows.push(new ActionRowBuilder().addComponents(...btns));
  }
  return rows;
}

module.exports = {
  name: 'vn1',
  description: 'Configuration de menu VN1 interactif',
  category: 'bot',
  level: 4,
  run: async function(client, message) {
    if (!message.guild) return reply(message, errorContainer('Commande utilisable uniquement dans un serveur.'));
    if (!hasPermissionLevel(client, message, 4)) return reply(message, errorContainer('**Permission insuffisante** — Niveau 4 requis.'));

    let embedConfig = { title: null, description: null, color: '#00bfff', image: null, thumbnail: null, footerText: null, footerIcon: null, timestamp: false, fields: [] };
    let buttons = [], savedButtons = {};
    const filter = i => i.user.id === message.author.id;

    const menuOptions = [
      new StringSelectMenuOptionBuilder().setLabel('Embed').setDescription('Configurer l\'embed principal').setValue('embed').setEmoji('📝'),
      new StringSelectMenuOptionBuilder().setLabel('Bouton').setDescription('Ajouter un bouton').setValue('button').setEmoji('🔘'),
      new StringSelectMenuOptionBuilder().setLabel('Gérer les boutons').setDescription('Modifier/supprimer les boutons').setValue('manage_buttons').setEmoji('⚙️'),
      new StringSelectMenuOptionBuilder().setLabel('Gérer les champs').setDescription('Ajouter/supprimer des champs').setValue('manage_fields').setEmoji('📋'),
      new StringSelectMenuOptionBuilder().setLabel('JSON').setDescription('Exporter/importer la configuration').setValue('json').setEmoji('📦'),
      new StringSelectMenuOptionBuilder().setLabel('Aperçu').setDescription('Voir un aperçu du menu').setValue('preview').setEmoji('🔍'),
      new StringSelectMenuOptionBuilder().setLabel('Terminer').setDescription('Finaliser et envoyer le menu').setValue('finish').setEmoji('✅'),
    ];

    const selectMenu = new StringSelectMenuBuilder().setCustomId('vn1_config_menu').setPlaceholder('Que voulez-vous configurer ?').addOptions(menuOptions);
    const configMsg = await message.channel.send({ components: [container(txt('## 🔧 Configuration VN1'), sep(), txt('Utilisez le menu ci-dessous pour configurer votre menu interactif.')), new ActionRowBuilder().addComponents(selectMenu)], flags: FLAGS });

    const vn1Collector = configMsg.createMessageComponentCollector({ filter, time: 600000 });

    vn1Collector.on('collect', async interaction => {
      try {
        if (!interaction.isStringSelectMenu?.() || interaction.customId !== 'vn1_config_menu') { try { await interaction.deferUpdate(); } catch {} return; }
        const selected = interaction.values?.[0];
        try { await interaction.deferUpdate(); } catch {}

        const ask = async (prompt) => {
          try {
            await interaction.followUp({ content: prompt, ephemeral: true });
            const col = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 60000 });
            if (!col.size) return null;
            const resp = col.first(); const content = resp.content;
            resp.delete().catch(() => {}); return content;
          } catch { return null; }
        };

        switch (selected) {
          case 'embed': {
            const title = await ask('Titre de l\'embed ?'); if (title !== null) embedConfig.title = title.trim() ? truncate(title.trim(), EMBED_LIMITS.title) : null;
            const desc = await ask('Description ?'); if (desc !== null) embedConfig.description = desc.trim() ? truncate(desc.trim(), EMBED_LIMITS.description) : null;
            const col = await ask('Couleur (#HEX) ?'); if (col && isValidColor(col.trim())) embedConfig.color = col.trim();
            const img = await ask('Image (URL, vide = ignorer) ?'); embedConfig.image = img && isValidImageUrl(img.trim()) ? img.trim() : null;
            const footer = await ask('Footer ?'); if (footer !== null) embedConfig.footerText = footer.trim() ? truncate(footer.trim(), EMBED_LIMITS.footerText) : null;
            await interaction.followUp({ content: '✅ Embed configuré.', ephemeral: true });
            break;
          }
          case 'button': {
            if (buttons.length >= 25) { await interaction.followUp({ content: '❌ Limite 25 boutons atteinte.', ephemeral: true }); break; }
            const label = (await ask('Texte du bouton ?'))?.trim().slice(0, 80) || '';
            const styleRaw = await ask('Style ? (primary, secondary, success, danger, link)');
            let style = styleRaw?.toLowerCase() || 'primary';
            if (!VALID_BUTTON_STYLES.includes(style)) style = 'primary';
            const emoji = (await ask('Emoji ? (vide = aucun)'))?.trim() || null;
            const actionTypeRaw = await ask('Action ? (message, link, role)');
            const actionType = actionTypeRaw?.toLowerCase() || 'message';
            let actionData = {};
            if (actionType === 'link') { const url = await ask('URL ?'); actionData.url = url?.trim() || 'https://discord.com'; style = 'link'; }
            else if (actionType === 'role') { const ri = await ask('ID ou mention du rôle ?'); const role = message.guild.roles.cache.find(r => `<@&${r.id}>` === ri || r.id === ri || r.name.toLowerCase() === ri?.toLowerCase()); if (!role) { await interaction.followUp({ content: '❌ Rôle introuvable.', ephemeral: true }); break; } actionData.roleId = role.id; }
            else { actionData.text = (await ask('Texte du message ?')) || 'Action !'; actionData.ephemeral = (await ask('Éphémère ? (oui/non)'))?.toLowerCase() === 'oui'; }
            const customId = genId('btn'); const newBtn = { customid: customId, label, style, emoji, actionType, actionData };
            buttons.push(newBtn);
            if (!client.vn1Buttons) client.vn1Buttons = new Map();
            client.vn1Buttons.set(customId, newBtn);
            await interaction.followUp({ content: `✅ Bouton ajouté.`, ephemeral: true });
            break;
          }
          case 'manage_buttons': {
            if (!buttons.length) { await interaction.followUp({ content: 'Aucun bouton à gérer.', ephemeral: true }); break; }
            const btnOpts = buttons.map((b, i) => ({ label: `${i + 1}. ${(b.label || 'Bouton').substring(0, 90)}`, value: String(i), emoji: '🔘' }));
            const bmMsg = await interaction.followUp({ content: 'Quel bouton gérer ?', components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('vn1_btn_manage').setPlaceholder('Sélectionnez un bouton').addOptions(btnOpts))], ephemeral: true });
            const bmInt = await bmMsg.awaitMessageComponent({ filter, time: 60000 }).catch(() => null);
            if (!bmInt) break;
            await bmInt.deferUpdate();
            const idx = parseInt(bmInt.values[0]);
            const actMsg = await interaction.followUp({ content: 'Que faire ?', components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('vn1_btn_action').setPlaceholder('Action').addOptions([{ label: 'Supprimer', value: 'delete', emoji: '🗑️' }, { label: 'Dupliquer', value: 'duplicate', emoji: '📋' }]))], ephemeral: true });
            const actInt = await actMsg.awaitMessageComponent({ filter, time: 60000 }).catch(() => null);
            if (!actInt) break;
            await actInt.deferUpdate();
            if (actInt.values[0] === 'delete') { buttons.splice(idx, 1); await interaction.followUp({ content: '✅ Bouton supprimé.', ephemeral: true }); }
            else if (actInt.values[0] === 'duplicate') { if (buttons.length >= 25) { await interaction.followUp({ content: '❌ Limite 25 boutons.', ephemeral: true }); break; } buttons.push({ ...buttons[idx], customid: genId('btn') }); await interaction.followUp({ content: '✅ Bouton dupliqué.', ephemeral: true }); }
            break;
          }
          case 'manage_fields': {
            const fa = await ask('Ajouter ou supprimer un champ ? (ajouter/supprimer)'); if (!fa) break;
            if (fa.toLowerCase() === 'ajouter') {
              if (embedConfig.fields.length >= 25) { await interaction.followUp({ content: '❌ Limite 25 champs.', ephemeral: true }); break; }
              const fname = await ask('Nom du champ ?'); const fval = await ask('Valeur du champ ?'); const finl = await ask('Inline ? (oui/non)');
              embedConfig.fields.push({ name: truncate(fname || 'Champ', EMBED_LIMITS.fieldName), value: truncate(fval || 'Valeur', EMBED_LIMITS.fieldValue), inline: finl?.toLowerCase() === 'oui' });
              await interaction.followUp({ content: '✅ Champ ajouté.', ephemeral: true });
            } else if (fa.toLowerCase() === 'supprimer') {
              if (!embedConfig.fields.length) { await interaction.followUp({ content: 'Aucun champ.', ephemeral: true }); break; }
              const fOpts = embedConfig.fields.map((f, i) => ({ label: `${i + 1}. ${f.name.substring(0, 90)}`, value: String(i), emoji: '📋' }));
              const fMsg = await interaction.followUp({ content: 'Quel champ supprimer ?', components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('vn1_field_delete').setPlaceholder('Champ à supprimer').addOptions(fOpts))], ephemeral: true });
              const fInt = await fMsg.awaitMessageComponent({ filter, time: 60000 }).catch(() => null);
              if (fInt) { await fInt.deferUpdate(); embedConfig.fields.splice(parseInt(fInt.values[0]), 1); await interaction.followUp({ content: '✅ Champ supprimé.', ephemeral: true }); }
            }
            break;
          }
          case 'json': {
            const mode = await ask('Export ou import ? (export/import)'); if (!mode) break;
            if (mode.toLowerCase() === 'export') {
              const raw = JSON.stringify({ embed: embedConfig, buttons }, null, 2);
              if (raw.length < 1700) await interaction.followUp({ content: '```json\n' + raw + '\n```', ephemeral: true });
              else { const buf = Buffer.from(raw, 'utf8'); await interaction.followUp({ files: [{ attachment: buf, name: 'vn1_config.json' }], ephemeral: true }); }
            } else if (mode.toLowerCase() === 'import') {
              const jsonRaw = await ask('Collez le JSON à importer.');
              if (jsonRaw) { try { const imp = JSON.parse(jsonRaw); if (imp.embed) embedConfig = imp.embed; if (imp.buttons) buttons = imp.buttons; await interaction.followUp({ content: '✅ Configuration importée.', ephemeral: true }); } catch { await interaction.followUp({ content: '❌ JSON invalide.', ephemeral: true }); } }
            }
            break;
          }
          case 'preview': {
            await interaction.followUp({ content: 'Aperçu :', embeds: [createEmbedFromConfig(embedConfig)], components: createButtonsFromConfig(buttons, true), ephemeral: true });
            break;
          }
          case 'finish': {
            vn1Collector.stop();
            const chanRaw = await ask('Dans quel salon envoyer le menu ? (mention ou ID)');
            const chan = message.guild.channels.cache.find(c => `<#${c.id}>` === chanRaw || c.id === chanRaw);
            if (!chan?.isTextBased()) { await interaction.followUp({ content: '❌ Salon invalide.', ephemeral: true }); return; }
            const comps = createButtonsFromConfig(buttons);
            const newMsg = await chan.send({ embeds: [createEmbedFromConfig(embedConfig)], components: comps }).catch(() => null);
            if (newMsg) {
              db.set(`vn1_buttons_${newMsg.id}`, { guildId: newMsg.guild.id, channelId: newMsg.channel.id, messageId: newMsg.id, buttons });
              for (const b of buttons) { if (b.customid) { if (!client.vn1Buttons) client.vn1Buttons = new Map(); client.vn1Buttons.set(b.customid, Object.assign({}, b, { messageId: newMsg.id, guildId: newMsg.guild.id })); } }
              await interaction.followUp({ content: `✅ Menu envoyé dans ${chan}.`, ephemeral: true });
            } else { await interaction.followUp({ content: '❌ Impossible d\'envoyer le message.', ephemeral: true }); }
            break;
          }
        }
      } catch (e) { console.error('[vn1]', e); try { await interaction.followUp({ content: '❌ Annulé ou expiré.', ephemeral: true }); } catch {} }
    });

    vn1Collector.on('end', () => configMsg.edit({ components: [] }).catch(() => {}));
  }
};
