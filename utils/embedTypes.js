/**
 * ╔══════════════════════════════════════════════════════════════════╗
 *  EMBED TYPES — Zoom Bot
 *  Système centralisé de types d'embeds.
 *  Chaque "type" définit l'apparence de toute une famille d'embeds.
 *
 *  TYPES DISPONIBLES :
 *   • MOD      → ban, kick, mute, warn, timeout, softban…
 *   • DM       → messages privés envoyés aux membres sanctionnés
 *   • ERROR    → permission refusée, membre introuvable, usage incorrect
 *   • SUCCESS  → action réussie, confirmation
 *   • INFO     → informations, stats, aide
 *   • CONFIG   → menus de configuration (logs, welcome, leave…)
 *   • CASINO   → jeux, pari, économie
 *   • LEVEL    → niveaux, XP, classements
 *
 *  UTILISATION dans une commande :
 *   const ET = require('../../utils/embedTypes');
 *   const embed = ET.build(message.guild.id, 'MOD', {
 *     title: 'Bannissement',
 *     fields: [...],
 *     emoji: ET.emoji('MOD', 'ban'),
 *   });
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const { EmbedBuilder, ButtonStyle } = require('discord.js');
const db   = require('./simpledb');
const EMOJIS = require('./emojis');

// ─────────────────────────────────────────────────────────────────────────────
//  DÉFINITIONS PAR DÉFAUT
//  Chaque type possède :
//   color       : couleur hex de l'embed
//   titlePrefix : préfixe affiché avant le titre (emoji unicode ou texte)
//   showFooter  : afficher le footer timestamp
//   footerText  : texte du footer (vide = automatique)
//   thumbnail   : 'none' | 'author' | 'target' | 'guild'
//   layout      : 'compact' | 'normal' | 'detailed'
//                 compact  = description seulement
//                 normal   = description + fields
//                 detailed = title + description + fields + footer
//   btnPrimary  : style Discord des boutons principaux
//   btnDanger   : style Discord des boutons danger
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULTS = {
  MOD: {
    label:       'Modération',
    description: 'Embeds des actions de modération (ban, kick, mute, warn…)',
    color:       0xED4245,
    titlePrefix: '🔨',
    showFooter:  true,
    footerText:  '',
    thumbnail:   'target',
    layout:      'normal',
    btnPrimary:  'Danger',
    btnDanger:   'Danger',
  },
  DM: {
    label:       'Message Privé (sanction)',
    description: 'Embeds envoyés en DM aux membres sanctionnés',
    color:       0xFEE75C,
    titlePrefix: '📩',
    showFooter:  true,
    footerText:  '',
    thumbnail:   'guild',
    layout:      'normal',
    btnPrimary:  'Secondary',
    btnDanger:   'Danger',
  },
  ERROR: {
    label:       'Erreur',
    description: 'Permission refusée, membre introuvable, usage incorrect…',
    color:       0xED4245,
    titlePrefix: '❌',
    showFooter:  false,
    footerText:  '',
    thumbnail:   'none',
    layout:      'compact',
    btnPrimary:  'Secondary',
    btnDanger:   'Danger',
  },
  SUCCESS: {
    label:       'Succès',
    description: 'Confirmation d\'action, opération réussie',
    color:       0x57F287,
    titlePrefix: '✅',
    showFooter:  true,
    footerText:  '',
    thumbnail:   'none',
    layout:      'normal',
    btnPrimary:  'Success',
    btnDanger:   'Danger',
  },
  INFO: {
    label:       'Information',
    description: 'Statistiques, aide, informations générales',
    color:       0x5865F2,
    titlePrefix: 'ℹ️',
    showFooter:  true,
    footerText:  '',
    thumbnail:   'none',
    layout:      'detailed',
    btnPrimary:  'Primary',
    btnDanger:   'Danger',
  },
  CONFIG: {
    label:       'Configuration',
    description: 'Menus de configuration (logs, welcome, leave, style…)',
    color:       0x1a1a1a,
    titlePrefix: '⚙️',
    showFooter:  true,
    footerText:  'Zoom Bot',
    thumbnail:   'none',
    layout:      'detailed',
    btnPrimary:  'Secondary',
    btnDanger:   'Danger',
  },
  CASINO: {
    label:       'Casino & Économie',
    description: 'Jeux, paris, transactions, crédits',
    color:       0xFFD700,
    titlePrefix: '🎰',
    showFooter:  true,
    footerText:  '',
    thumbnail:   'author',
    layout:      'normal',
    btnPrimary:  'Primary',
    btnDanger:   'Danger',
  },
  LEVEL: {
    label:       'Niveaux & XP',
    description: 'Montée de niveau, classements, récompenses',
    color:       0x9B59B6,
    titlePrefix: '⭐',
    showFooter:  true,
    footerText:  '',
    thumbnail:   'author',
    layout:      'detailed',
    btnPrimary:  'Primary',
    btnDanger:   'Danger',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  STOCKAGE DB
// ─────────────────────────────────────────────────────────────────────────────

function typeKey(guildId, type) { return `embedtype_${guildId}_${type}`; }

/** Retourne la config d'un type pour un serveur (fusion default + overrides) */
function getType(guildId, type) {
  const def      = DEFAULTS[type];
  if (!def) throw new Error(`Type d'embed inconnu : ${type}`);
  const override = db.get(typeKey(guildId, type)) || {};
  return Object.assign({}, def, override);
}

/** Enregistre une surcharge pour un type */
function setType(guildId, type, patch) {
  if (!DEFAULTS[type]) throw new Error(`Type inconnu : ${type}`);
  const current = db.get(typeKey(guildId, type)) || {};
  db.set(typeKey(guildId, type), Object.assign({}, current, patch));
}

/** Remet un type à ses valeurs par défaut */
function resetType(guildId, type) {
  db.delete(typeKey(guildId, type));
}

/** Remet tous les types à leurs valeurs par défaut */
function resetAll(guildId) {
  for (const type of Object.keys(DEFAULTS)) db.delete(typeKey(guildId, type));
}

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTRUCTEUR D'EMBED
// ─────────────────────────────────────────────────────────────────────────────

const BTN_MAP = {
  Primary:   ButtonStyle.Primary,
  Secondary: ButtonStyle.Secondary,
  Success:   ButtonStyle.Success,
  Danger:    ButtonStyle.Danger,
};

/**
 * Construit un EmbedBuilder selon le type configuré pour ce serveur.
 *
 * @param {string}  guildId
 * @param {string}  type       'MOD' | 'ERROR' | 'SUCCESS' | 'INFO' | 'CONFIG' | 'CASINO' | 'LEVEL' | 'DM'
 * @param {object}  opts
 *   @param {string}   opts.title         Titre (sans préfixe, ajouté auto)
 *   @param {string}   opts.description   Description
 *   @param {object[]} opts.fields        [{name, value, inline}]
 *   @param {string}   opts.thumbnail     URL de thumbnail (override config)
 *   @param {string}   opts.image         URL d'image principale
 *   @param {string}   opts.footerText    Override du footer
 *   @param {boolean}  opts.timestamp     Forcer timestamp (override config)
 *   @param {number}   opts.colorOverride Couleur hex forcée
 * @returns {EmbedBuilder}
 */
function build(guildId, type, opts = {}) {
  const cfg = getType(guildId, type);
  const {
    title         = null,
    description   = null,
    fields        = [],
    thumbnail     = null,
    image         = null,
    footerText    = null,
    timestamp     = null,
    colorOverride = null,
  } = opts;

  const e = new EmbedBuilder()
    .setColor(colorOverride ?? cfg.color);

  // Titre avec préfixe
  if (title !== null && title !== undefined) {
    const fullTitle = cfg.titlePrefix ? `${cfg.titlePrefix} ${title}` : title;
    e.setTitle(fullTitle.slice(0, 256));
  }

  // Description
  if (description) e.setDescription(description.slice(0, 4096));

  // Fields
  if (fields.length) {
    e.addFields(fields.slice(0, 25).map(f => ({
      name:   (f.name  || '\u200b').slice(0, 256),
      value:  (f.value || '\u200b').slice(0, 1024),
      inline: f.inline ?? false,
    })));
  }

  // Thumbnail
  if (thumbnail) e.setThumbnail(thumbnail);

  // Image
  if (image) e.setImage(image);

  // Footer
  const ft = footerText !== null ? footerText : cfg.footerText;
  if (cfg.showFooter || ft) {
    if (ft) e.setFooter({ text: ft.slice(0, 2048) });
    const doTimestamp = timestamp !== null ? timestamp : cfg.showFooter;
    if (doTimestamp) e.setTimestamp();
  }

  return e;
}

/**
 * Retourne le ButtonStyle discord.js pour un type.
 * role: 'primary' | 'danger'
 */
function btnStyle(guildId, type, role = 'primary') {
  const cfg  = getType(guildId, type);
  const name = role === 'danger' ? cfg.btnDanger : cfg.btnPrimary;
  return BTN_MAP[name] || ButtonStyle.Secondary;
}

/**
 * Retourne la couleur d'un type pour ce serveur.
 */
function color(guildId, type) {
  return getType(guildId, type).color;
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  DEFAULTS,
  getType,
  setType,
  resetType,
  resetAll,
  build,
  btnStyle,
  color,
};
