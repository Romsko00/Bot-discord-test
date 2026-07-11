const { EmbedBuilder } = require('discord.js');
const EMOJIS = require('./emojis');

/**
 * 🎨 Design System pour Zoom Bot - Prestigieux & Élégant
 * 
 * Palette de couleurs sophistiquées :
 * - PRIMARY: Noir élégant #0a0a0a
 * - SECONDARY: Gris foncé #1a1a1a
 * - ACCENT: Or subtil #d4af37
 * - SUCCESS: Vert sophistiqué #2d5016
 * - ERROR: Rouge sombre #8b0000
 * - WARNING: Ambre #ff8c00
 * - INFO: Bleu nuit #1e3a8a
 */

const COLORS = {
  PRIMARY: 0x0a0a0a,      // Noir profond
  SECONDARY: 0x1a1a1a,    // Gris anthracite
  ACCENT: 0xd4af37,       // Or élégant
  SUCCESS: 0x2d5016,      // Vert forêt
  ERROR: 0x8b0000,        // Rouge cardinal
  WARNING: 0xff8c00,      // Ambre
  INFO: 0x1e3a8a,         // Bleu nuit
  NEUTRAL: 0x2b2d31,      // Gris Discord
  GOLD: 0xffd700,         // Or brillant
  PLATINUM: 0xe5e4e2,     // Platine
  DIAMOND: 0xb9f2ff       // Diamant
};

/** Limites Discord pour les embeds (éviter "Invalid string length") */
const MAX_EMBED_TITLE = 256;
const MAX_EMBED_DESCRIPTION = 4096;
const MAX_EMBED_FIELD_NAME = 256;
const MAX_EMBED_FIELD_VALUE = 1024;
const MAX_EMBED_FOOTER = 2048;
const MAX_EMBED_AUTHOR_NAME = 256;

/**
 * Tronque une chaîne pour rester sous la limite Discord.
 * @param {string|null|undefined} str
 * @param {number} max
 * @returns {string}
 */
function trunc(str, max = 1024) {
  if (str == null) return '';
  const s = String(str);
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}


/**
 * Créer un embed de base avec le style Zoom
 */
const { replaceEmojiNames } = require('./emojis');

function createEmbed(options = {}) {
  const {
    title = null,
    description = null,
    color = COLORS.PRIMARY,
    footer = null,
    timestamp = false,
    author = null,
    thumbnail = null,
    image = null,
    fields = []
  } = options;

  const embed = new EmbedBuilder()
    .setColor(color);

  if (title) {
    embed.setTitle(replaceEmojiNames(title.length > 256 ? title.substring(0, 253) + '...' : title));
  }

  if (description) {
    embed.setDescription(replaceEmojiNames(description.length > 4096 ? description.substring(0, 4093) + '...' : description));
  }

  if (footer) {
    const footerText = typeof footer === 'string' ? footer : (footer.text || '');
    const safeFooterText = (footerText.length > 2048 ? footerText.substring(0, 2045) + '...' : footerText);
    embed.setFooter(typeof footer === 'string' ? { text: replaceEmojiNames(safeFooterText) } : { ...footer, text: replaceEmojiNames(safeFooterText) });
  }

  if (timestamp) {
    embed.setTimestamp();
  }

  if (author) {
    const authorName = typeof author === 'string' ? author : (author.name || '');
    const safeAuthorName = (authorName.length > 256 ? authorName.substring(0, 253) + '...' : authorName);
    embed.setAuthor(typeof author === 'string' ? { name: replaceEmojiNames(safeAuthorName) } : { ...author, name: replaceEmojiNames(safeAuthorName) });
  }

  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }

  if (image) {
    embed.setImage(image);
  }

  if (fields && fields.length > 0) {
    // Limite de 25 fields dans Discord
    const validFields = fields.slice(0, 25).map(field => ({
      name: replaceEmojiNames((field.name || '​').length > 256 ? field.name.substring(0, 253) + '...' : field.name || '​'),
      value: replaceEmojiNames((field.value || '​').length > 1024 ? field.value.substring(0, 1021) + '...' : field.value || '​'),
      inline: field.inline !== undefined ? field.inline : false
    }));
    embed.addFields(validFields);
  }

  return embed;
}

/**
 * Embed de succès élégant
 */
function successEmbed(title, description, options = {}) {
  return createEmbed({
    title: `${EMOJIS.SUCCESS} ${title}`,
    description,
    color: COLORS.SUCCESS,
    timestamp: true,
    ...options
  });
}

/**
 * Embed d'erreur simple et efficace (sans emoji ni footer par défaut)
 * Appel: errorEmbed(description) ou errorEmbed(title, description)
 */
function errorEmbed(title, description, options = {}) {
  const desc = description !== undefined ? description : title;
  const tit = description !== undefined ? title : null;
  return createEmbed({
    title: tit ? tit : null,
    description: desc,
    color: COLORS.ERROR,
    timestamp: false,
    ...options
  });
}

const ERROR_DELETE_AFTER_MS = 6000;

/**
 * Répond avec un message d'erreur simple et supprime après quelques secondes (messages) ou en ephemeral (interactions).
 * @param {Message|CommandInteraction} source
 * @param {string} text - Texte court (ex: "Permission refusée." ou "Commande introuvable.")
 * @param {{ deleteAfter?: number }} options - deleteAfter en ms (défaut 6000), 0 = ne pas supprimer
 * @returns {Promise<Message|void>}
 */
async function replyError(source, text, options = {}) {
  const deleteAfter = options.deleteAfter ?? ERROR_DELETE_AFTER_MS;
  const content = typeof text === 'string' ? text : (text?.message || 'Une erreur est survenue.');
  const isInteraction = typeof source.reply === 'function' && 'deferred' in source;
  if (isInteraction) {
    const interaction = source;
    try {
      if (interaction.deferred) return await interaction.editReply({ content, embeds: [], components: [] }).catch(() => null);
      return await interaction.reply({ content, ephemeral: true }).catch(() => null);
    } catch (_) { return null; }
  }
  const message = source;
  try {
    const reply = await message.reply({ content });
    if (deleteAfter > 0) setTimeout(() => reply.delete().catch(() => {}), deleteAfter);
    return reply;
  } catch (_) { return null; }
}

/**
 * Répond avec un embed d'erreur minimal puis supprime le message après quelques secondes.
 * @param {Message} message
 * @param {string} description - Texte court
 * @param {{ deleteAfter?: number }} options - deleteAfter en ms (défaut 6000)
 */
async function replyErrorEmbed(message, description, options = {}) {
  const deleteAfter = options.deleteAfter ?? ERROR_DELETE_AFTER_MS;
  const embed = new EmbedBuilder().setColor(COLORS.ERROR).setDescription(description);
  try {
    const reply = await message.reply({ embeds: [embed] });
    if (deleteAfter > 0) setTimeout(() => reply.delete().catch(() => {}), deleteAfter);
    return reply;
  } catch (_) { return null; }
}

/**
 * Embed d'avertissement
 */
function warningEmbed(title, description, options = {}) {
  return createEmbed({
    title: `${EMOJIS.WARNING} ${title}`,
    description,
    color: COLORS.WARNING,
    timestamp: true,
    ...options
  });
}

/**
 * Embed d'information
 */
function infoEmbed(title, description, options = {}) {
  return createEmbed({
    title: `${EMOJIS.INFO} ${title}`,
    description,
    color: COLORS.INFO,
    timestamp: true,
    ...options
  });
}

/**
 * Embed de configuration/paramètres
 */
function configEmbed(title, options = {}) {
  return createEmbed({
    title: `${EMOJIS.SETTINGS} ${title}`, // Uses Dossier or Ding
    color: COLORS.PRIMARY,
    timestamp: true,
    footer: { text: 'Zoom Bot • Configuration' },
    ...options
  });
}

/**
 * Embed pour statistiques
 */
function statsEmbed(title, options = {}) {
  return createEmbed({
    title: `${EMOJIS.STATS} ${title}`,
    color: COLORS.ACCENT,
    timestamp: true,
    footer: { text: 'Zoom Bot • Statistiques' },
    ...options
  });
}

/**
 * Embed pour profil utilisateur
 */
function profileEmbed(user, options = {}) {
  return createEmbed({
    author: {
      name: user.displayName || user.username,
      iconURL: user.displayAvatarURL({ dynamic: true })
    },
    color: COLORS.ACCENT,
    timestamp: true,
    thumbnail: user.displayAvatarURL({ dynamic: true, size: 256 }),
    footer: { text: `ID: ${user.id}` },
    ...options
  });
}

/**
 * Embed pour casino - style luxe
 */
function casinoEmbed(title, options = {}) {
  return createEmbed({
    title: `${EMOJIS.COIN} ${title}`,
    color: COLORS.GOLD,
    footer: { text: 'Zoom Casino • Jouez responsablement' },
    ...options
  });
}

/**
 * Embed pour level up
 */
function levelUpEmbed(user, level, options = {}) {
  return createEmbed({
    title: `${EMOJIS.LEVEL} Niveau Supérieur`,
    description: `**${user.username}** vient d'atteindre le niveau **${level}**`,
    color: COLORS.ACCENT,
    thumbnail: user.displayAvatarURL({ dynamic: true }),
    timestamp: true,
    ...options
  });
}

/**
 * Embed pour modération
 */
function moderationEmbed(action, target, moderator, reason, options = {}) {
  return createEmbed({
    title: `${action}`,
    color: COLORS.WARNING,
    fields: [
      { name: 'Utilisateur', value: `${target}`, inline: true },
      { name: 'Modérateur', value: `${moderator}`, inline: true },
      { name: 'Raison', value: reason || 'Aucune raison fournie', inline: false }
    ],
    timestamp: true,
    footer: { text: `ID: ${target.id || 'N/A'}` },
    ...options
  });
}

/**
 * Formatage de nombres élégant
 */
function formatNumber(num) {
  return new Intl.NumberFormat('fr-FR').format(num);
}

/**
 * Formatage de crédits/argent
 */
function formatCredits(amount) {
  return `${formatNumber(amount)} ${EMOJIS.COIN}`;
}

/**
 * Créer une barre de progression élégante
 */
function createProgressBar(current, max, length = 10) {
  const percentage = Math.min(Math.max(current / max, 0), 1);
  const filled = Math.floor(percentage * length);
  const empty = length - filled;

  const filledBar = '▰'.repeat(filled);
  const emptyBar = '▱'.repeat(empty);

  return `${filledBar}${emptyBar} ${Math.round(percentage * 100)}%`;
}

/**
 * Créer un divider élégant
 */
function divider(text = null) {
  if (text) {
    const side = '━'.repeat(Math.floor((20 - text.length) / 2));
    return `${side} ${text} ${side}`;
  }
  return '━'.repeat(40);
}

/**
 * Formater une liste avec style
 */
function formatList(items, prefix = EMOJIS.DOT) {
  return items.map(item => `${prefix} ${item}`).join('\n');
}

/**
 * Créer un field de statut
 */
function statusField(label, value, isPositive = null) {
  const emoji = isPositive === true ? EMOJIS.SUCCESS :
    isPositive === false ? EMOJIS.ERROR :
      EMOJIS.DOT;
  return {
    name: label,
    value: `${emoji} ${value}`,
    inline: true
  };
}

/**
 * Embed de permission denied
 */
function permissionDeniedEmbed() {
  return errorEmbed(
    'Accès Refusé',
    'Vous ne disposez pas des permissions nécessaires pour exécuter cette commande.',
    { footer: { text: 'Zoom Bot • Accès Restreint' }, title: `${EMOJIS.DENIED} Accès Refusé` }
  );
}

/**
 * Embed de cooldown
 */
function cooldownEmbed(timeLeft) {
  return warningEmbed(
    'Cooldown Actif',
    `Veuillez patienter **${timeLeft}** avant de réutiliser cette commande.`,
    { footer: { text: 'Zoom Bot • Limitation de débit' } }
  );
}

/**
 * Embed vide/loading
 */
function loadingEmbed(message = 'Chargement en cours...') {
  return createEmbed({
    description: `${EMOJIS.LOADING} ${message}`,
    color: COLORS.INFO
  });
}

module.exports = {
  // Fonctions de création
  createEmbed,
  successEmbed,
  errorEmbed,
  warningEmbed,
  infoEmbed,
  configEmbed,
  statsEmbed,
  profileEmbed,
  casinoEmbed,
  levelUpEmbed,
  moderationEmbed,
  permissionDeniedEmbed,
  cooldownEmbed,
  loadingEmbed,

  // Erreurs simples + auto-suppression
  replyError,
  replyErrorEmbed,
  ERROR_DELETE_AFTER_MS,

  // Utilitaires
  formatNumber,
  formatCredits,
  createProgressBar,
  divider,
  formatList,
  statusField,
  trunc,

  // Constants
  COLORS,
  EMOJIS,
  MAX_EMBED_TITLE,
  MAX_EMBED_DESCRIPTION,
  MAX_EMBED_FIELD_NAME,
  MAX_EMBED_FIELD_VALUE,
  MAX_EMBED_FOOTER,
  MAX_EMBED_AUTHOR_NAME
};
