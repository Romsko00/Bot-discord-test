/**
 * ═══════════════════════════════════════════════════════════
 *  STYLE MANAGER — Zoom Bot
 *  Gère les thèmes visuels par serveur/bot :
 *   - Couleurs d'embed (principale, succès, erreur, warning, info)
 *   - Style des boutons (Primary, Secondary, Success, Danger)
 *   - Format des titres (avec/sans emoji, majuscules)
 *   - Séparateur de description
 *   - Présence d'un footer custom
 *   - Densité (compact / normal / spacieux)
 * ═══════════════════════════════════════════════════════════
 */

const db = require('./simpledb');

// ── Thèmes prédéfinis ─────────────────────────────────────────────────────────

const THEMES = {
  default: {
    name: '⬛ Default',
    description: 'Thème sombre sobre, couleurs neutres',
    colors: {
      primary:  0x1a1a1a,
      success:  0x57F287,
      error:    0xED4245,
      warning:  0xFEE75C,
      info:     0x5865F2,
    },
    buttonStyles: {
      primary:   'Primary',
      secondary: 'Secondary',
      success:   'Success',
      danger:    'Danger',
    },
    titleFormat:  'normal',   // normal | upper | emoji_before | emoji_after
    separator:    '',         // séparateur après la description
    footerText:   '',         // texte par défaut du footer ('' = désactivé)
    density:      'normal',   // compact | normal | spacious
  },

  midnight: {
    name: '🌑 Midnight',
    description: 'Bleu nuit profond, ambiance premium',
    colors: {
      primary:  0x0d1117,
      success:  0x238636,
      error:    0xda3633,
      warning:  0xd29922,
      info:     0x1f6feb,
    },
    buttonStyles: {
      primary:   'Primary',
      secondary: 'Secondary',
      success:   'Success',
      danger:    'Danger',
    },
    titleFormat:  'emoji_before',
    separator:    '▬▬▬▬▬▬▬▬▬▬',
    footerText:   '',
    density:      'normal',
  },

  neon: {
    name: '💜 Neon',
    description: 'Violet électrique, style cyberpunk',
    colors: {
      primary:  0x9b59b6,
      success:  0x00ff88,
      error:    0xff0055,
      warning:  0xffcc00,
      info:     0x00ccff,
    },
    buttonStyles: {
      primary:   'Primary',
      secondary: 'Secondary',
      success:   'Success',
      danger:    'Danger',
    },
    titleFormat:  'upper',
    separator:    '━━━━━━━━━━',
    footerText:   '',
    density:      'spacious',
  },

  gold: {
    name: '🥇 Gold',
    description: 'Or élégant, style luxe',
    colors: {
      primary:  0xd4af37,
      success:  0x2ecc71,
      error:    0xe74c3c,
      warning:  0xf39c12,
      info:     0x3498db,
    },
    buttonStyles: {
      primary:   'Success',
      secondary: 'Secondary',
      success:   'Success',
      danger:    'Danger',
    },
    titleFormat:  'emoji_before',
    separator:    '✦ ✦ ✦',
    footerText:   '',
    density:      'spacious',
  },

  minimal: {
    name: '🤍 Minimal',
    description: 'Blanc épuré, design minimaliste',
    colors: {
      primary:  0xffffff,
      success:  0x27ae60,
      error:    0xe74c3c,
      warning:  0xf1c40f,
      info:     0x2980b9,
    },
    buttonStyles: {
      primary:   'Secondary',
      secondary: 'Secondary',
      success:   'Success',
      danger:    'Danger',
    },
    titleFormat:  'normal',
    separator:    '',
    footerText:   '',
    density:      'compact',
  },

  blood: {
    name: '🔴 Blood',
    description: 'Rouge intense, style agressif',
    colors: {
      primary:  0x8b0000,
      success:  0xff4500,
      error:    0xff0000,
      warning:  0xff6600,
      info:     0xff3366,
    },
    buttonStyles: {
      primary:   'Danger',
      secondary: 'Secondary',
      success:   'Success',
      danger:    'Danger',
    },
    titleFormat:  'upper',
    separator:    '═══════════',
    footerText:   '',
    density:      'normal',
  },

  ocean: {
    name: '🌊 Ocean',
    description: 'Bleu océan, style apaisant',
    colors: {
      primary:  0x006994,
      success:  0x00b4d8,
      error:    0xef233c,
      warning:  0xfca311,
      info:     0x0077b6,
    },
    buttonStyles: {
      primary:   'Primary',
      secondary: 'Secondary',
      success:   'Success',
      danger:    'Danger',
    },
    titleFormat:  'emoji_before',
    separator:    '〰〰〰〰〰',
    footerText:   '',
    density:      'normal',
  },

  forest: {
    name: '🌿 Forest',
    description: 'Vert forêt, style naturel',
    colors: {
      primary:  0x2d6a4f,
      success:  0x52b788,
      error:    0xc1121f,
      warning:  0xf4a261,
      info:     0x40916c,
    },
    buttonStyles: {
      primary:   'Success',
      secondary: 'Secondary',
      success:   'Success',
      danger:    'Danger',
    },
    titleFormat:  'normal',
    separator:    '·  ·  ·  ·  ·',
    footerText:   '',
    density:      'normal',
  },
};

// ── Clés DB ───────────────────────────────────────────────────────────────────

function styleKey(guildId)  { return `style_theme_${guildId}`;   }
function customKey(guildId) { return `style_custom_${guildId}`;  }

// ── API publique ──────────────────────────────────────────────────────────────

/**
 * Retourne le style actif pour un serveur.
 * Fusionne le thème de base avec les éventuelles surcharges custom.
 */
function getStyle(guildId) {
  const themeName = db.get(styleKey(guildId)) || 'default';
  const base      = THEMES[themeName] ? JSON.parse(JSON.stringify(THEMES[themeName])) : JSON.parse(JSON.stringify(THEMES.default));
  const custom    = db.get(customKey(guildId)) || {};

  // Fusion profonde
  if (custom.colors)       Object.assign(base.colors,       custom.colors);
  if (custom.buttonStyles) Object.assign(base.buttonStyles, custom.buttonStyles);
  if (custom.titleFormat  !== undefined) base.titleFormat  = custom.titleFormat;
  if (custom.separator    !== undefined) base.separator    = custom.separator;
  if (custom.footerText   !== undefined) base.footerText   = custom.footerText;
  if (custom.density      !== undefined) base.density      = custom.density;

  base._themeName = themeName;
  return base;
}

/** Applique un thème prédéfini */
function setTheme(guildId, themeName) {
  if (!THEMES[themeName]) return false;
  db.set(styleKey(guildId), themeName);
  return true;
}

/** Sauvegarde une surcharge custom */
function setCustom(guildId, patch) {
  const current = db.get(customKey(guildId)) || {};
  const merged  = deepMerge(current, patch);
  db.set(customKey(guildId), merged);
}

/** Remet à zéro les surcharges custom */
function resetCustom(guildId) {
  db.delete(customKey(guildId));
}

/** Remet à zéro thème + custom */
function resetAll(guildId) {
  db.delete(styleKey(guildId));
  db.delete(customKey(guildId));
}

// ── Helpers pour construire les embeds / boutons ──────────────────────────────

const { EmbedBuilder, ButtonStyle } = require('discord.js');

const BUTTON_STYLE_MAP = {
  Primary:   ButtonStyle.Primary,
  Secondary: ButtonStyle.Secondary,
  Success:   ButtonStyle.Success,
  Danger:    ButtonStyle.Danger,
};

/**
 * Retourne la couleur selon le type demandé.
 * type: 'primary' | 'success' | 'error' | 'warning' | 'info'
 */
function color(guildId, type = 'primary') {
  const s = getStyle(guildId);
  return s.colors[type] || s.colors.primary;
}

/**
 * Retourne le ButtonStyle discord.js selon le rôle du bouton.
 * role: 'primary' | 'secondary' | 'success' | 'danger'
 */
function btnStyle(guildId, role = 'primary') {
  const s    = getStyle(guildId);
  const name = s.buttonStyles[role] || 'Primary';
  return BUTTON_STYLE_MAP[name] || ButtonStyle.Primary;
}

/**
 * Formate un titre selon le paramètre titleFormat du style.
 * emoji: optionnel, affiché avant/après selon le format
 */
function formatTitle(guildId, title, emoji = '') {
  const s = getStyle(guildId);
  switch (s.titleFormat) {
    case 'upper':        return title.toUpperCase();
    case 'emoji_before': return emoji ? `${emoji} ${title}` : title;
    case 'emoji_after':  return emoji ? `${title} ${emoji}` : title;
    default:             return title;
  }
}

/**
 * Ajoute le séparateur + espacement selon la densité au texte de description.
 * Utile pour ajouter une ligne visuelle entre sections.
 */
function sep(guildId) {
  const s = getStyle(guildId);
  if (!s.separator) return '';
  return `\n${s.separator}\n`;
}

/**
 * Retourne le texte du footer s'il est configuré, ou null.
 */
function footer(guildId, defaultText = '') {
  const s = getStyle(guildId);
  return s.footerText || defaultText || null;
}

/**
 * Crée un EmbedBuilder pré-configuré selon le style du serveur.
 * options: { title, description, type, emoji, fields, thumbnail, image, timestamp, footerOverride }
 */
function embed(guildId, options = {}) {
  const {
    title         = null,
    description   = null,
    type          = 'primary',
    emoji         = '',
    fields        = [],
    thumbnail     = null,
    image         = null,
    timestamp     = false,
    footerOverride = null,
  } = options;

  const e = new EmbedBuilder().setColor(color(guildId, type));

  if (title)       e.setTitle(formatTitle(guildId, title, emoji));
  if (description) e.setDescription(description);
  if (thumbnail)   e.setThumbnail(thumbnail);
  if (image)       e.setImage(image);
  if (timestamp)   e.setTimestamp();
  if (fields.length) e.addFields(fields);

  const ft = footerOverride !== null ? footerOverride : footer(guildId);
  if (ft) e.setFooter({ text: ft });

  return e;
}

// ── Utilitaires internes ──────────────────────────────────────────────────────

function deepMerge(target, source) {
  const out = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  THEMES,
  getStyle,
  setTheme,
  setCustom,
  resetCustom,
  resetAll,
  color,
  btnStyle,
  formatTitle,
  sep,
  footer,
  embed,
};
