/**
 * embedBuilder.js
 * Toutes les commandes de modération passent par buildModMessage()
 * qui génère un message texte simple (style image) qui disparaît après 4s.
 */

const { EmbedBuilder } = require('discord.js');
const EMOJIS_RAW = require('./emojis');

// ── Alias rétrocompatibles ────────────────────────────────────────────────────
const EMOJIS = {
  fichier:    EMOJIS_RAW.FOLDER,
  courone:    EMOJIS_RAW.CROWN,
  non:        EMOJIS_RAW.ERROR,
  oui:        EMOJIS_RAW.SUCCESS,
  reglement:  EMOJIS_RAW.INFO,
  temps:      EMOJIS_RAW.TIMER,
  banni:      EMOJIS_RAW.BAN,
  chargement: EMOJIS_RAW.LOADING,
  cloche:     EMOJIS_RAW.NOTIF,
  alerte:     EMOJIS_RAW.WARNING,
  fleche:     EMOJIS_RAW.ARROW,
  suivant:    EMOJIS_RAW.SUIVANT,
  precedent:  EMOJIS_RAW.PRECEDENT,
  active:     EMOJIS_RAW.ON,
  desactive:  EMOJIS_RAW.OFF,
  dnd:        EMOJIS_RAW.DND,
  idle:       EMOJIS_RAW.IDLE,
  streaming:  EMOJIS_RAW.STREAMING,
  online:     EMOJIS_RAW.ONLINE,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function msToHuman(ms) {
  if (!ms) return null;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h >= 24) return `${Math.floor(h / 24)}j ${h % 24}h`;
  if (h > 0)   return `${h}h ${m % 60}m`;
  if (m > 0)   return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function getActionLabel(action) {
  const a = action.toLowerCase();
  if (a.includes('softban'))      return 'softban';
  if (a.includes('unban') || a.includes('déban')) return 'unban';
  if (a.includes('ban'))          return 'ban';
  if (a.includes('kick'))         return 'kick';
  if (a.includes('unmute') || a.includes('untimeout')) return 'unmute';
  if (a.includes('mute') || a.includes('timeout'))     return 'mute';
  if (a.includes('warn'))         return 'warn';
  if (a.includes('lock'))         return 'lock';
  if (a.includes('unlock'))       return 'unlock';
  if (a.includes('clear'))        return 'clear';
  return action.toLowerCase();
}

// ── FORMAT IMAGE ──────────────────────────────────────────────────────────────
//
//  Rendu exact de l'image :
//  @Xenon a été ban pour Aucune raison spécifiée
//
//  Avec la mention de la cible en gras, l'action en gras, la raison encadrée.
//
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construit le contenu texte au format de l'image.
 * Retourne la string prête à envoyer.
 */
function buildModContent({ action, target, reason, duration }) {
  const label    = getActionLabel(action);
  const mention  = target?.toString?.() || (target?.id ? `<@${target.id}>` : '**Inconnu**');
  const raison   = reason || 'Aucune raison spécifiée';
  const durStr   = duration ? ` (${msToHuman(duration)})` : '';

  // Format : @Xenon a été ban pour Aucune raison spécifiée
  return `${mention} a été **${label}**${durStr} pour \`${raison}\``;
}

// ─────────────────────────────────────────────────────────────────────────────
//  sendModMessage — envoie le message mod et le supprime après 4s
//  Retourne la promesse du message envoyé.
// ─────────────────────────────────────────────────────────────────────────────

async function sendModMessage(message, { action, target, reason, duration }) {
  const content = buildModContent({ action, target, reason, duration });
  const sent    = await message.reply({ content, allowedMentions: { repliedUser: false } });
  setTimeout(() => sent.delete().catch(() => {}), 4_000);
  return sent;
}

// ─────────────────────────────────────────────────────────────────────────────
//  buildModEmbed — CONSERVÉ pour rétrocompatibilité
//  Retourne un EmbedBuilder simple (utilisé dans les logs de salon)
// ─────────────────────────────────────────────────────────────────────────────

function buildModEmbed({ action, guild, mod, target, reason, caseId, duration, color }) {
  const label     = getActionLabel(action);
  const targetTag = target?.user?.tag || target?.tag || 'Inconnu';
  const targetId  = target?.user?.id  || target?.id  || 'N/A';
  const modTag    = mod?.user?.tag    || mod?.tag    || 'Inconnu';
  const raison    = reason || 'Aucune raison fournie';
  const durStr    = duration ? `\n${EMOJIS_RAW.TIMER} **Durée :** ${msToHuman(duration)}` : '';
  const footer    = `Case #${caseId || 'N/A'} • ${new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

  return new EmbedBuilder()
    .setColor(color || 0xED4245)
    .setDescription(
      `${EMOJIS_RAW.USER} **Cible :** ${targetTag} (\`${targetId}\`)\n` +
      `${EMOJIS_RAW.STAFF} **Modérateur :** ${modTag}${durStr}\n\n` +
      `**Raison :** ${raison}`
    )
    .setFooter({ text: footer })
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────────────
//  buildDMEmbed — message privé envoyé à la cible
// ─────────────────────────────────────────────────────────────────────────────

function buildDMEmbed({ action, guild, reason, caseId, duration, user, mod }) {
  const label  = getActionLabel(action);
  const raison = reason || 'Aucune raison fournie';
  const durStr = duration ? `\n**Durée :** ${msToHuman(duration)}` : '';

  return new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle(`Vous avez été ${label}`)
    .setDescription(
      `Vous avez été sanctionné sur **${guild?.name || 'le serveur'}**.\n\n` +
      `**Action :** ${label}\n` +
      `**Raison :** ${raison}${durStr}\n\n` +
      `*Si vous souhaitez contester, contactez l'administration.*`
    )
    .setThumbnail(guild?.iconURL?.({ size: 128 }) || null)
    .setFooter({ text: `Case #${caseId || 'N/A'}` })
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers rapides
// ─────────────────────────────────────────────────────────────────────────────

function buildError(guildId, title, description) {
  return new EmbedBuilder().setColor(0xED4245).setTitle(`❌ ${title}`).setDescription(description).setTimestamp();
}
function buildSuccess(guildId, title, description) {
  return new EmbedBuilder().setColor(0x57F287).setTitle(`✅ ${title}`).setDescription(description).setTimestamp();
}
function buildInfo(guildId, title, description, fields = []) {
  const e = new EmbedBuilder().setColor(0x5865F2).setTitle(`ℹ️ ${title}`).setDescription(description).setTimestamp();
  if (fields.length) e.addFields(fields);
  return e;
}
function buildConfig(guildId, title, description, fields = []) {
  const e = new EmbedBuilder().setColor(0x1a1a1a).setTitle(`⚙️ ${title}`).setDescription(description).setTimestamp();
  if (fields.length) e.addFields(fields);
  return e;
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  sendModMessage,
  buildModContent,
  buildModEmbed,
  buildDMEmbed,
  buildError,
  buildSuccess,
  buildInfo,
  buildConfig,
  msToHuman,
  EMOJIS,
};
