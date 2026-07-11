const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  RoleSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  PermissionFlagsBits
} = require('discord.js');
const db  = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');

// ══════════════════════════════════════════════════════════════════
//  DB HELPERS
// ══════════════════════════════════════════════════════════════════

function getData(guildId) {
  return db.get(`rolemenu_v2_${guildId}`) || { channelId: null, messageId: null, buttons: [] };
}
function saveData(guildId, data) {
  db.set(`rolemenu_v2_${guildId}`, data);
}

// ══════════════════════════════════════════════════════════════════
//  HELPERS STYLE
// ══════════════════════════════════════════════════════════════════

const STYLE_MAP = {
  bleu:   ButtonStyle.Primary,
  blue:   ButtonStyle.Primary,
  vert:   ButtonStyle.Success,
  green:  ButtonStyle.Success,
  rouge:  ButtonStyle.Danger,
  red:    ButtonStyle.Danger,
  gris:   ButtonStyle.Secondary,
  grey:   ButtonStyle.Secondary,
  gray:   ButtonStyle.Secondary,
};
const STYLE_LABEL = {
  [ButtonStyle.Primary]:   'Bleu',
  [ButtonStyle.Success]:   'Vert',
  [ButtonStyle.Danger]:    'Rouge',
  [ButtonStyle.Secondary]: 'Gris',
};

function parseStyle(input) {
  return STYLE_MAP[(input || '').toLowerCase().trim()] ?? ButtonStyle.Primary;
}

// ══════════════════════════════════════════════════════════════════
//  CONSTRUCTION DU PANEL PRINCIPAL
// ══════════════════════════════════════════════════════════════════

function buildPanelContainer(guild, data) {
  const lines = [];

  if (data.channelId && data.messageId) {
    lines.push(`**Message :** [Voir](https://discord.com/channels/${guild.id}/${data.channelId}/${data.messageId}) — <#${data.channelId}>`);
  } else {
    lines.push('**Message :** non défini — utilisez **Définir le message**');
  }

  lines.push('');

  if (data.buttons.length === 0) {
    lines.push('*Aucun bouton configuré. Ajoutez des rôles ci-dessous.*');
  } else {
    lines.push(`**Boutons (${data.buttons.length}) :**`);
    for (const b of data.buttons) {
      const role  = guild.roles.cache.get(b.roleId);
      const label = STYLE_LABEL[b.style] || 'Bleu';
      const emoji = b.emoji ? ` ${b.emoji}` : '';
      lines.push(`· **${b.label}**${emoji} → ${role ? role.toString() : `<@&${b.roleId}>`} — ${label}`);
    }
  }

  return container(
    txt('## Configuration — Rolemenu'),
    sep(),
    txt(lines.join('\n'))
  );
}

function buildMainActions(data) {
  const hasTarget  = !!(data.channelId && data.messageId);
  const hasButtons = data.buttons.length > 0;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rm2_set_msg').setLabel('Définir le message').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rm2_add').setLabel('Ajouter un rôle').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('rm2_apply').setLabel('Appliquer').setStyle(ButtonStyle.Primary).setDisabled(!hasTarget || !hasButtons),
    new ButtonBuilder().setCustomId('rm2_clear').setLabel('Tout effacer').setStyle(ButtonStyle.Danger).setDisabled(!hasButtons)
  );
}

function buildRemoveSelect(guild, data) {
  if (data.buttons.length === 0) return null;
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rm2_remove')
      .setPlaceholder('Retirer un bouton…')
      .addOptions(
        data.buttons.slice(0, 25).map(b => {
          const role = guild.roles.cache.get(b.roleId);
          const emoji = b.emoji ? ` ${b.emoji}` : '';
          return new StringSelectMenuOptionBuilder()
            .setLabel(`${b.label}${emoji} — ${role ? role.name : b.roleId}`.slice(0, 100))
            .setValue(b.roleId);
        })
      )
  );
}

function buildMainComponents(guild, data) {
  const comps = [buildPanelContainer(guild, data), buildMainActions(data)];
  const removeRow = buildRemoveSelect(guild, data);
  if (removeRow) comps.push(removeRow);
  return comps;
}

// ══════════════════════════════════════════════════════════════════
//  ÉTAT "AJOUT D'UN RÔLE"
// ══════════════════════════════════════════════════════════════════

function buildAddComponents(selectedRoleId = null, guild = null) {
  const desc = selectedRoleId && guild
    ? `**Rôle sélectionné :** ${guild.roles.cache.get(selectedRoleId)?.toString() || `<@&${selectedRoleId}>`}\n\nCliquez sur **Configurer** pour nommer le bouton.`
    : 'Sélectionnez le rôle qui sera attribué par le bouton.';

  const comps = [
    container(
      txt('## Ajouter un bouton — Choix du rôle'),
      sep(),
      txt(desc)
    ),
    new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('rm2_role_select')
        .setPlaceholder('Sélectionner un rôle…')
        .setMinValues(1)
        .setMaxValues(1)
    ),
  ];

  const btnRow = new ActionRowBuilder();
  if (selectedRoleId) {
    btnRow.addComponents(
      new ButtonBuilder().setCustomId('rm2_configure').setLabel('Configurer le bouton →').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('rm2_back').setLabel('Retour').setStyle(ButtonStyle.Secondary)
    );
  } else {
    btnRow.addComponents(
      new ButtonBuilder().setCustomId('rm2_back').setLabel('Retour').setStyle(ButtonStyle.Secondary)
    );
  }
  comps.push(btnRow);
  return comps;
}

// ══════════════════════════════════════════════════════════════════
//  APPLICATION SUR LE MESSAGE CIBLE
// ══════════════════════════════════════════════════════════════════

async function applyToMessage(guild, client, data) {
  const ch = guild.channels.cache.get(data.channelId);
  if (!ch) throw new Error('Salon introuvable.');

  const msg = await ch.messages.fetch(data.messageId).catch(() => null);
  if (!msg) throw new Error('Message introuvable.');
  if (msg.author.id !== client.user.id) throw new Error('Ce message n\'a pas été envoyé par le bot.');

  if (data.buttons.length === 0) {
    await msg.edit({ components: [] });
    return;
  }

  // Répartir les boutons en ActionRows (max 5 par row, max 5 rows)
  const rows = [];
  let currentRow = new ActionRowBuilder();
  let count = 0;

  for (const b of data.buttons.slice(0, 25)) {
    if (count > 0 && count % 5 === 0) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
      if (rows.length >= 5) break;
    }
    const btn = new ButtonBuilder()
      .setCustomId(`rolemenu_${b.roleId}`)
      .setStyle(b.style || ButtonStyle.Primary);
    if (b.label) btn.setLabel(b.label);
    if (b.emoji) { try { btn.setEmoji(b.emoji); } catch {} }
    currentRow.addComponents(btn);
    count++;
  }
  if (currentRow.components.length > 0 && rows.length < 5) rows.push(currentRow);

  await msg.edit({ components: rows });
}

// ══════════════════════════════════════════════════════════════════
//  COMMANDE PRINCIPALE
// ══════════════════════════════════════════════════════════════════

module.exports = {
  name: 'rolemenu',
  aliases: ['menurole', 'rolebtn'],
  description: 'Configure des boutons d\'attribution de rôles sur un message du bot.',
  category: 'gestion',
  level: 4,

  run: async (client, message, args, prefix) => {
    if (!hasPermissionLevel(client, message, 4))
      return reply(message, errorContainer('Permission insuffisante (niveau 4 requis).'));

    const guild   = message.guild;
    const guildId = guild.id;

    // État local
    let state          = 'main';   // 'main' | 'adding'
    let pendingRoleId  = null;

    // ── Envoi du panel initial ────────────────────────────────────
    const data = getData(guildId);
    const msg  = await message.reply({
      components: buildMainComponents(guild, data),
      flags: FLAGS,
      allowedMentions: { repliedUser: false }
    });

    // ── Helpers de rendu ─────────────────────────────────────────

    async function showMain() {
      state         = 'main';
      pendingRoleId = null;
      const d = getData(guildId);
      await msg.edit({ components: buildMainComponents(guild, d), flags: FLAGS }).catch(() => {});
    }

    async function showAdd() {
      state = 'adding';
      await msg.edit({ components: buildAddComponents(pendingRoleId, guild), flags: FLAGS }).catch(() => {});
    }

    // ── Collector ─────────────────────────────────────────────────
    const col = msg.createMessageComponentCollector({
      filter: i => i.user.id === message.author.id,
      time: 300_000
    });

    col.on('collect', async i => {
      try {
        // ── Définir le message cible (modal) ──────────────────
        if (i.isButton() && i.customId === 'rm2_set_msg') {
          const modal = new ModalBuilder()
            .setCustomId('rm2_modal_msg')
            .setTitle('Message cible')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('rm2_channel')
                  .setLabel('Salon (mention ou ID)')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
                  .setPlaceholder('#salon ou 123456789012345678')
                  .setValue(getData(guildId).channelId || '')
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('rm2_msgid')
                  .setLabel('ID du message')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
                  .setPlaceholder('123456789012345678')
                  .setValue(getData(guildId).messageId || '')
              )
            );

          await i.showModal(modal);

          const sub = await i.awaitModalSubmit({
            time: 90_000,
            filter: x => x.user.id === message.author.id && x.customId === 'rm2_modal_msg'
          }).catch(() => null);

          if (!sub) return;
          await sub.deferUpdate();

          const rawChan = sub.fields.getTextInputValue('rm2_channel').trim();
          const rawMsg  = sub.fields.getTextInputValue('rm2_msgid').trim();

          const chanId = rawChan.replace(/[<#>]/g, '').match(/\d+/)?.[0];
          const ch     = chanId ? guild.channels.cache.get(chanId) : null;
          if (!ch) {
            await sub.followUp({ content: 'Salon introuvable.', ephemeral: true }).catch(() => {});
            return;
          }
          const targetMsg = await ch.messages.fetch(rawMsg).catch(() => null);
          if (!targetMsg) {
            await sub.followUp({ content: 'Message introuvable dans ce salon.', ephemeral: true }).catch(() => {});
            return;
          }
          if (targetMsg.author.id !== client.user.id) {
            await sub.followUp({ content: 'Ce message doit être envoyé par le bot.', ephemeral: true }).catch(() => {});
            return;
          }

          const d = getData(guildId);
          d.channelId  = ch.id;
          d.messageId  = targetMsg.id;
          saveData(guildId, d);
          await showMain();
          return;
        }

        // ── Aller en mode ajout ───────────────────────────────
        if (i.isButton() && i.customId === 'rm2_add') {
          await i.deferUpdate();
          pendingRoleId = null;
          await showAdd();
          return;
        }

        // ── Retour depuis l'ajout ─────────────────────────────
        if (i.isButton() && i.customId === 'rm2_back') {
          await i.deferUpdate();
          await showMain();
          return;
        }

        // ── Sélection du rôle ─────────────────────────────────
        if (i.isStringSelectMenu() && i.customId === 'rm2_role_select') {
          await i.deferUpdate();
          pendingRoleId = i.values[0];

          // Vérifier que ce rôle n'est pas déjà ajouté
          const d = getData(guildId);
          if (d.buttons.some(b => b.roleId === pendingRoleId)) {
            await msg.edit({
              components: [
                container(
                  txt('## Rôle déjà configuré'),
                  sep(),
                  txt(`<@&${pendingRoleId}> est déjà dans la liste.\nChoisissez un autre rôle ou retournez au panel.`)
                ),
                new ActionRowBuilder().addComponents(
                  new RoleSelectMenuBuilder().setCustomId('rm2_role_select').setPlaceholder('Sélectionner un rôle…').setMinValues(1).setMaxValues(1)
                ),
                new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId('rm2_back').setLabel('Retour').setStyle(ButtonStyle.Secondary)
                )
              ],
              flags: FLAGS
            }).catch(() => {});
            return;
          }

          await showAdd();
          return;
        }

        // ── Configurer le bouton → ouvre la modal ─────────────
        if (i.isButton() && i.customId === 'rm2_configure') {
          if (!pendingRoleId) { await i.deferUpdate(); await showAdd(); return; }

          const role = guild.roles.cache.get(pendingRoleId);

          const modal = new ModalBuilder()
            .setCustomId('rm2_modal_btn')
            .setTitle('Configurer le bouton')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('rm2_btn_label')
                  .setLabel('Texte du bouton')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
                  .setPlaceholder(role ? role.name.slice(0, 80) : 'Ex: Membre VIP')
                  .setMaxLength(80)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('rm2_btn_emoji')
                  .setLabel('Emoji (optionnel)')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(false)
                  .setPlaceholder('Ex: 🎖️ ou :nom_emoji:')
                  .setMaxLength(50)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('rm2_btn_style')
                  .setLabel('Couleur : bleu · vert · rouge · gris')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(false)
                  .setPlaceholder('bleu (défaut)')
                  .setMaxLength(10)
              )
            );

          await i.showModal(modal);

          const sub = await i.awaitModalSubmit({
            time: 90_000,
            filter: x => x.user.id === message.author.id && x.customId === 'rm2_modal_btn'
          }).catch(() => null);

          if (!sub) return;
          await sub.deferUpdate();

          const label = sub.fields.getTextInputValue('rm2_btn_label').trim();
          const emoji = sub.fields.getTextInputValue('rm2_btn_emoji').trim() || null;
          const style = parseStyle(sub.fields.getTextInputValue('rm2_btn_style'));

          const d = getData(guildId);
          d.buttons.push({ roleId: pendingRoleId, label, emoji, style });
          saveData(guildId, d);

          pendingRoleId = null;
          await showMain();
          return;
        }

        // ── Retirer un bouton via select ──────────────────────
        if (i.isStringSelectMenu() && i.customId === 'rm2_remove') {
          await i.deferUpdate();
          const roleId = i.values[0];
          const d = getData(guildId);
          d.buttons = d.buttons.filter(b => b.roleId !== roleId);
          saveData(guildId, d);
          await showMain();
          return;
        }

        // ── Appliquer sur le message cible ────────────────────
        if (i.isButton() && i.customId === 'rm2_apply') {
          await i.deferUpdate();
          const d = getData(guildId);

          await msg.edit({
            components: [
              container(txt('## Application en cours…'), sep(), txt('Modification du message, veuillez patienter…'))
            ],
            flags: FLAGS
          }).catch(() => {});

          try {
            await applyToMessage(guild, client, d);
          } catch (err) {
            await msg.edit({
              components: [
                container(
                  txt('## Erreur'),
                  sep(),
                  txt(`\`${err.message}\`\n\nVérifiez que le bot a accès au salon et que le message lui appartient.`)
                ),
                new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId('rm2_back').setLabel('Retour').setStyle(ButtonStyle.Secondary)
                )
              ],
              flags: FLAGS
            }).catch(() => {});
            return;
          }

          await showMain();
          return;
        }

        // ── Tout effacer ──────────────────────────────────────
        if (i.isButton() && i.customId === 'rm2_clear') {
          await i.deferUpdate();
          const d = getData(guildId);
          d.buttons = [];
          saveData(guildId, d);
          await showMain();
          return;
        }

      } catch (err) {
        console.error('[ROLEMENU]', err);
        if (!i.replied && !i.deferred) {
          i.reply({ content: `Erreur : \`${err.message}\``, ephemeral: true }).catch(() => {});
        }
      }
    });

    col.on('end', (_, reason) => {
      if (reason === 'time') {
        msg.edit({
          components: [
            container(
              txt('## Session expirée'),
              sep(),
              txt(`Relancez \`${prefix}rolemenu\` pour modifier la configuration.`)
            )
          ],
          flags: FLAGS
        }).catch(() => {});
      }
    });
  }
};
