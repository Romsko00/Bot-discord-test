const {
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const db  = require('../../utils/simpledb');
const { container, txt, sep, FLAGS } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');

// ══════════════════════════════════════════════════════════════════
//  TYPES DE COMPTEURS
// ══════════════════════════════════════════════════════════════════

const CTYPES = [
  { key: 'member', label: 'Membres',  defaultFormat: 'Membres : <count>',  getValue: g => g.memberCount },
  { key: 'online', label: 'En ligne', defaultFormat: 'En ligne : <count>', getValue: async g => { try { await g.fetch({ withCounts: true }); return g.approximatePresenceCount || 0; } catch { return 0; } } },
  { key: 'vocal',  label: 'En vocal', defaultFormat: 'En vocal : <count>', getValue: g => g.members.cache.filter(m => m.voice?.channel).size },
  { key: 'boost',  label: 'Boosts',   defaultFormat: 'Boosts : <count>',   getValue: g => g.premiumSubscriptionCount || 0 },
  { key: 'bots',   label: 'Bots',     defaultFormat: 'Bots : <count>',     getValue: g => g.members.cache.filter(m => m.user.bot).size },
  { key: 'humans', label: 'Humains',  defaultFormat: 'Humains : <count>',  getValue: g => g.members.cache.filter(m => !m.user.bot).size },
];

// ══════════════════════════════════════════════════════════════════
//  HELPERS DB / CACHE
// ══════════════════════════════════════════════════════════════════

function cfgKey(gid, key)    { return `${key}_${gid}`; }
function fmtKey(gid, key)    { return `${key}format_${gid}`; }
function catKey(gid)         { return `counter_cat_${gid}`; }

function getConfig(gid, key) {
  return {
    channelId: db.get(cfgKey(gid, key)),
    format:    db.get(fmtKey(gid, key)) || CTYPES.find(t => t.key === key)?.defaultFormat,
    enabled:   !!db.get(cfgKey(gid, key))
  };
}

// ══════════════════════════════════════════════════════════════════
//  MISE À JOUR DES SALONS VOCAUX
// ══════════════════════════════════════════════════════════════════

async function updateCounter(guild, key) {
  try {
    const cfg = getConfig(guild.id, key);
    if (!cfg.enabled) return;
    const ch = guild.channels.cache.get(cfg.channelId);
    if (!ch || ch.type !== ChannelType.GuildVoice) return;
    const type  = CTYPES.find(t => t.key === key);
    const count = await Promise.resolve(type.getValue(guild));
    const name  = (cfg.format || type.defaultFormat).replace('<count>', String(count)).slice(0, 100);
    if (ch.name !== name) await ch.setName(name).catch(() => {});
  } catch {}
}

async function updateAll(guild) {
  for (const t of CTYPES) await updateCounter(guild, t.key).catch(() => {});
}

// ══════════════════════════════════════════════════════════════════
//  CONSTRUCTION DU PANEL
// ══════════════════════════════════════════════════════════════════

async function buildPanel(guild) {
  const lines = [];
  for (const t of CTYPES) {
    const cfg = getConfig(guild.id, t.key);
    if (cfg.enabled) {
      const ch = guild.channels.cache.get(cfg.channelId);
      const count = await Promise.resolve(t.getValue(guild)).catch(() => '?');
      lines.push(`**${t.label}** — <#${cfg.channelId}> · \`${String(count)}\` · format : \`${cfg.format}\``);
    } else {
      lines.push(`**${t.label}** — non configuré`);
    }
  }

  const configuredCount = CTYPES.filter(t => getConfig(guild.id, t.key).enabled).length;

  return container(
    txt(`## Configuration — Compteurs`),
    sep(),
    txt(`**Serveur :** ${guild.name}\n**Compteurs actifs :** ${configuredCount} / ${CTYPES.length}`),
    sep(),
    txt(lines.join('\n'))
  );
}

function buildSelectCounters(selected = []) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ct_select_types')
      .setPlaceholder('Sélectionner les compteurs à configurer…')
      .setMinValues(1)
      .setMaxValues(5)
      .addOptions(CTYPES.map(t => new StringSelectMenuOptionBuilder()
        .setLabel(t.label)
        .setValue(t.key)
        .setDescription(`Format par défaut : ${t.defaultFormat}`)
        .setDefault(selected.includes(t.key))
      ))
  );
}

function buildMainButtons(hasConfig) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ct_auto').setLabel('Création automatique').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ct_refresh').setLabel('Actualiser').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ct_delete_all').setLabel('Tout supprimer').setStyle(ButtonStyle.Danger).setDisabled(!hasConfig)
  );
}

function buildCategorySelect(guild) {
  const categories = guild.channels.cache
    .filter(c => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position)
    .first(23);

  const opts = [
    new StringSelectMenuOptionBuilder()
      .setLabel('Créer une nouvelle catégorie')
      .setValue('__new__')
      .setDescription('Une catégorie "Statistiques" sera créée automatiquement')
  ];

  for (const cat of categories.values()) {
    opts.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(cat.name.slice(0, 100))
        .setValue(cat.id)
        .setDescription(`${guild.channels.cache.filter(c => c.parentId === cat.id).size} salon(s)`)
    );
  }

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ct_select_cat')
      .setPlaceholder('Choisir une catégorie pour les compteurs…')
      .addOptions(opts.slice(0, 25))
  );
}

function buildValidateRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ct_back').setLabel('Retour').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ct_validate').setLabel('Nommer et créer').setStyle(ButtonStyle.Primary).setDisabled(true)
  );
}

function buildValidateRowActive() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ct_back').setLabel('Retour').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ct_validate').setLabel('Nommer et créer').setStyle(ButtonStyle.Primary)
  );
}

// ══════════════════════════════════════════════════════════════════
//  CRÉATION DES SALONS
// ══════════════════════════════════════════════════════════════════

async function createCounters(guild, selectedKeys, formats, categoryId) {
  let cat;
  if (categoryId === '__new__') {
    cat = await guild.channels.create({
      name: 'Statistiques',
      type: ChannelType.GuildCategory,
      position: 0,
      permissionOverwrites: [{
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.Connect],
        allow: [PermissionFlagsBits.ViewChannel]
      }]
    });
    db.set(catKey(guild.id), cat.id);
  } else {
    cat = guild.channels.cache.get(categoryId);
    if (!cat) throw new Error('Catégorie introuvable.');
    db.set(catKey(guild.id), cat.id);
  }

  const created = [];
  for (const key of selectedKeys) {
    const type   = CTYPES.find(t => t.key === key);
    const fmt    = formats[key] || type.defaultFormat;
    const count  = await Promise.resolve(type.getValue(guild)).catch(() => 0);
    const name   = fmt.replace('<count>', String(count)).slice(0, 100);

    const ch = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: cat.id,
      permissionOverwrites: [{
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
        allow: [PermissionFlagsBits.ViewChannel]
      }]
    });

    db.set(cfgKey(guild.id, key), ch.id);
    db.set(fmtKey(guild.id, key), fmt);
    created.push({ key, channelId: ch.id });
  }
  return created;
}

async function deleteAllCounters(guild) {
  for (const t of CTYPES) {
    const cfg = getConfig(guild.id, t.key);
    if (cfg.channelId) {
      const ch = guild.channels.cache.get(cfg.channelId);
      if (ch) await ch.delete().catch(() => {});
      db.delete(cfgKey(guild.id, t.key));
      db.delete(fmtKey(guild.id, t.key));
    }
  }
  const catId = db.get(catKey(guild.id));
  if (catId) {
    const cat = guild.channels.cache.get(catId);
    if (cat && cat.children?.cache?.size === 0) await cat.delete().catch(() => {});
    db.delete(catKey(guild.id));
  }
}

// ══════════════════════════════════════════════════════════════════
//  COMMANDE PRINCIPALE
// ══════════════════════════════════════════════════════════════════

module.exports = {
  name: 'counter',
  aliases: ['compteur', 'compteurs', 'statistiques'],
  description: 'Configure les compteurs de statistiques du serveur (salons vocaux).',
  category: 'gestion',
  level: 4,

  updateAll,
  updateCounter,

  initializeCounterSystem(client) {
    setInterval(() => {
      client.guilds.cache.forEach(g => updateAll(g).catch(() => {}));
    }, 5 * 60 * 1000);
    client.on('guildMemberAdd',    m  => updateAll(m.guild).catch(() => {}));
    client.on('guildMemberRemove', m  => updateAll(m.guild).catch(() => {}));
    client.on('voiceStateUpdate',  (o, n) => { if (o.channelId !== n.channelId) updateAll(n.guild || o.guild).catch(() => {}); });
    client.on('guildUpdate',       (o, n) => { if (o.premiumSubscriptionCount !== n.premiumSubscriptionCount) updateAll(n).catch(() => {}); });
  },

  run: async (client, message, args, prefix) => {
    if (!hasPermissionLevel(client, message, 4))
      return message.reply({ content: 'Permission insuffisante (niveau 4 requis).', ephemeral: true });

    const guild = message.guild;

    // ── arg "update" rapide ──
    if (args[0] === 'update') {
      await updateAll(guild);
      return message.reply({ content: 'Compteurs actualisés.', ephemeral: true });
    }

    const hasConfig = CTYPES.some(t => getConfig(guild.id, t.key).enabled);

    // ── Panel initial ────────────────────────────────────────────
    const msg = await message.reply({
      components: [
        await buildPanel(guild),
        buildSelectCounters([]),
        buildMainButtons(hasConfig)
      ],
      flags: FLAGS,
      allowedMentions: { repliedUser: false }
    });

    // État local du flow
    let selectedTypes  = [];   // clés sélectionnées
    let selectedCatId  = null; // catégorie choisie

    // ── Helpers de rendu ─────────────────────────────────────────

    async function showMain() {
      selectedTypes = [];
      selectedCatId = null;
      const hc = CTYPES.some(t => getConfig(guild.id, t.key).enabled);
      await msg.edit({
        components: [
          await buildPanel(guild),
          buildSelectCounters([]),
          buildMainButtons(hc)
        ],
        flags: FLAGS
      }).catch(() => {});
    }

    async function showStep2() {
      await msg.edit({
        components: [
          container(
            txt(`## Étape 2 — Catégorie`),
            sep(),
            txt([
              `**Compteurs sélectionnés :** ${selectedTypes.map(k => CTYPES.find(t => t.key === k).label).join(', ')}`,
              '',
              'Choisissez la catégorie où créer les salons vocaux.',
              '"Créer une nouvelle catégorie" crée automatiquement une catégorie **Statistiques**.'
            ].join('\n'))
          ),
          buildCategorySelect(guild),
          buildValidateRow()
        ],
        flags: FLAGS
      }).catch(() => {});
    }

    async function showStep2WithCat() {
      await msg.edit({
        components: [
          container(
            txt(`## Étape 2 — Catégorie`),
            sep(),
            txt([
              `**Compteurs :** ${selectedTypes.map(k => CTYPES.find(t => t.key === k).label).join(', ')}`,
              `**Catégorie :** ${selectedCatId === '__new__' ? 'Nouvelle catégorie (Statistiques)' : `<#${selectedCatId}>`}`,
              '',
              'Cliquez sur **Nommer et créer** pour personnaliser les noms des salons.'
            ].join('\n'))
          ),
          buildCategorySelect(guild),
          buildValidateRowActive()
        ],
        flags: FLAGS
      }).catch(() => {});
    }

    // ── Collector ─────────────────────────────────────────────────
    const col = msg.createMessageComponentCollector({
      filter: i => i.user.id === message.author.id,
      time: 300_000
    });

    col.on('collect', async i => {
      try {
        // ── Sélection des types de compteurs ──────────────────
        if (i.isStringSelectMenu() && i.customId === 'ct_select_types') {
          await i.deferUpdate();
          selectedTypes = i.values;
          await showStep2();
          return;
        }

        // ── Sélection de la catégorie ─────────────────────────
        if (i.isStringSelectMenu() && i.customId === 'ct_select_cat') {
          await i.deferUpdate();
          selectedCatId = i.values[0];
          await showStep2WithCat();
          return;
        }

        // ── Retour ────────────────────────────────────────────
        if (i.isButton() && i.customId === 'ct_back') {
          await i.deferUpdate();
          await showMain();
          return;
        }

        // ── Actualiser ────────────────────────────────────────
        if (i.isButton() && i.customId === 'ct_refresh') {
          await i.deferUpdate();
          await updateAll(guild);
          await showMain();
          return;
        }

        // ── Tout supprimer ────────────────────────────────────
        if (i.isButton() && i.customId === 'ct_delete_all') {
          await i.deferUpdate();
          await msg.edit({
            components: [
              container(txt('## Suppression en cours…'), sep(), txt('Suppression des salons de compteurs…')),
            ],
            flags: FLAGS
          }).catch(() => {});
          await deleteAllCounters(guild);
          await showMain();
          return;
        }

        // ── Config automatique (bouton Auto) ──────────────────
        if (i.isButton() && i.customId === 'ct_auto') {
          await i.deferUpdate();
          await msg.edit({
            components: [
              container(txt('## Création automatique…'), sep(), txt('Création de la catégorie et des salons en cours, veuillez patienter…'))
            ],
            flags: FLAGS
          }).catch(() => {});
          try {
            const formats = {};
            CTYPES.forEach(t => { formats[t.key] = t.defaultFormat; });
            await createCounters(guild, CTYPES.map(t => t.key), formats, '__new__');
          } catch (err) {
            console.error('[COUNTER] Auto:', err);
            await msg.edit({
              components: [
                container(txt('## Erreur'), sep(), txt(`\`${err.message}\`\n\nVérifiez que le bot a la permission **Gérer les salons**.`))
              ],
              flags: FLAGS
            }).catch(() => {});
            return;
          }
          await showMain();
          return;
        }

        // ── Valider : ouvrir modal de nommage ─────────────────
        if (i.isButton() && i.customId === 'ct_validate') {
          if (!selectedCatId || !selectedTypes.length) {
            await i.reply({ content: 'Sélectionnez d\'abord une catégorie.', ephemeral: true });
            return;
          }

          // Construire le modal (max 5 inputs Discord)
          const toCustom = selectedTypes.slice(0, 5);
          const modal = new ModalBuilder()
            .setCustomId('ct_names_modal')
            .setTitle('Nommer les compteurs');

          modal.addComponents(
            toCustom.map(key => {
              const type = CTYPES.find(t => t.key === key);
              return new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId(`ct_fmt_${key}`)
                  .setLabel(`${type.label} — utilisez <count>`.slice(0, 45))
                  .setValue(getConfig(guild.id, key).format || type.defaultFormat)
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
                  .setPlaceholder(type.defaultFormat)
              );
            })
          );

          await i.showModal(modal);

          const sub = await i.awaitModalSubmit({
            time: 90_000,
            filter: x => x.user.id === message.author.id && x.customId === 'ct_names_modal'
          }).catch(() => null);

          if (!sub) return;
          await sub.deferUpdate();

          const formats = {};
          toCustom.forEach(key => {
            formats[key] = sub.fields.getTextInputValue(`ct_fmt_${key}`).trim() || CTYPES.find(t => t.key === key).defaultFormat;
          });
          // Les compteurs au-delà de 5 gardent leur format par défaut
          selectedTypes.slice(5).forEach(key => {
            formats[key] = CTYPES.find(t => t.key === key).defaultFormat;
          });

          // Afficher écran de chargement
          await msg.edit({
            components: [
              container(txt('## Création en cours…'), sep(), txt('Création des salons vocaux, veuillez patienter…'))
            ],
            flags: FLAGS
          }).catch(() => {});

          try {
            await createCounters(guild, selectedTypes, formats, selectedCatId);
          } catch (err) {
            console.error('[COUNTER] Création:', err);
            await msg.edit({
              components: [
                container(
                  txt('## Erreur lors de la création'),
                  sep(),
                  txt(`\`${err.message}\`\n\nVérifiez que le bot a la permission **Gérer les salons**.`)
                )
              ],
              flags: FLAGS
            }).catch(() => {});
            return;
          }

          await showMain();
          return;
        }

      } catch (err) {
        console.error('[COUNTER] Interaction:', err);
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
              txt(`Relancez \`${prefix}counter\` pour reconfigurer.`)
            )
          ],
          flags: FLAGS
        }).catch(() => {});
      }
    });
  }
};
