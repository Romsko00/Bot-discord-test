const { ChannelType, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { container, txt, sep, row, btn, reply, errorContainer, FLAGS, ButtonStyle } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { updateStatsChannels, STAT_CONFIGS } = require('../../util/stats/statsManager');
const db = require('../../utils/simpledb');

// ══════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════

function boostTier(tier) {
  return ['Aucun', 'Niveau 1 ⚡', 'Niveau 2 ⚡⚡', 'Niveau 3 💎'][tier] || `Niveau ${tier}`;
}

function verifLevel(level) {
  return ['Aucune', 'Faible', 'Moyenne', 'Haute', 'Très haute'][level] || `${level}`;
}

function fmtDate(d) {
  return `<t:${Math.floor(d.getTime() / 1000)}:D> (<t:${Math.floor(d.getTime() / 1000)}:R>)`;
}

function countChannels(guild) {
  let text = 0, voice = 0, stage = 0, cat = 0, forum = 0;
  guild.channels.cache.forEach(c => {
    if (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) text++;
    else if (c.type === ChannelType.GuildVoice) voice++;
    else if (c.type === ChannelType.GuildStageVoice) stage++;
    else if (c.type === ChannelType.GuildCategory) cat++;
    else if (c.type === ChannelType.GuildForum) forum++;
  });
  return { text, voice, stage, cat, forum };
}

// ── Vues ──────────────────────────────────────────────────────────

function buildGeneral(guild) {
  const created = fmtDate(guild.createdAt);
  const owner   = guild.ownerId ? `<@${guild.ownerId}>` : 'Inconnu';
  const locale  = guild.preferredLocale || 'fr';
  const features = guild.features.length
    ? guild.features.slice(0, 6).map(f => `\`${f.replace(/_/g, ' ')}\``).join(' ')
    : '*(aucune)*';

  return container(
    txt(`## 🏠 ${guild.name}`),
    sep(),
    txt([
      `**🆔 ID :** \`${guild.id}\``,
      `**👑 Propriétaire :** ${owner}`,
      `**📅 Créé le :** ${created}`,
      `**🌐 Langue :** \`${locale}\``,
      `**🔒 Vérification :** ${verifLevel(guild.verificationLevel)}`,
      `**🔔 Notifs par défaut :** ${guild.defaultMessageNotifications === 0 ? 'Tous les messages' : 'Mentions seulement'}`,
      '',
      `**✨ Features :** ${features}`
    ].join('\n')),
    sep(),
    ...buildNavRow(guild, 'general')
  );
}

function buildMembers(guild) {
  const total   = guild.memberCount;
  const humans  = guild.members.cache.filter(m => !m.user.bot).size;
  const bots    = guild.members.cache.filter(m => m.user.bot).size;
  const online  = guild.members.cache.filter(m => m.presence?.status && m.presence.status !== 'offline').size;

  return container(
    txt(`## 👥 Membres — ${guild.name}`),
    sep(),
    txt([
      `**Total :** ${total.toLocaleString('fr-FR')}`,
      `**Humains :** 🧑 ${humans.toLocaleString('fr-FR')}`,
      `**Bots :** 🤖 ${bots.toLocaleString('fr-FR')}`,
      `**En ligne :** 🟢 ${online || '*(PRESENCE INTENT requis)*'}`
    ].join('\n')),
    sep(),
    ...buildNavRow(guild, 'membres')
  );
}

function buildChannels(guild) {
  const { text, voice, stage, cat, forum } = countChannels(guild);
  const total = guild.channels.cache.size;

  return container(
    txt(`## 📺 Salons — ${guild.name}`),
    sep(),
    txt([
      `**Total :** ${total}`,
      `**📝 Texte :** ${text}`,
      `**🔊 Vocal :** ${voice}`,
      `**🎭 Stage :** ${stage}`,
      `**💬 Forum :** ${forum}`,
      `**📁 Catégories :** ${cat}`
    ].join('\n')),
    sep(),
    ...buildNavRow(guild, 'salons')
  );
}

function buildRoles(guild) {
  const roles = guild.roles.cache
    .filter(r => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .first(15);

  const list = roles.map(r => `${r}`).join(' ');

  return container(
    txt(`## 🎭 Rôles — ${guild.name}`),
    sep(),
    txt([
      `**Nombre total :** ${guild.roles.cache.size - 1}`,
      '',
      list.length > 800 ? list.slice(0, 800) + '…' : list
    ].join('\n')),
    sep(),
    ...buildNavRow(guild, 'roles')
  );
}

function buildBoosts(guild) {
  const boosters = guild.members.cache.filter(m => m.premiumSince).size;
  return container(
    txt(`## ⚡ Boosts — ${guild.name}`),
    sep(),
    txt([
      `**Palier :** ${boostTier(guild.premiumTier)}`,
      `**Boosts :** ⚡ ${guild.premiumSubscriptionCount || 0}`,
      `**Boosters :** 👤 ${boosters}`
    ].join('\n')),
    sep(),
    ...buildNavRow(guild, 'boosts')
  );
}

function buildStatsConfig(guild, isAdmin) {
  const currentStats = db.get(`statsvocals_${guild.id}`);
  const count = currentStats?.channels?.length || 0;
  const configured = count > 0
    ? currentStats.channels.map(c => {
        const cfg = STAT_CONFIGS[c.statKey];
        return `${cfg?.emoji || '•'} **${cfg?.name || c.statKey}** → \`${c.format || '—'}\``;
      }).join('\n')
    : '*Aucun salon configuré.*';

  const available = Object.entries(STAT_CONFIGS)
    .map(([, cfg]) => `${cfg.emoji} **${cfg.name}** — \`${cfg.placeholder}\``)
    .join('\n');

  return container(
    txt(`## 📊 Stats Vocaux — ${guild.name}`),
    sep(),
    txt(`**Salons actifs :** ${count}\n\n${configured}`),
    sep(),
    txt(`**Statistiques disponibles :**\n${available}`),
    sep(),
    isAdmin
      ? row(
          btn('svr_stats_create', 'Configurer', ButtonStyle.Success, '⚙️'),
          btn('svr_stats_refresh', 'Actualiser', ButtonStyle.Primary, '🔄', !currentStats),
          btn('svr_stats_delete', 'Supprimer', ButtonStyle.Danger, '🗑️', !currentStats),
          btn('svr_nav_general', '↩ Retour', ButtonStyle.Secondary, null)
        )
      : row(btn('svr_nav_general', '↩ Retour', ButtonStyle.Secondary, null))
  );
}

function buildNavRow(guild, active) {
  // Rangée 1 : Général, Membres, Salons (max 5 boutons par ActionRow)
  const row1 = row(
    btn('svr_nav_general', 'Général',  active === 'general'  ? ButtonStyle.Primary : ButtonStyle.Secondary, '🏠'),
    btn('svr_nav_membres', 'Membres',  active === 'membres'  ? ButtonStyle.Primary : ButtonStyle.Secondary, '👥'),
    btn('svr_nav_salons',  'Salons',   active === 'salons'   ? ButtonStyle.Primary : ButtonStyle.Secondary, '📺'),
    btn('svr_nav_roles',   'Rôles',    active === 'roles'    ? ButtonStyle.Primary : ButtonStyle.Secondary, '🎭'),
    btn('svr_nav_boosts',  'Boosts',   active === 'boosts'   ? ButtonStyle.Primary : ButtonStyle.Secondary, '⚡')
  );
  // Rangée 2 : Stats vocaux seul
  const row2 = row(
    btn('svr_nav_stats', 'Stats Vocaux', active === 'stats' ? ButtonStyle.Primary : ButtonStyle.Secondary, '📊')
  );
  return [row1, row2];
}

// ══════════════════════════════════════════════════════════════════
//  COMMANDE
// ══════════════════════════════════════════════════════════════════

module.exports = {
  name: 'svr',
  aliases: ['server', 'guildinfo', 'si'],
  category: 'utilitaire',
  description: 'Affiche les informations du serveur et configure les stats vocaux.',
  level: 0,

  run: async (client, message, args, prefix) => {
    const guild = message.guild;
    const isAdmin = hasPermissionLevel(client, message, 4);

    // Fetch membres pour avoir les stats complètes
    await guild.members.fetch().catch(() => {});

    const buildView = (view) => {
      switch (view) {
        case 'membres': return buildMembers(guild);
        case 'salons':  return buildChannels(guild);
        case 'roles':   return buildRoles(guild);
        case 'boosts':  return buildBoosts(guild);
        case 'stats':   return buildStatsConfig(guild, isAdmin);
        default:        return buildGeneral(guild);
      }
    };

    let currentView = 'general';
    const msg = await message.reply({
      components: [buildView(currentView)],
      flags: FLAGS,
      allowedMentions: { repliedUser: false }
    });

    const collector = msg.createMessageComponentCollector({
      filter: i => i.user.id === message.author.id,
      time: 300_000
    });

    // ── Stats vocaux : flow création ──────────────────────────────
    let selectedStats = [];

    collector.on('collect', async i => {
      try {
        // Navigation
        const navMap = {
          svr_nav_general: 'general',
          svr_nav_membres: 'membres',
          svr_nav_salons:  'salons',
          svr_nav_roles:   'roles',
          svr_nav_boosts:  'boosts',
          svr_nav_stats:   'stats'
        };
        if (navMap[i.customId]) {
          await i.deferUpdate();
          currentView = navMap[i.customId];
          await msg.edit({ components: [buildView(currentView)], flags: FLAGS }).catch(() => {});
          return;
        }

        // ── Sélection des stats (select menu) ─────────────────────
        if (i.isStringSelectMenu() && i.customId === 'svr_stats_select') {
          await i.deferUpdate();
          selectedStats = i.values;
          await msg.edit({
            components: [
              container(
                txt('## ⚙️ Configuration — Stats Vocaux'),
                sep(),
                txt(`**${selectedStats.length}** statistique(s) sélectionnée(s).\nClique sur **Valider la sélection** pour nommer les salons.`),
                row(
                  btn('svr_stats_validate', 'Valider la sélection', ButtonStyle.Success, '✅', selectedStats.length === 0),
                  btn('svr_nav_stats', '↩ Annuler', ButtonStyle.Secondary, null)
                )
              ),
              buildSelectMenu(selectedStats)
            ],
            flags: FLAGS
          }).catch(() => {});
          return;
        }

        // ── Configurer les stats vocaux ───────────────────────────
        if (i.customId === 'svr_stats_create') {
          if (!isAdmin) { await i.reply({ content: '❌ Permission insuffisante.', ephemeral: true }); return; }
          await i.deferUpdate();
          await msg.edit({
            components: [
              container(
                txt('## ⚙️ Sélection des statistiques'),
                sep(),
                txt('Sélectionne les statistiques à afficher dans des salons vocaux.\nTu pourras ensuite personnaliser le nom de chaque salon.'),
                row(btn('svr_nav_stats', '↩ Annuler', ButtonStyle.Secondary, null))
              ),
              buildSelectMenu([])
            ],
            flags: FLAGS
          }).catch(() => {});
          return;
        }

        // ── Valider la sélection → nommer les salons via modal ────
        if (i.customId === 'svr_stats_validate') {
          if (!selectedStats.length) { await i.reply({ content: '❌ Sélectionne au moins une statistique.', ephemeral: true }); return; }

          // Construire le modal (max 5 inputs)
          const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
          const toCustom = selectedStats.slice(0, 5);
          const modal = new ModalBuilder().setCustomId('svr_names_modal').setTitle('Noms des salons vocaux');
          modal.addComponents(
            toCustom.map(key => {
              const cfg = STAT_CONFIGS[key];
              return new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId(`input_${key}`)
                  .setLabel(`${cfg.name} (${cfg.placeholder} = valeur)`.slice(0, 45))
                  .setValue(`${cfg.emoji} ${cfg.name} : ${cfg.placeholder}`)
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              );
            })
          );
          await i.showModal(modal);

          // Attendre la soumission du modal
          const sub = await i.awaitModalSubmit({ time: 90_000, filter: x => x.user.id === message.author.id }).catch(() => null);
          if (!sub) return;
          await sub.deferUpdate();

          const formats = {};
          toCustom.forEach(key => { formats[key] = sub.fields.getTextInputValue(`input_${key}`); });
          selectedStats.slice(5).forEach(key => {
            const cfg = STAT_CONFIGS[key];
            formats[key] = `${cfg.emoji} ${cfg.name} : ${cfg.placeholder}`;
          });

          await msg.edit({
            components: [container(txt('## ⏳ Création des salons…'), sep(), txt('Veuillez patienter…'))],
            flags: FLAGS
          }).catch(() => {});

          try {
            await createStatsChannels(guild, selectedStats, formats, client);
            selectedStats = [];
            currentView = 'stats';
            await msg.edit({ components: [buildView(currentView)], flags: FLAGS }).catch(() => {});
          } catch (e) {
            console.error('[SVR] Erreur création stats:', e);
            await msg.edit({
              components: [container(
                txt('## ❌ Erreur lors de la création'),
                sep(),
                txt(`\`${e.message}\`\n\nVérifie que le bot a la permission **Gérer les salons**.`),
                row(btn('svr_nav_stats', '↩ Retour', ButtonStyle.Secondary, null))
              )],
              flags: FLAGS
            }).catch(() => {});
          }
          return;
        }

        // ── Actualiser les stats ───────────────────────────────────
        if (i.customId === 'svr_stats_refresh') {
          if (!isAdmin) { await i.reply({ content: '❌ Permission insuffisante.', ephemeral: true }); return; }
          await i.deferUpdate();
          await updateStatsChannels(guild, client);
          currentView = 'stats';
          await msg.edit({ components: [buildView(currentView)], flags: FLAGS }).catch(() => {});
          return;
        }

        // ── Supprimer les stats ────────────────────────────────────
        if (i.customId === 'svr_stats_delete') {
          if (!isAdmin) { await i.reply({ content: '❌ Permission insuffisante.', ephemeral: true }); return; }
          await i.deferUpdate();
          await deleteStatsChannels(guild);
          currentView = 'stats';
          await msg.edit({ components: [buildView(currentView)], flags: FLAGS }).catch(() => {});
          return;
        }

      } catch (err) {
        console.error('[SVR] Erreur interaction:', err);
        if (!i.replied && !i.deferred) {
          i.reply({ content: `❌ Erreur : \`${err.message}\``, ephemeral: true }).catch(() => {});
        }
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        msg.edit({
          components: [container(
            txt('## ⌛ Session expirée'),
            sep(),
            txt(`Relance \`${prefix}svr\` pour consulter à nouveau les informations du serveur.`)
          )],
          flags: FLAGS
        }).catch(() => {});
      }
    });
  }
};

// ══════════════════════════════════════════════════════════════════
//  SELECT MENU (hors container, car sinon bug discord.js v14)
// ══════════════════════════════════════════════════════════════════

function buildSelectMenu(selected = []) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('svr_stats_select')
      .setPlaceholder('Choisir les statistiques à afficher…')
      .setMinValues(1)
      .setMaxValues(Math.min(Object.keys(STAT_CONFIGS).length, 5))
      .addOptions(
        Object.entries(STAT_CONFIGS).map(([key, cfg]) => ({
          label: cfg.name,
          value: key,
          emoji: cfg.emoji,
          description: `Affiche ${cfg.placeholder}`.slice(0, 100),
          default: selected.includes(key)
        }))
      )
  );
}

// ══════════════════════════════════════════════════════════════════
//  CRÉATION / SUPPRESSION
// ══════════════════════════════════════════════════════════════════

async function createStatsChannels(guild, selectedStats, formats, client) {
  await deleteStatsChannels(guild);

  const category = await guild.channels.create({
    name: '━ Statistiques',
    type: ChannelType.GuildCategory,
    position: 0,
    permissionOverwrites: [{ id: guild.roles.everyone.id, deny: ['Connect'] }]
  });

  const channels = [];
  for (const key of selectedStats) {
    const format = formats[key];
    const cfg    = STAT_CONFIGS[key];
    const initName = format.replace(cfg.placeholder, '…');
    const channel = await guild.channels.create({
      name: initName,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [{ id: guild.roles.everyone.id, deny: ['Connect'] }]
    });
    channels.push({ channelId: channel.id, statKey: key, format });
  }

  db.set(`statsvocals_${guild.id}`, { categoryId: category.id, channels });
  await updateStatsChannels(guild, client);
}

async function deleteStatsChannels(guild) {
  const config = db.get(`statsvocals_${guild.id}`);
  if (!config) return;
  for (const c of (config.channels || [])) {
    const ch = guild.channels.cache.get(c.channelId);
    if (ch) await ch.delete().catch(() => {});
  }
  if (config.categoryId) {
    const cat = guild.channels.cache.get(config.categoryId);
    if (cat) await cat.delete().catch(() => {});
  }
  db.delete(`statsvocals_${guild.id}`);
}
