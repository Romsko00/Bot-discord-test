const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');
const EMOJIS = require('../../utils/emojis');
const { getExactPermissionLevel, hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

const PER_PAGE   = 8;
const TIMEOUT_MS = 300_000;

const CATEGORY_CONFIG = [
  { key: 'general',     label: 'Général',             description: 'Commandes générales et informations'       },
  { key: 'utilitaire',  label: 'Utilitaires',          description: 'Outils pratiques et utilitaires'           },
  { key: 'gestion',     label: 'Gestion',              description: 'Configuration et gestion du serveur'       },
  { key: 'mods',        label: 'Modération',           description: 'Outils de modération et sécurité'          },
  { key: 'levels',      label: 'Niveaux & XP',         description: 'Système de niveaux et progression'         },
  { key: 'fun',         label: 'Fun & Divertissement', description: 'Commandes fun et mini-jeux'                },
  { key: 'music',       label: 'Musique',              description: 'Lecteur musical et contrôles audio'        },
  { key: 'casino',      label: 'Casino',               description: 'Jeux de casino et économie virtuelle'      },
  { key: 'credits',     label: 'Crédits & Économie',  description: 'Gestion des crédits et boutique'           },
  { key: 'osint',       label: 'OSINT & Recherche',    description: 'Outils de recherche et investigation'      },
  { key: 'bot',         label: 'Bot & Système',        description: 'Informations et contrôle du bot'           },
  { key: 'admin',       label: 'Administration',       description: 'Commandes réservées aux administrateurs'   },
  { key: 'permissions', label: 'Permissions',          description: 'Gestion des permissions et accès'          },
  { key: 'invites',     label: 'Invitations',          description: 'Gestion des invitations du serveur'        },
  { key: 'crush',       label: 'Crush & Profils',      description: 'Profils et interactions sociales'          },
  { key: 'superowner',  label: 'Super Owner',          description: 'Commandes réservées au super propriétaire' },
  { key: 'owner',       label: 'Owner',                description: 'Commandes propriétaire du bot'             },
];

// ── Similarité par distance de Levenshtein ──────────────────────────
function similarity(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a === b) return 100;
  if (b.includes(a) || a.includes(b)) return 85;
  const m = a.length, n = b.length;
  const dp = [];
  for (let i = 0; i <= m; i++) { dp[i] = [i]; }
  for (let j = 0; j <= n; j++) { dp[0][j] = j; }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  const maxLen = Math.max(m, n, 1);
  return Math.round((1 - dp[m][n] / maxLen) * 100);
}

function loadCommands(message, client) {
  const result = {};
  const fs   = require('fs');
  const path = require('path');
  const cmdPath = path.join(__dirname, '..', '..', 'commands');
  try {
    const folders = fs.readdirSync(cmdPath);
    for (const folder of folders) {
      const folderPath = path.join(cmdPath, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;
      const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
      const cmds  = [];
      for (const file of files) {
        try {
          const mod = require(path.join(folderPath, file));
          const cmd = (typeof mod === 'function' ? mod() : mod?.default || mod);
          if (!cmd?.name) continue;
          const level = cmd.level ?? cmd.requiredLevel ?? cmd.permissionLevel ?? 1;
          if (message && client) {
            try { if (!hasPermissionLevel(client, message, level)) continue; } catch { continue; }
          }
          cmds.push({ name: cmd.name, description: cmd.description || 'Aucune description.', aliases: cmd.aliases || [], level });
        } catch {}
      }
      if (cmds.length > 0) {
        cmds.sort((a, b) => a.name.localeCompare(b.name));
        result[folder.toLowerCase()] = cmds;
      }
    }
  } catch {}
  return result;
}

function buildCategorySelectMenu(allCmds, currentKey) {
  const options = CATEGORY_CONFIG
    .filter(c => allCmds[c.key]?.length > 0)
    .map(c => {
      const count = allCmds[c.key].length;
      const o = new StringSelectMenuOptionBuilder()
        .setLabel(c.label)
        .setDescription(`${c.description.slice(0, 50)} (${count})`)
        .setValue(c.key);
      if (c.key === currentKey) o.setDefault(true);
      return o;
    });
  Object.keys(allCmds).forEach(key => {
    if (!CATEGORY_CONFIG.find(c => c.key === key) && allCmds[key].length > 0) {
      const count = allCmds[key].length;
      const o = new StringSelectMenuOptionBuilder()
        .setLabel(key.charAt(0).toUpperCase() + key.slice(1))
        .setDescription(`${count} commande${count > 1 ? 's' : ''}`)
        .setValue(key);
      if (key === currentKey) o.setDefault(true);
      options.push(o);
    }
  });
  return new StringSelectMenuBuilder()
    .setCustomId('help_cat')
    .setPlaceholder('Sélectionnez une catégorie…')
    .addOptions(options.slice(0, 25));
}

function buildNavButtons(catKey, page, totalPages) {
  return [
    new ButtonBuilder().setCustomId('help_home').setLabel('Accueil').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`help_prev_${catKey}_${page}`).setLabel('‹').setStyle(ButtonStyle.Primary).setDisabled(page <= 0),
    new ButtonBuilder().setCustomId('help_page_info').setLabel(`${page + 1} / ${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`help_next_${catKey}_${page}`).setLabel('›').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1),
  ];
}

function buildMainContainer(message, client, prefix, allCmds) {
  const totalCmds = Object.values(allCmds).reduce((a, c) => a + c.length, 0);
  const totalCats = Object.keys(allCmds).length;
  const selectRow = new ActionRowBuilder().addComponents(buildCategorySelectMenu(allCmds, null));
  return container(
    txt(`## Aide — ${client.user.username}`),
    sep(),
    txt([
      `Bienvenue **${message.author.username}** !`,
      `**Préfixe :** \`${prefix || '+'}\`   **Latence :** ${Math.round(client.ws.ping)}ms   **Commandes :** ${totalCmds} dans ${totalCats} catégories`,
      '',
      `Utilisez le menu ci-dessous pour naviguer entre les catégories.`,
      `\`${prefix || '+'}help <commande>\` — aide spécifique avec recherche intelligente`
    ].join('\n')),
    { _type: 'row', row: selectRow }
  );
}

function buildCategoryContainer(catKey, cmds, page, prefix, allCmds) {
  const cfg        = CATEGORY_CONFIG.find(c => c.key === catKey) || { key: catKey, label: catKey, description: '' };
  const totalPages = Math.max(1, Math.ceil(cmds.length / PER_PAGE));
  const slice      = cmds.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const body = slice.length === 0
    ? '*Aucune commande disponible.*'
    : slice.map(cmd => {
        const aliases = cmd.aliases.length
          ? ` *(${cmd.aliases.slice(0, 2).map(a => `\`${a}\``).join(', ')})*`
          : '';
        return `**\`${prefix || '+'}${cmd.name}\`**${aliases}\n${cmd.description}`;
      }).join('\n\n');

  const selectRow = new ActionRowBuilder().addComponents(buildCategorySelectMenu(allCmds, catKey));
  const navRow    = new ActionRowBuilder().addComponents(...buildNavButtons(catKey, page, totalPages));

  return container(
    txt(`## ${cfg.label}`),
    sep(),
    txt(body),
    sep(),
    txt(`Page ${page + 1} / ${totalPages} — ${cmds.length} commande${cmds.length > 1 ? 's' : ''}`),
    { _type: 'row', row: selectRow },
    { _type: 'row', row: navRow }
  );
}

const SEARCH_PER_PAGE = 5;

function buildSearchPage(query, matches, page, prefix) {
  const totalPages = Math.max(1, Math.ceil(matches.length / SEARCH_PER_PAGE));
  const slice = matches.slice(page * SEARCH_PER_PAGE, (page + 1) * SEARCH_PER_PAGE);

  const lines = slice.map(({ cmd, cat, matchIn }) => {
    const cfg     = CATEGORY_CONFIG.find(c => c.key === cat);
    const aliases = cmd.aliases.length
      ? ` — alias : ${cmd.aliases.slice(0, 3).map(a => `\`${a}\``).join(', ')}`
      : '';
    const where = matchIn === 'exact'       ? 'nom exact'
                : matchIn === 'name'        ? 'nom'
                : matchIn === 'alias'       ? 'alias'
                : matchIn === 'similaire'   ? 'similaire'
                : 'description';
    return [
      `**\`${prefix || '+'}${cmd.name}\`**${aliases}`,
      `${cmd.description}`,
      `📁 **${cfg?.label || cat}** · Niveau **${cmd.level}** · Trouvé dans : ${where}`
    ].join('\n');
  }).join('\n\n─────\n\n');

  const navBtns = [
    new ButtonBuilder()
      .setCustomId(`hs_prev_${page}`)
      .setLabel('‹ Préc.')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId('hs_info')
      .setLabel(`${page + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`hs_next_${page}`)
      .setLabel('Suiv. ›')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages - 1),
  ];
  const navRow = new ActionRowBuilder().addComponents(...navBtns);

  return container(
    txt(`## 🔍 Recherche — \`${query}\``),
    sep(),
    txt(`**${matches.length}** commande${matches.length > 1 ? 's' : ''} contenant **"${query}"**  ·  page ${page + 1}/${totalPages}`),
    sep(),
    txt(lines || '*Aucun résultat.*'),
    { _type: 'row', row: navRow }
  );
}

module.exports = {
  name: 'help',
  aliases: ['aide', 'h'],
  level: 0,
  description: 'Affiche la liste des commandes. Avec `+help <terme>`, effectue une recherche intelligente.',
  category: 'utilitaire',

  run: async (client, message, args, prefix) => {
    try {
      const allCmds = loadCommands(message, client);

      // ── RECHERCHE PAR MOT-CLÉ ───────────────────────────────────────
      if (args && args[0]) {
        const query = args.join(' ').toLowerCase().trim();

        // 1) Recherche par mot-clé : nom, aliases, description
        const matches = [];
        for (const [cat, cmds] of Object.entries(allCmds)) {
          for (const cmd of cmds) {
            let matchIn = null;
            if (cmd.name.toLowerCase() === query)
              matchIn = 'exact';
            else if (cmd.name.toLowerCase().includes(query))
              matchIn = 'name';
            else if (cmd.aliases.some(a => a.toLowerCase().includes(query)))
              matchIn = 'alias';
            else if ((cmd.description || '').toLowerCase().includes(query))
              matchIn = 'description';

            if (matchIn) matches.push({ cmd, cat, matchIn });
          }
        }

        // Trier : exact d'abord, puis nom, alias, description
        const ORDER = { exact: 0, name: 1, alias: 2, description: 3, similaire: 4 };
        matches.sort((a, b) => (ORDER[a.matchIn] ?? 9) - (ORDER[b.matchIn] ?? 9));

        // 2) Si exactement 1 résultat ET c'est le nom exact → fiche détaillée
        if (matches.length === 1 && matches[0].matchIn === 'exact') {
          const { cmd: exactFound, cat: exactCat } = matches[0];
          const cfg = CATEGORY_CONFIG.find(c => c.key === exactCat);
          return reply(message, container(
            txt(`## \`${prefix || '+'}${exactFound.name}\``),
            sep(),
            txt(exactFound.description),
            sep(),
            txt([
              `**Aliases :** ${exactFound.aliases.length ? exactFound.aliases.map(a => `\`${a}\``).join(', ') : '*aucun*'}`,
              `**Niveau requis :** ${exactFound.level}`,
              `**Catégorie :** ${cfg ? cfg.label : exactCat}`
            ].join('\n'))
          ));
        }

        // 3) Si aucun résultat exact → fallback similarité Levenshtein ≥ 50%
        if (!matches.length) {
          for (const [cat, cmds] of Object.entries(allCmds)) {
            for (const cmd of cmds) {
              const scores = [
                similarity(query, cmd.name),
                ...cmd.aliases.map(a => similarity(query, a))
              ];
              const best = Math.max(...scores);
              if (best >= 50) matches.push({ cmd, cat, matchIn: 'similaire', score: best });
            }
          }
          matches.sort((a, b) => (b.score || 0) - (a.score || 0));
        }

        if (!matches.length) {
          return reply(message, errorContainer(
            `Aucune commande trouvée pour **"${args.join(' ')}"**.\nEssaie \`${prefix || '+'}help\` pour parcourir toutes les catégories.`
          ));
        }

        // 4) Afficher résultats paginés de manière interactive
        let searchPage = 0;
        const searchMsg = await message.reply({
          components: [buildSearchPage(query, matches, searchPage, prefix)],
          flags: FLAGS,
          allowedMentions: { repliedUser: false }
        });

        const sc = searchMsg.createMessageComponentCollector({
          time: TIMEOUT_MS,
          filter: i => i.user.id === message.author.id
        });

        sc.on('collect', async si => {
          await si.deferUpdate().catch(() => {});
          const sid = si.customId;
          if (sid.startsWith('hs_prev_')) {
            searchPage = Math.max(0, searchPage - 1);
          } else if (sid.startsWith('hs_next_')) {
            const maxPage = Math.ceil(matches.length / SEARCH_PER_PAGE) - 1;
            searchPage = Math.min(maxPage, searchPage + 1);
          }
          await searchMsg.edit({
            components: [buildSearchPage(query, matches, searchPage, prefix)],
            flags: FLAGS
          }).catch(() => {});
        });

        sc.on('end', () => searchMsg.edit({ components: [] }).catch(() => {}));
        return;
      }

      // ── MENU PRINCIPAL ──────────────────────────────────────────────
      let currentCat  = CATEGORY_CONFIG.find(c => allCmds[c.key])?.key || Object.keys(allCmds)[0];
      let currentPage = 0;
      const totalPages = (cat) => Math.max(1, Math.ceil((allCmds[cat] || []).length / PER_PAGE));

      const sent = await message.reply({
        components: [buildMainContainer(message, client, prefix, allCmds)],
        flags: FLAGS
      });

      async function showCategory(cat, page) {
        currentCat  = cat;
        currentPage = page;
        await sent.edit({
          components: [buildCategoryContainer(cat, allCmds[cat] || [], page, prefix, allCmds)],
          flags: FLAGS
        }).catch(() => {});
      }
      async function showHome() {
        await sent.edit({
          components: [buildMainContainer(message, client, prefix, allCmds)],
          flags: FLAGS
        }).catch(() => {});
      }

      const collector = sent.createMessageComponentCollector({
        time: TIMEOUT_MS,
        filter: i => i.user.id === message.author.id
      });

      collector.on('collect', async (interaction) => {
        await interaction.deferUpdate().catch(() => {});
        const id = interaction.customId;
        if (id === 'help_cat') { await showCategory(interaction.values[0], 0); return; }
        if (id === 'help_home') { await showHome(); return; }
        if (id.startsWith('help_prev_')) {
          const p = id.split('_');
          await showCategory(p[2], Math.max(0, parseInt(p[3]) - 1));
          return;
        }
        if (id.startsWith('help_next_')) {
          const p = id.split('_');
          await showCategory(p[2], Math.min(totalPages(p[2]) - 1, parseInt(p[3]) + 1));
          return;
        }
      });

      collector.on('end', () => sent.edit({ components: [] }).catch(() => {}));

    } catch (err) {
      console.error('[help] Erreur:', err);
      return reply(message, errorContainer(`Une erreur est survenue : \`${err.message}\``)).catch(() => {});
    }
  }
};
