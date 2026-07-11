const {
  ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');
const { container, txt, sep, row, reply, errorContainer, FLAGS } = require('../../utils/v2');
const configManager = require('../../utils/casinoConfigManager');
const { hasPermissionLevel } = require('../../utils/permissionUtils');

// ── Constantes ─────────────────────────────────────────────────────────────
const PAGES = [
  { id: 'general',     emoji: '🏠', label: 'Général' },
  { id: 'economy',     emoji: '💰', label: 'Économie' },
  { id: 'games',       emoji: '🎮', label: 'Jeux' },
  { id: 'jackpot',     emoji: '🏆', label: 'Jackpot' },
  { id: 'daily',       emoji: '📅', label: 'Quotidien' },
  { id: 'levels',      emoji: '📊', label: 'Niveaux' },
  { id: 'multipliers', emoji: '✖️',  label: 'Multiplicateurs' },
  { id: 'security',    emoji: '🛡️', label: 'Sécurité' },
  { id: 'notifs',      emoji: '🔔', label: 'Notifications' },
];

const GAME_LABELS = {
  slots:     '🎰 Machines à sous',
  blackjack: '🃏 Blackjack',
  roulette:  '🎡 Roulette',
  coinflip:  '🪙 Coinflip',
  dice:      '🎲 Dés',
  crash:     '📈 Crash',
  mines:     '💣 Mines',
  plinko:    '🔵 Plinko',
  wheel:     '🎡 Wheel',
};

const bool = (v) => v ? '🟢 Actif' : '🔴 Désactivé';
const num  = (v, fallback = '—') => (v !== undefined && v !== null) ? String(v) : fallback;
const pct  = (v) => v !== undefined ? `${(v * 100).toFixed(1)}%` : '—';

// ── Contenu par page ────────────────────────────────────────────────────────
function getPageContent(cfg, pageId, currentGame) {
  switch (pageId) {

    case 'general': {
      const g = cfg.general;
      return {
        info: [
          `**État :** ${bool(g.enabled)}`,
          `**Monnaie :** ${g.currency.symbol} \`${g.currency.name}\``,
          `**Préfixe casino :** \`${g.prefix}\``,
          `**Langue :** ${g.language}  ·  **Fuseau :** ${g.timezone}`,
        ].join('\n'),
        actions: [
          { id: 'cc_toggle_general', label: g.enabled ? '🔴 Désactiver' : '🟢 Activer', style: g.enabled ? ButtonStyle.Danger : ButtonStyle.Success },
          { id: 'cc_edit_sym',   label: '💱 Symbole',    style: ButtonStyle.Secondary },
          { id: 'cc_edit_cur',   label: '🔤 Nom monnaie',style: ButtonStyle.Secondary },
          { id: 'cc_edit_pfx',   label: '⌨️ Préfixe',   style: ButtonStyle.Secondary },
        ],
      };
    }

    case 'economy': {
      const e = cfg.economy;
      const bp = e.bankruptcyProtection;
      return {
        info: [
          `**Solde départ :** \`${num(e.startingBalance)}\`  ·  **Solde max :** \`${num(e.maxBalance)}\``,
          `**Mise min :** \`${num(e.minBet)}\`  ·  **Mise max :** \`${num(e.maxBet)}\``,
          `**Protection faillite :** ${bool(bp?.enabled)}${bp?.enabled ? `  →  reset à \`${num(bp.resetAmount)}\`` : ''}`,
        ].join('\n'),
        actions: [
          { id: 'cc_edit_startbal', label: '💵 Solde départ',  style: ButtonStyle.Secondary },
          { id: 'cc_edit_maxbal',   label: '💎 Solde max',     style: ButtonStyle.Secondary },
          { id: 'cc_edit_minbet',   label: '📉 Mise min',      style: ButtonStyle.Secondary },
          { id: 'cc_edit_maxbet',   label: '📈 Mise max',      style: ButtonStyle.Secondary },
          { id: 'cc_toggle_bp',     label: bp?.enabled ? '🔴 Faillite OFF' : '🟢 Faillite ON', style: bp?.enabled ? ButtonStyle.Danger : ButtonStyle.Success },
          { id: 'cc_edit_bpamt',    label: '🔄 Montant reset', style: ButtonStyle.Secondary },
        ],
      };
    }

    case 'games': {
      const games = cfg.games || {};
      const gameList = Object.entries(GAME_LABELS).map(([k, label]) => {
        const g = games[k] || {};
        return `${g.enabled ? '🟢' : '🔴'} **${label}** — mise ${num(g.minBet)}–${num(g.maxBet)}${g.rtp ? ` · RTP ${pct(g.rtp)}` : ''}`;
      }).join('\n');

      const selGame = currentGame && games[currentGame];
      const gameDetail = selGame
        ? `\n\n**Jeu sélectionné : ${GAME_LABELS[currentGame]}**\n${bool(selGame.enabled)}  ·  mise \`${num(selGame.minBet)}\`–\`${num(selGame.maxBet)}\`${selGame.rtp ? `  ·  RTP ${pct(selGame.rtp)}` : ''}`
        : '\n\n*Sélectionnez un jeu pour le configurer.*';

      const gameActions = currentGame ? [
        { id: 'cc_game_toggle', label: (games[currentGame]?.enabled) ? '🔴 Désactiver' : '🟢 Activer', style: (games[currentGame]?.enabled) ? ButtonStyle.Danger : ButtonStyle.Success },
        { id: 'cc_game_minbet', label: '📉 Mise min',   style: ButtonStyle.Secondary },
        { id: 'cc_game_maxbet', label: '📈 Mise max',   style: ButtonStyle.Secondary },
        { id: 'cc_game_rtp',    label: '📊 RTP (%)',    style: ButtonStyle.Secondary },
      ] : [];

      return { info: gameList + gameDetail, actions: gameActions, hasGameSelect: true };
    }

    case 'jackpot': {
      const j = cfg.jackpot || {};
      return {
        info: [
          `**État :** ${bool(j.enabled)}`,
          `**Montant départ :** \`${num(j.starting)}\`  ·  **Jackpot max :** \`${num(j.maxSize)}\``,
          `**Taux contribution :** ${pct(j.contributionRate)} par mise`,
          `**Gain minimum :** \`${num(j.minWin)}\``,
          `**Reset après gain :** ${bool(j.resetAfterWin)}  →  reset à \`${num(j.resetAmount)}\``,
        ].join('\n'),
        actions: [
          { id: 'cc_toggle_jackpot', label: j.enabled ? '🔴 Désactiver' : '🟢 Activer', style: j.enabled ? ButtonStyle.Danger : ButtonStyle.Success },
          { id: 'cc_edit_jstart',    label: '💵 Montant départ',   style: ButtonStyle.Secondary },
          { id: 'cc_edit_jmax',      label: '💎 Jackpot max',      style: ButtonStyle.Secondary },
          { id: 'cc_edit_jrate',     label: '📊 Taux contrib. (%)',style: ButtonStyle.Secondary },
          { id: 'cc_edit_jminwin',   label: '🎯 Gain minimum',     style: ButtonStyle.Secondary },
        ],
      };
    }

    case 'daily': {
      const d = cfg.daily || {};
      const s = d.streak || {};
      return {
        info: [
          `**État :** ${bool(d.enabled)}`,
          `**Récompense de base :** \`${num(d.baseAmount)}\``,
          `**Cooldown :** \`${Math.round((d.cooldown || 86400000) / 3600000)}h\``,
          `**Streak :** ${bool(s.enabled)}  ·  \`+${num(s.bonusPerDay)}\`/jour  ·  max \`${num(s.maxBonus)}\``,
          `**Reset si manqué :** ${bool(s.resetOnMiss)}`,
        ].join('\n'),
        actions: [
          { id: 'cc_toggle_daily',     label: d.enabled ? '🔴 Désactiver' : '🟢 Activer',  style: d.enabled ? ButtonStyle.Danger : ButtonStyle.Success },
          { id: 'cc_edit_dailyamt',    label: '💵 Récompense base',  style: ButtonStyle.Secondary },
          { id: 'cc_toggle_streak',    label: s.enabled ? '🔴 Streak OFF' : '🟢 Streak ON', style: s.enabled ? ButtonStyle.Danger : ButtonStyle.Success },
          { id: 'cc_edit_streakbonus', label: '⬆️ Bonus/jour',       style: ButtonStyle.Secondary },
          { id: 'cc_edit_streakmax',   label: '💎 Bonus max',        style: ButtonStyle.Secondary },
        ],
      };
    }

    case 'levels': {
      const l = cfg.levels || {};
      return {
        info: [
          `**État :** ${bool(l.enabled)}`,
          `**XP par partie :** \`${num(l.xpPerGame?.min)}\`–\`${num(l.xpPerGame?.max)}\``,
          `**XP par victoire :** \`${num(l.xpPerWin?.min)}\`–\`${num(l.xpPerWin?.max)}\``,
          `**Niveau max :** \`${num(l.maxLevel)}\``,
          `**Formule XP :** \`${l.xpRequiredFormula || 'level * 1000'}\``,
          `**Bonus/niveau :** \`${num(l.rewards?.perLevel?.currency)}\` ${cfg.general?.currency?.symbol || '💰'}  +\`${pct(l.rewards?.perLevel?.multiplier ? l.rewards.perLevel.multiplier - 1 : null)}\``,
        ].join('\n'),
        actions: [
          { id: 'cc_toggle_levels',    label: l.enabled ? '🔴 Désactiver' : '🟢 Activer', style: l.enabled ? ButtonStyle.Danger : ButtonStyle.Success },
          { id: 'cc_edit_xpgmin',      label: '🎮 XP/partie min',  style: ButtonStyle.Secondary },
          { id: 'cc_edit_xpgmax',      label: '🎮 XP/partie max',  style: ButtonStyle.Secondary },
          { id: 'cc_edit_xpwmin',      label: '🏆 XP/win min',     style: ButtonStyle.Secondary },
          { id: 'cc_edit_xpwmax',      label: '🏆 XP/win max',     style: ButtonStyle.Secondary },
          { id: 'cc_edit_maxlvl',      label: '⬆️ Niveau max',     style: ButtonStyle.Secondary },
        ],
      };
    }

    case 'multipliers': {
      const m = cfg.multipliers || {};
      return {
        info: [
          `**Multiplicateur global :** \`×${num(m.global, '1.0')}\``,
          `**Weekend :** ${bool(m.weekend?.enabled)}  ·  \`×${num(m.weekend?.multiplier, '1.5')}\``,
          `**Événements :** ${bool(m.events?.enabled)}${m.events?.active ? '  ·  🟡 **EN COURS**' : ''}  ·  \`×${num(m.events?.multiplier, '2.0')}\``,
          `**Happy Hour :** ${bool(m.happyHour?.enabled)}  ·  \`×${num(m.happyHour?.multiplier, '1.3')}\``,
        ].join('\n'),
        actions: [
          { id: 'cc_edit_global_mult',  label: '🌍 Multi global',   style: ButtonStyle.Secondary },
          { id: 'cc_toggle_weekend',    label: m.weekend?.enabled ? '📅 Weekend OFF' : '📅 Weekend ON', style: m.weekend?.enabled ? ButtonStyle.Danger : ButtonStyle.Success },
          { id: 'cc_edit_weekend_mult', label: '📅 Multi weekend',  style: ButtonStyle.Secondary },
          { id: 'cc_toggle_event',      label: m.events?.enabled ? '🎉 Event OFF' : '🎉 Event ON', style: m.events?.enabled ? ButtonStyle.Danger : ButtonStyle.Success },
          { id: 'cc_toggle_hh',         label: m.happyHour?.enabled ? '⏰ Happy Hour OFF' : '⏰ Happy Hour ON', style: m.happyHour?.enabled ? ButtonStyle.Danger : ButtonStyle.Success },
        ],
      };
    }

    case 'security': {
      const s = cfg.security || {};
      const ac = s.antiCheat || {};
      const lim = s.limits || {};
      return {
        info: [
          `**Anti-cheat :** ${bool(ac.enabled)}`,
          `**Streak max :** \`${num(ac.maxWinStreak)}\``,
          `**Gain max/jour :** \`${num(lim.maxDailyWin)}\``,
          `**Perte max/jour :** \`${num(lim.maxDailyLoss)}\``,
        ].join('\n'),
        actions: [
          { id: 'cc_toggle_ac',    label: ac.enabled ? '🔴 Anti-cheat OFF' : '🟢 Anti-cheat ON', style: ac.enabled ? ButtonStyle.Danger : ButtonStyle.Success },
          { id: 'cc_edit_streak',  label: '🏆 Streak max',        style: ButtonStyle.Secondary },
          { id: 'cc_edit_winlim',  label: '📈 Gain max/jour',     style: ButtonStyle.Secondary },
          { id: 'cc_edit_losslim', label: '📉 Perte max/jour',    style: ButtonStyle.Secondary },
        ],
      };
    }

    case 'notifs': {
      const n = cfg.notifications || {};
      return {
        info: [
          `**Gros gains :** ${bool(n.bigWin?.enabled)}  ·  seuil \`${num(n.bigWin?.threshold)}\``,
          `**Level up :** ${bool(n.levelUp?.enabled)}`,
          `**Succès :** ${bool(n.achievements?.enabled)}`,
        ].join('\n'),
        actions: [
          { id: 'cc_toggle_bigwin',    label: n.bigWin?.enabled ? '🔴 Gros gains OFF' : '💰 Gros gains ON', style: n.bigWin?.enabled ? ButtonStyle.Danger : ButtonStyle.Success },
          { id: 'cc_edit_bigwin_th',   label: '📊 Seuil gros gains',  style: ButtonStyle.Secondary },
          { id: 'cc_toggle_levelup',   label: n.levelUp?.enabled ? '🔴 Level up OFF' : '📊 Level up ON',   style: n.levelUp?.enabled ? ButtonStyle.Danger : ButtonStyle.Success },
          { id: 'cc_toggle_achieve',   label: n.achievements?.enabled ? '🔴 Succès OFF' : '🏆 Succès ON',  style: n.achievements?.enabled ? ButtonStyle.Danger : ButtonStyle.Success },
        ],
      };
    }

    default:
      return { info: 'Section inconnue.', actions: [] };
  }
}

// ── Build du container ──────────────────────────────────────────────────────
function buildPanel(guildId, pageId, currentGame) {
  const cfg  = configManager.getGuildConfig(guildId);
  const pi   = PAGES.findIndex(p => p.id === pageId);
  const page = PAGES[pi];
  const { info, actions = [], hasGameSelect = false } = getPageContent(cfg, pageId, currentGame);

  // Page selector
  const pageSelect = new StringSelectMenuBuilder()
    .setCustomId('cc_page')
    .setPlaceholder('📑 Naviguer vers une section...')
    .addOptions(PAGES.map(p => new StringSelectMenuOptionBuilder()
      .setLabel(`${p.emoji} ${p.label}`)
      .setValue(p.id)
      .setDefault(p.id === pageId)
    ));

  // Action rows (max 5 buttons per row)
  const actionRows = [];
  for (let i = 0; i < actions.length; i += 4) {
    const chunk = actions.slice(i, i + 4);
    actionRows.push(row(...chunk.map(a =>
      new ButtonBuilder().setCustomId(a.id).setLabel(a.label).setStyle(a.style)
    )));
  }

  // Game selector (page 3 only)
  const gameSelectRow = hasGameSelect
    ? row(new StringSelectMenuBuilder()
        .setCustomId('cc_game_select')
        .setPlaceholder('🎮 Choisir un jeu à configurer...')
        .addOptions(Object.entries(GAME_LABELS).map(([k, label]) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(label)
            .setValue(k)
            .setDefault(k === currentGame)
        ))
      )
    : null;

  // Navigation buttons
  const prevPage = pi > 0 ? PAGES[pi - 1] : null;
  const nextPage = pi < PAGES.length - 1 ? PAGES[pi + 1] : null;
  const navRow = row(
    new ButtonBuilder().setCustomId('cc_nav_prev').setLabel('◀ Préc.').setStyle(ButtonStyle.Secondary).setDisabled(!prevPage),
    new ButtonBuilder().setCustomId('cc_nav_next').setLabel('Suiv. ▶').setStyle(ButtonStyle.Secondary).setDisabled(!nextPage),
    new ButtonBuilder().setCustomId('cc_refresh').setLabel('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cc_export').setLabel('📤 Export').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cc_close').setLabel('✖ Fermer').setStyle(ButtonStyle.Danger),
  );

  const comps = [
    txt(`## 🎰 Config Casino · ${page.emoji} ${page.label}  *(${pi + 1}/${PAGES.length})*`),
    sep(),
    txt(info),
  ];

  if (actions.length > 0) {
    comps.push(sep(), txt('**⚙️ Modifier :**'));
    comps.push(...actionRows);
  }

  if (gameSelectRow) {
    comps.push(sep(), txt('**🎮 Configurer un jeu :**'), gameSelectRow);
  }

  comps.push(sep(), row(pageSelect), navRow);

  return container(...comps);
}

// ── Prompt helper ───────────────────────────────────────────────────────────
async function prompt(message, label, hint = '') {
  const info = hint ? `\n*${hint}*` : '';
  const q = await message.channel.send({
    components: [container(txt(`**${label}**${info}\n\nTapez la valeur ci-dessous ou \`annuler\`.`))],
    flags: FLAGS,
  });
  try {
    const col = await message.channel.awaitMessages({
      filter: m => m.author.id === message.author.id,
      max: 1, time: 60_000, errors: ['time'],
    });
    const res = col.first();
    await q.delete().catch(() => {});
    await res.delete().catch(() => {});
    if (res.content.toLowerCase() === 'annuler') return null;
    return res.content.trim();
  } catch {
    await q.delete().catch(() => {});
    return null;
  }
}

async function promptNum(message, label, hint = '') {
  const raw = await prompt(message, label, hint);
  if (!raw) return null;
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

async function notify(message, text, ms = 5000) {
  const m = await message.channel.send({
    components: [container(txt(text))],
    flags: FLAGS,
  }).catch(() => null);
  if (m) setTimeout(() => m.delete().catch(() => {}), ms);
}

// ── Module ──────────────────────────────────────────────────────────────────
module.exports = {
  name: 'casinoconfig',
  aliases: ['ccasino', 'cconfig', 'casino-config'],
  description: 'Panel de configuration complet du casino',
  usage: '+ccasino',
  category: 'casino',

  run: async (client, message) => {
    const isAdmin = hasPermissionLevel(client, message, 6)
      || client.config.owners?.includes(message.author.id)
      || client.config.superadmin?.includes(message.author.id);
    if (!isAdmin) return reply(message, errorContainer('Permission insuffisante — niveau 6 (Admin) requis.'));

    const guildId = message.guild.id;
    let currentPage = 'general';
    let currentGame = null;

    const refresh = () => configManager.getGuildConfig(guildId) && buildPanel(guildId, currentPage, currentGame);

    const sent = await message.channel.send({
      components: [buildPanel(guildId, currentPage, currentGame)],
      flags: FLAGS,
    });

    const collector = sent.createMessageComponentCollector({
      filter: i => i.user.id === message.author.id,
      time: 600_000,
    });

    collector.on('collect', async (i) => {
      const cid = i.customId;

      // ── Navigation ────────────────────────────────────────────────────────
      if (cid === 'cc_page') {
        currentPage = i.values[0];
        currentGame = null;
        await i.update({ components: [refresh()], flags: FLAGS }); return;
      }
      if (cid === 'cc_nav_prev') {
        const pi = PAGES.findIndex(p => p.id === currentPage);
        if (pi > 0) { currentPage = PAGES[pi - 1].id; currentGame = null; }
        await i.update({ components: [refresh()], flags: FLAGS }); return;
      }
      if (cid === 'cc_nav_next') {
        const pi = PAGES.findIndex(p => p.id === currentPage);
        if (pi < PAGES.length - 1) { currentPage = PAGES[pi + 1].id; currentGame = null; }
        await i.update({ components: [refresh()], flags: FLAGS }); return;
      }
      if (cid === 'cc_refresh') {
        await i.update({ components: [refresh()], flags: FLAGS }); return;
      }
      if (cid === 'cc_close') {
        collector.stop();
        await i.update({ components: [container(txt('✖️ Panel Casino fermé.'))], flags: FLAGS }); return;
      }

      // ── Export ────────────────────────────────────────────────────────────
      if (cid === 'cc_export') {
        await i.deferUpdate();
        const data = configManager.exportConfig(guildId);
        const buf  = Buffer.from(data, 'utf-8');
        await i.followUp({
          content: '📤 **Configuration exportée**',
          files: [{ attachment: buf, name: `casino-config-${guildId}.json` }],
          ephemeral: true,
        });
        return;
      }

      // ── Game select ───────────────────────────────────────────────────────
      if (cid === 'cc_game_select') {
        currentGame = i.values[0];
        await i.update({ components: [refresh()], flags: FLAGS }); return;
      }

      // Pour les actions d'édition, on defer et on met à jour après
      await i.deferUpdate().catch(() => {});

      // ── Général ───────────────────────────────────────────────────────────
      if (cid === 'cc_toggle_general') {
        const v = !configManager.getConfigValue(guildId, 'general.enabled');
        configManager.updateConfigValue(guildId, 'general.enabled', v);
      }
      else if (cid === 'cc_edit_sym') {
        const v = await prompt(message, '💱 Symbole de la monnaie', 'ex: 💰 ou 🪙');
        if (v) configManager.updateConfigValue(guildId, 'general.currency.symbol', v);
      }
      else if (cid === 'cc_edit_cur') {
        const v = await prompt(message, '🔤 Nom de la monnaie', 'ex: JTN, Pièces, Coins...');
        if (v) configManager.updateConfigValue(guildId, 'general.currency.name', v);
      }
      else if (cid === 'cc_edit_pfx') {
        const v = await prompt(message, '⌨️ Préfixe casino', 'ex: +c, !c, $c...');
        if (v) configManager.updateConfigValue(guildId, 'general.prefix', v);
      }

      // ── Économie ──────────────────────────────────────────────────────────
      else if (cid === 'cc_edit_startbal') {
        const v = await promptNum(message, '💵 Solde de départ', 'Montant attribué aux nouveaux membres');
        if (v !== null) configManager.updateConfigValue(guildId, 'economy.startingBalance', Math.max(0, Math.floor(v)));
      }
      else if (cid === 'cc_edit_maxbal') {
        const v = await promptNum(message, '💎 Solde maximum', 'Solde qu\'un joueur ne peut pas dépasser');
        if (v !== null) configManager.updateConfigValue(guildId, 'economy.maxBalance', Math.max(1, Math.floor(v)));
      }
      else if (cid === 'cc_edit_minbet') {
        const v = await promptNum(message, '📉 Mise minimale globale');
        if (v !== null) configManager.updateConfigValue(guildId, 'economy.minBet', Math.max(1, Math.floor(v)));
      }
      else if (cid === 'cc_edit_maxbet') {
        const v = await promptNum(message, '📈 Mise maximale globale');
        if (v !== null) configManager.updateConfigValue(guildId, 'economy.maxBet', Math.max(1, Math.floor(v)));
      }
      else if (cid === 'cc_toggle_bp') {
        const cur = configManager.getConfigValue(guildId, 'economy.bankruptcyProtection.enabled');
        configManager.updateConfigValue(guildId, 'economy.bankruptcyProtection.enabled', !cur);
      }
      else if (cid === 'cc_edit_bpamt') {
        const v = await promptNum(message, '🔄 Montant de reset (protection faillite)', 'Solde attribué si le joueur tombe à 0');
        if (v !== null) configManager.updateConfigValue(guildId, 'economy.bankruptcyProtection.resetAmount', Math.max(0, Math.floor(v)));
      }

      // ── Jeux ──────────────────────────────────────────────────────────────
      else if (cid === 'cc_game_toggle' && currentGame) {
        const cur = configManager.getConfigValue(guildId, `games.${currentGame}.enabled`);
        configManager.updateConfigValue(guildId, `games.${currentGame}.enabled`, !cur);
      }
      else if (cid === 'cc_game_minbet' && currentGame) {
        const v = await promptNum(message, `📉 Mise min — ${GAME_LABELS[currentGame]}`);
        if (v !== null) configManager.updateConfigValue(guildId, `games.${currentGame}.minBet`, Math.max(1, Math.floor(v)));
      }
      else if (cid === 'cc_game_maxbet' && currentGame) {
        const v = await promptNum(message, `📈 Mise max — ${GAME_LABELS[currentGame]}`);
        if (v !== null) configManager.updateConfigValue(guildId, `games.${currentGame}.maxBet`, Math.max(1, Math.floor(v)));
      }
      else if (cid === 'cc_game_rtp' && currentGame) {
        const v = await promptNum(message, `📊 RTP — ${GAME_LABELS[currentGame]}`, 'Entrez un pourcentage (ex: 96 pour 96%). Max 100');
        if (v !== null) configManager.updateConfigValue(guildId, `games.${currentGame}.rtp`, Math.min(1, Math.max(0.01, v / 100)));
      }

      // ── Jackpot ───────────────────────────────────────────────────────────
      else if (cid === 'cc_toggle_jackpot') {
        const cur = configManager.getConfigValue(guildId, 'jackpot.enabled');
        configManager.updateConfigValue(guildId, 'jackpot.enabled', !cur);
      }
      else if (cid === 'cc_edit_jstart') {
        const v = await promptNum(message, '💵 Montant de départ du jackpot');
        if (v !== null) configManager.updateConfigValue(guildId, 'jackpot.starting', Math.max(0, Math.floor(v)));
      }
      else if (cid === 'cc_edit_jmax') {
        const v = await promptNum(message, '💎 Jackpot maximum');
        if (v !== null) configManager.updateConfigValue(guildId, 'jackpot.maxSize', Math.max(1, Math.floor(v)));
      }
      else if (cid === 'cc_edit_jrate') {
        const v = await promptNum(message, '📊 Taux de contribution (%)', 'ex: 2 pour 2% de chaque mise');
        if (v !== null) configManager.updateConfigValue(guildId, 'jackpot.contributionRate', Math.min(1, Math.max(0, v / 100)));
      }
      else if (cid === 'cc_edit_jminwin') {
        const v = await promptNum(message, '🎯 Gain minimum pour déclencher le jackpot');
        if (v !== null) configManager.updateConfigValue(guildId, 'jackpot.minWin', Math.max(1, Math.floor(v)));
      }

      // ── Daily ─────────────────────────────────────────────────────────────
      else if (cid === 'cc_toggle_daily') {
        const cur = configManager.getConfigValue(guildId, 'daily.enabled');
        configManager.updateConfigValue(guildId, 'daily.enabled', !cur);
      }
      else if (cid === 'cc_edit_dailyamt') {
        const v = await promptNum(message, '💵 Récompense daily de base');
        if (v !== null) configManager.updateConfigValue(guildId, 'daily.baseAmount', Math.max(1, Math.floor(v)));
      }
      else if (cid === 'cc_toggle_streak') {
        const cur = configManager.getConfigValue(guildId, 'daily.streak.enabled');
        configManager.updateConfigValue(guildId, 'daily.streak.enabled', !cur);
      }
      else if (cid === 'cc_edit_streakbonus') {
        const v = await promptNum(message, '⬆️ Bonus de streak par jour', 'Montant supplémentaire par jour d\'affilée');
        if (v !== null) configManager.updateConfigValue(guildId, 'daily.streak.bonusPerDay', Math.max(0, Math.floor(v)));
      }
      else if (cid === 'cc_edit_streakmax') {
        const v = await promptNum(message, '💎 Bonus de streak maximum');
        if (v !== null) configManager.updateConfigValue(guildId, 'daily.streak.maxBonus', Math.max(0, Math.floor(v)));
      }

      // ── Niveaux ───────────────────────────────────────────────────────────
      else if (cid === 'cc_toggle_levels') {
        const cur = configManager.getConfigValue(guildId, 'levels.enabled');
        configManager.updateConfigValue(guildId, 'levels.enabled', !cur);
      }
      else if (cid === 'cc_edit_xpgmin') {
        const v = await promptNum(message, '🎮 XP par partie — minimum');
        if (v !== null) configManager.updateConfigValue(guildId, 'levels.xpPerGame.min', Math.max(0, Math.floor(v)));
      }
      else if (cid === 'cc_edit_xpgmax') {
        const v = await promptNum(message, '🎮 XP par partie — maximum');
        if (v !== null) configManager.updateConfigValue(guildId, 'levels.xpPerGame.max', Math.max(1, Math.floor(v)));
      }
      else if (cid === 'cc_edit_xpwmin') {
        const v = await promptNum(message, '🏆 XP par victoire — minimum');
        if (v !== null) configManager.updateConfigValue(guildId, 'levels.xpPerWin.min', Math.max(0, Math.floor(v)));
      }
      else if (cid === 'cc_edit_xpwmax') {
        const v = await promptNum(message, '🏆 XP par victoire — maximum');
        if (v !== null) configManager.updateConfigValue(guildId, 'levels.xpPerWin.max', Math.max(1, Math.floor(v)));
      }
      else if (cid === 'cc_edit_maxlvl') {
        const v = await promptNum(message, '⬆️ Niveau maximum', 'ex: 100');
        if (v !== null) configManager.updateConfigValue(guildId, 'levels.maxLevel', Math.max(1, Math.floor(v)));
      }

      // ── Multiplicateurs ───────────────────────────────────────────────────
      else if (cid === 'cc_edit_global_mult') {
        const v = await promptNum(message, '🌍 Multiplicateur global', 'ex: 1.5 pour ×1.5 sur tous les gains');
        if (v !== null) configManager.updateConfigValue(guildId, 'multipliers.global', Math.max(0.1, v));
      }
      else if (cid === 'cc_toggle_weekend') {
        const cur = configManager.getConfigValue(guildId, 'multipliers.weekend.enabled');
        configManager.updateConfigValue(guildId, 'multipliers.weekend.enabled', !cur);
      }
      else if (cid === 'cc_edit_weekend_mult') {
        const v = await promptNum(message, '📅 Multiplicateur weekend', 'ex: 1.5 pour ×1.5');
        if (v !== null) configManager.updateConfigValue(guildId, 'multipliers.weekend.multiplier', Math.max(1, v));
      }
      else if (cid === 'cc_toggle_event') {
        const cur = configManager.getConfigValue(guildId, 'multipliers.events.enabled');
        configManager.updateConfigValue(guildId, 'multipliers.events.enabled', !cur);
      }
      else if (cid === 'cc_toggle_hh') {
        const cur = configManager.getConfigValue(guildId, 'multipliers.happyHour.enabled');
        configManager.updateConfigValue(guildId, 'multipliers.happyHour.enabled', !cur);
      }

      // ── Sécurité ──────────────────────────────────────────────────────────
      else if (cid === 'cc_toggle_ac') {
        const cur = configManager.getConfigValue(guildId, 'security.antiCheat.enabled');
        configManager.updateConfigValue(guildId, 'security.antiCheat.enabled', !cur);
      }
      else if (cid === 'cc_edit_streak') {
        const v = await promptNum(message, '🏆 Streak de victoires max (anti-cheat)', 'Nombre max de victoires d\'affilée autorisées');
        if (v !== null) configManager.updateConfigValue(guildId, 'security.antiCheat.maxWinStreak', Math.max(1, Math.floor(v)));
      }
      else if (cid === 'cc_edit_winlim') {
        const v = await promptNum(message, '📈 Gain maximum par jour');
        if (v !== null) configManager.updateConfigValue(guildId, 'security.limits.maxDailyWin', Math.max(1, Math.floor(v)));
      }
      else if (cid === 'cc_edit_losslim') {
        const v = await promptNum(message, '📉 Perte maximale par jour');
        if (v !== null) configManager.updateConfigValue(guildId, 'security.limits.maxDailyLoss', Math.max(1, Math.floor(v)));
      }

      // ── Notifications ─────────────────────────────────────────────────────
      else if (cid === 'cc_toggle_bigwin') {
        const cur = configManager.getConfigValue(guildId, 'notifications.bigWin.enabled');
        configManager.updateConfigValue(guildId, 'notifications.bigWin.enabled', !cur);
      }
      else if (cid === 'cc_edit_bigwin_th') {
        const v = await promptNum(message, '📊 Seuil de détection des gros gains', 'Montant à partir duquel une notification est envoyée');
        if (v !== null) configManager.updateConfigValue(guildId, 'notifications.bigWin.threshold', Math.max(1, Math.floor(v)));
      }
      else if (cid === 'cc_toggle_levelup') {
        const cur = configManager.getConfigValue(guildId, 'notifications.levelUp.enabled');
        configManager.updateConfigValue(guildId, 'notifications.levelUp.enabled', !cur);
      }
      else if (cid === 'cc_toggle_achieve') {
        const cur = configManager.getConfigValue(guildId, 'notifications.achievements.enabled');
        configManager.updateConfigValue(guildId, 'notifications.achievements.enabled', !cur);
      }

      // Mise à jour du panel après modification
      await sent.edit({ components: [refresh()], flags: FLAGS }).catch(() => {});
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'user') {
        sent.edit({ components: [container(txt('⏰ Panel Casino expiré.'))], flags: FLAGS }).catch(() => {});
      }
    });
  }
};
