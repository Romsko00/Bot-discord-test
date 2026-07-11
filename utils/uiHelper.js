// ═══════════════════════════════════════════════════════════════
//  SHARED UI HELPER — style boutons ➕ / compteur / ➖ / 🗑️
//  Utilisé par : autorole, wl, autorank, setrank, reward, limrole
// ═══════════════════════════════════════════════════════════════

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
  UserSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
} = require('discord.js');
const EMOJIS = require('./emojis');

const COLOR = 0x1a1a1a;

// Convertit <:_:ID> en objet { id, name, animated } pour .setEmoji()
function toE(str) {
  if (!str) return null;
  const m = str.match(/^<(a?):([^:]+):(\d+)>$/);
  if (m) return { animated: !!m[1], name: m[2], id: m[3] };
  return str;
}

/**
 * Construit la rangée de boutons principale style ghostping :
 *   ➕  |  n/max  |  ➖  |  🗑️
 *
 * @param {string}  addId    customId du bouton +
 * @param {string}  removeId customId du bouton -
 * @param {string}  clearId  customId du bouton 🗑️
 * @param {number}  count    nombre actuel
 * @param {number}  max      maximum (0 = illimité)
 */
function buildActionRow(addId, removeId, clearId, count, max = 0) {
  const atMax   = max > 0 && count >= max;
  const isEmpty = count === 0;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(addId)
      .setEmoji('➕')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(atMax),

    new ButtonBuilder()
      .setCustomId('__count__')
      .setLabel(max > 0 ? `${count}/${max}` : `${count}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),

    new ButtonBuilder()
      .setCustomId(removeId)
      .setEmoji('➖')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isEmpty),

    new ButtonBuilder()
      .setCustomId(clearId)
      .setEmoji(toE(EMOJIS.BAN))
      .setStyle(ButtonStyle.Danger)
      .setDisabled(isEmpty),
  );
}

/** Rangée retour simple */
function buildBackRow(backId = 'back') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(backId)
      .setEmoji(toE(EMOJIS.RETOUR))
      .setStyle(ButtonStyle.Secondary),
  );
}

module.exports = { COLOR, toE, buildActionRow, buildBackRow };
