const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');
const SM = require('../../utils/styleManager');
const { hasPermissionLevel } = require('../../utils/permissionUtils');

function parseHex(str) { const c = str.replace(/^#/, '').trim(); if (!/^[0-9a-fA-F]{6}$/.test(c)) return null; return parseInt(c, 16); }
function hexStr(num) { return '#' + num.toString(16).padStart(6, '0').toUpperCase(); }

function buildPreviewContainer(guildId) {
  const s = SM.getStyle(guildId);
  const name = SM.THEMES[s._themeName]?.name || s._themeName;
  const customData = db.get(`style_custom_${guildId}`) || {};
  const hasCustom = Object.keys(customData).length > 0;
  return container(
    txt(`## 🎨 Style Actuel — ${name}${hasCustom ? ' *(personnalisé)*' : ''}`),
    sep(),
    txt([
      '**🎨 Couleurs :**',
      `Principale : \`${hexStr(s.colors.primary)}\` · Succès : \`${hexStr(s.colors.success)}\` · Erreur : \`${hexStr(s.colors.error)}\` · Warning : \`${hexStr(s.colors.warning)}\` · Info : \`${hexStr(s.colors.info)}\``,
      '',
      '**🔘 Boutons :**',
      `Principal : ${s.buttonStyles.primary} · Secondaire : ${s.buttonStyles.secondary} · Succès : ${s.buttonStyles.success} · Danger : ${s.buttonStyles.danger}`,
      '',
      '**✏️ Format :**',
      `Titres : ${s.titleFormat} · Séparateur : ${s.separator ? `\`${s.separator}\`` : 'aucun'} · Footer : ${s.footerText ? `\`${s.footerText}\`` : 'aucun'} · Densité : ${s.density}`,
      `\n*Thème: ${name} · Personnalisations: ${hasCustom ? 'Oui' : 'Non'}*`
    ].join('\n'))
  );
}

function buildMainRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('style_themes').setLabel('🎭 Thèmes').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('style_colors').setLabel('🎨 Couleurs').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('style_buttons').setLabel('🔘 Boutons').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('style_format').setLabel('✏️ Format').setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('style_preview').setLabel('👁️ Aperçu').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('style_demo').setLabel('🖼️ Démo').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('style_reset_custom').setLabel('↩️ Reset perso').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('style_reset_all').setLabel('🗑️ Reset tout').setStyle(ButtonStyle.Danger),
    ),
  ];
}

module.exports = {
  name: 'style',
  aliases: ['theme', 'settheme', 'customstyle'],
  description: 'Personnalise le style visuel des embeds et boutons du bot pour ce serveur.',
  usage: '',
  category: 'gestion',

  run: async (client, message) => {
    if (!hasPermissionLevel(client, message, 6))
      return reply(message, errorContainer('**Permission refusée** — Niveau admin (6) requis.'));

    const guildId = message.guild.id;
    const msg = await message.reply({ components: [buildPreviewContainer(guildId), ...buildMainRows()], flags: FLAGS });

    async function refresh() {
      await msg.edit({ components: [buildPreviewContainer(guildId), ...buildMainRows()], flags: FLAGS }).catch(() => {});
    }

    const collector = msg.createMessageComponentCollector({ time: 300_000, filter: i => i.user.id === message.author.id });

    collector.on('collect', async (interaction) => {
      const id = interaction.customId;

      // ── Thèmes ────────────────────────────────────────────────────────────────
      if (id === 'style_themes') {
        await interaction.deferUpdate();
        const opts = Object.entries(SM.THEMES).map(([key, t]) =>
          new StringSelectMenuOptionBuilder().setLabel(t.name).setDescription(t.description.slice(0, 100)).setValue(key).setDefault(key === (db.get(`style_theme_${guildId}`) || 'default'))
        );
        const themesInfo = Object.entries(SM.THEMES).map(([, t]) => `**${t.name}** — ${t.description}`).join('\n');
        await msg.edit({ components: [
          container(txt('## 🎭 Choisir un Thème'), sep(), txt(themesInfo)),
          new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('style_theme_select').setPlaceholder('Sélectionnez un thème...').addOptions(opts)),
          new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('style_back').setLabel('↩️ Retour').setStyle(ButtonStyle.Secondary)),
        ], flags: FLAGS }).catch(() => {});
        return;
      }

      if (id === 'style_theme_select') {
        await interaction.deferUpdate();
        const theme = interaction.values[0];
        SM.setTheme(guildId, theme);
        await interaction.followUp({ content: `✅ Thème appliqué : **${SM.THEMES[theme]?.name || theme}**`, ephemeral: true }).catch(() => {});
        await refresh(); return;
      }

      // ── Couleurs ──────────────────────────────────────────────────────────────
      if (id === 'style_colors') {
        await interaction.deferUpdate();
        const s = SM.getStyle(guildId);
        await msg.edit({ components: [
          container(txt('## 🎨 Personnaliser les Couleurs'), sep(), txt([`Principale : \`${hexStr(s.colors.primary)}\``, `Succès : \`${hexStr(s.colors.success)}\``, `Erreur : \`${hexStr(s.colors.error)}\``, `Warning : \`${hexStr(s.colors.warning)}\``, `Info : \`${hexStr(s.colors.info)}\``, '', '*Format accepté : `#RRGGBB`*'].join('\n'))),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('style_color_primary').setLabel('Principale').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('style_color_success').setLabel('Succès').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('style_color_error').setLabel('Erreur').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('style_color_warning').setLabel('Warning').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('style_color_info').setLabel('Info').setStyle(ButtonStyle.Primary),
          ),
          new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('style_back').setLabel('↩️ Retour').setStyle(ButtonStyle.Secondary)),
        ], flags: FLAGS }).catch(() => {});
        return;
      }

      if (id.startsWith('style_color_')) {
        const colorKey = id.replace('style_color_', '');
        const modal = new ModalBuilder().setCustomId(`style_modal_color_${colorKey}`).setTitle(`Couleur ${colorKey}`);
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('hex_value').setLabel(`Couleur ${colorKey} (#RRGGBB)`).setStyle(TextInputStyle.Short).setPlaceholder('#1a1a1a').setMaxLength(7).setRequired(true)));
        await interaction.showModal(modal);
        let submit; try { submit = await interaction.awaitModalSubmit({ filter: i => i.customId === `style_modal_color_${colorKey}` && i.user.id === message.author.id, time: 60_000 }); } catch { return; }
        const hex = parseHex(submit.fields.getTextInputValue('hex_value'));
        if (hex === null) { await submit.reply({ content: '❌ Format invalide. Utilisez `#RRGGBB`.', ephemeral: true }); return; }
        SM.setCustom(guildId, { colors: { [colorKey]: hex } });
        await submit.reply({ content: `✅ Couleur **${colorKey}** → \`${hexStr(hex)}\``, ephemeral: true });
        await refresh(); return;
      }

      // ── Styles de boutons ─────────────────────────────────────────────────────
      if (id === 'style_buttons') {
        await interaction.deferUpdate();
        const s = SM.getStyle(guildId);
        const styleOpts = ['Primary', 'Secondary', 'Success', 'Danger'];
        const makeMenu = (customId, placeholder, currentVal) =>
          new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(styleOpts.map(v => new StringSelectMenuOptionBuilder().setLabel(v).setValue(v).setDefault(v === currentVal))));
        await msg.edit({ components: [
          container(txt('## 🔘 Styles des Boutons'), sep(), txt([`Principal : **${s.buttonStyles.primary}**`, `Secondaire : **${s.buttonStyles.secondary}**`, `Succès : **${s.buttonStyles.success}**`, `Danger : **${s.buttonStyles.danger}**`].join('\n'))),
          makeMenu('style_btn_primary',   '🔵 Bouton Principal',   s.buttonStyles.primary),
          makeMenu('style_btn_secondary', '⚪ Bouton Secondaire', s.buttonStyles.secondary),
          makeMenu('style_btn_success',   '🟢 Bouton Succès',     s.buttonStyles.success),
          makeMenu('style_btn_danger',    '🔴 Bouton Danger',     s.buttonStyles.danger),
          new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('style_back').setLabel('↩️ Retour').setStyle(ButtonStyle.Secondary)),
        ], flags: FLAGS }).catch(() => {});
        return;
      }

      if (id.startsWith('style_btn_')) {
        await interaction.deferUpdate();
        const btnKey = id.replace('style_btn_', '');
        SM.setCustom(guildId, { buttonStyles: { [btnKey]: interaction.values[0] } });
        await interaction.followUp({ content: `✅ Bouton **${btnKey}** → \`${interaction.values[0]}\``, ephemeral: true }).catch(() => {});
        await refresh(); return;
      }

      // ── Format ────────────────────────────────────────────────────────────────
      if (id === 'style_format') {
        await interaction.deferUpdate();
        const s = SM.getStyle(guildId);
        const tfOpts = [
          new StringSelectMenuOptionBuilder().setLabel('Normal').setDescription('Texte tel quel').setValue('normal').setDefault(s.titleFormat === 'normal'),
          new StringSelectMenuOptionBuilder().setLabel('MAJUSCULES').setDescription('Titre en majuscules').setValue('upper').setDefault(s.titleFormat === 'upper'),
          new StringSelectMenuOptionBuilder().setLabel('Emoji avant').setDescription('🔹 Titre').setValue('emoji_before').setDefault(s.titleFormat === 'emoji_before'),
          new StringSelectMenuOptionBuilder().setLabel('Emoji après').setDescription('Titre 🔹').setValue('emoji_after').setDefault(s.titleFormat === 'emoji_after'),
        ];
        const dOpts = [
          new StringSelectMenuOptionBuilder().setLabel('Compact').setDescription('Embeds courts').setValue('compact').setDefault(s.density === 'compact'),
          new StringSelectMenuOptionBuilder().setLabel('Normal').setDescription('Équilibre').setValue('normal').setDefault(s.density === 'normal'),
          new StringSelectMenuOptionBuilder().setLabel('Spacieux').setDescription('Embeds aérés').setValue('spacious').setDefault(s.density === 'spacious'),
        ];
        await msg.edit({ components: [
          container(txt('## ✏️ Format des Embeds'), sep(), txt([`**Format des titres :** ${s.titleFormat}`, `**Séparateur :** ${s.separator ? `\`${s.separator}\`` : 'aucun'}`, `**Footer :** ${s.footerText || 'aucun'}`, `**Densité :** ${s.density}`].join('\n'))),
          new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('style_titleformat').setPlaceholder('Format des titres...').addOptions(tfOpts)),
          new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('style_density').setPlaceholder('Densité...').addOptions(dOpts)),
          new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('style_set_separator').setLabel('🔀 Séparateur').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('style_set_footer').setLabel('📄 Footer').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('style_back').setLabel('↩️ Retour').setStyle(ButtonStyle.Secondary)),
        ], flags: FLAGS }).catch(() => {});
        return;
      }

      if (id === 'style_titleformat') { await interaction.deferUpdate(); SM.setCustom(guildId, { titleFormat: interaction.values[0] }); await interaction.followUp({ content: `✅ Titres → \`${interaction.values[0]}\``, ephemeral: true }).catch(() => {}); await refresh(); return; }
      if (id === 'style_density')     { await interaction.deferUpdate(); SM.setCustom(guildId, { density:     interaction.values[0] }); await interaction.followUp({ content: `✅ Densité → \`${interaction.values[0]}\``, ephemeral: true }).catch(() => {}); await refresh(); return; }

      if (id === 'style_set_separator') {
        const modal = new ModalBuilder().setCustomId('style_modal_separator').setTitle('Séparateur de description');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sep_value').setLabel('Séparateur (vide pour désactiver)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: ━━━━━━━━━━').setMaxLength(40).setRequired(false)));
        await interaction.showModal(modal);
        let submit; try { submit = await interaction.awaitModalSubmit({ filter: i => i.customId === 'style_modal_separator' && i.user.id === message.author.id, time: 60_000 }); } catch { return; }
        const val = submit.fields.getTextInputValue('sep_value').trim();
        SM.setCustom(guildId, { separator: val });
        await submit.reply({ content: `✅ Séparateur → ${val ? `\`${val}\`` : '*(désactivé)*'}`, ephemeral: true });
        await refresh(); return;
      }

      if (id === 'style_set_footer') {
        const modal = new ModalBuilder().setCustomId('style_modal_footer').setTitle('Texte du footer');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footer_value').setLabel('Footer (vide pour désactiver)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Zoom Bot • Votre serveur').setMaxLength(100).setRequired(false)));
        await interaction.showModal(modal);
        let submit; try { submit = await interaction.awaitModalSubmit({ filter: i => i.customId === 'style_modal_footer' && i.user.id === message.author.id, time: 60_000 }); } catch { return; }
        const val = submit.fields.getTextInputValue('footer_value').trim();
        SM.setCustom(guildId, { footerText: val });
        await submit.reply({ content: `✅ Footer → ${val ? `\`${val}\`` : '*(désactivé)*'}`, ephemeral: true });
        await refresh(); return;
      }

      // ── Aperçu / Démo / Reset / Retour ────────────────────────────────────────
      if (id === 'style_preview') { await interaction.deferUpdate(); await refresh(); return; }
      if (id === 'style_demo') {
        await interaction.deferUpdate();
        const s = SM.getStyle(guildId);
        await message.channel.send({ components: [container(txt('## 🖼️ Démo des styles'), sep(), txt([`✅ **Succès** : couleur \`${hexStr(s.colors.success)}\``, `❌ **Erreur** : couleur \`${hexStr(s.colors.error)}\``, `⚠️ **Warning** : couleur \`${hexStr(s.colors.warning)}\``, `ℹ️ **Info** : couleur \`${hexStr(s.colors.info)}\``].join('\n')))], flags: FLAGS })
          .then(m => setTimeout(() => m.delete().catch(() => {}), 20_000));
        return;
      }
      if (id === 'style_reset_custom') { await interaction.deferUpdate(); SM.resetCustom(guildId); await interaction.followUp({ content: '✅ Personnalisations supprimées. Thème de base conservé.', ephemeral: true }).catch(() => {}); await refresh(); return; }
      if (id === 'style_reset_all')    { await interaction.deferUpdate(); SM.resetAll(guildId);    await interaction.followUp({ content: '✅ Style réinitialisé (thème Default).', ephemeral: true }).catch(() => {}); await refresh(); return; }
      if (id === 'style_back') { await interaction.deferUpdate(); await refresh(); return; }
    });

    collector.on('end', () => msg.edit({ components: [buildPreviewContainer(guildId)], flags: FLAGS }).catch(() => {}));
  },
};
