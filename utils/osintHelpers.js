/**
 * Helpers partagés pour les commandes OSINT : permissions, crédits, abonnés, et adaptateur interaction → message.
 */

const db = require('./simpledb');

const OSINT_COST = 5;
const OSINT_ABONNE_KEY = 'osint_abonne_';

/**
 * Vérifie si un utilisateur est abonné OSINT (ajouté via /abonnement).
 */
function isOsintAbonne(userId) {
  return db.has(OSINT_ABONNE_KEY + userId);
}

/**
 * Ajoute un abonné OSINT avec des crédits.
 */
function addOsintAbonne(userId, credits, addedBy) {
  const data = {
    credits: Number(credits) || 0,
    addedAt: Date.now(),
    addedBy: addedBy || null
  };
  db.set(OSINT_ABONNE_KEY + userId, data);
  const baseCredits = db.get(`user_credits_${userId}`) || 0;
  db.set(`user_credits_${userId}`, baseCredits + data.credits);
  return data;
}

/**
 * Récupère les infos d'un abonné.
 */
function getOsintAbonne(userId) {
  return db.get(OSINT_ABONNE_KEY + userId);
}

/**
 * Calcule le total des crédits disponibles pour un utilisateur (base + daily + bonus niveau).
 */
function getCredits(userId, guildId) {
  const level = db.get(`guild_${guildId}_level_${userId}`) || 1;
  const baseCredits = db.get(`user_credits_${userId}`) || 0;
  const dailyCredits = db.get(`daily_credits_${userId}`) || 0;
  const levelBonus = level * 2;
  return baseCredits + dailyCredits + levelBonus;
}

/**
 * Vérifie si l'utilisateur a la permission d'utiliser les commandes OSINT.
 * Superadmin : toujours autorisé.
 * Autres : doivent être abonnés via /abonnement (salon public, rôles, owner ne suffisent plus).
 */
function checkOsintPermission(client, messageOrInteraction) {
  const guild = messageOrInteraction.guild;
  const authorId = messageOrInteraction.author?.id || messageOrInteraction.user?.id;

  if (!guild) return true;

  const superadmin = client.config?.superadmin || [];
  if (Array.isArray(superadmin) && superadmin.includes(authorId)) return true;

  return isOsintAbonne(authorId);
}

/**
 * Déduit des crédits (base uniquement).
 */
function deductCredits(userId, amount) {
  db.subtract(`user_credits_${userId}`, amount);
}

/**
 * Construit un objet "message-like" à partir d'une interaction slash pour réutiliser command.run().
 * Premier reply/send -> editReply, suivants -> followUp.
 * Pour les commandes qui font loadingMsg.edit(), on retourne un proxy avec edit() qui appelle editReply
 * afin d'éviter l'erreur "Interaction has already been acknowledged".
 */
function buildMessageFromInteraction(interaction) {
  const user = interaction.user;
  const rawGuild = interaction.guild;
  const rawMember = interaction.member;
  let replied = false;

  const guild = rawGuild || { id: interaction.guildId || '0', name: 'DM' };
  const member = rawMember
    ? {
        ...rawMember,
        id: rawMember.id,
        user: rawMember.user || user,
        roles: {
          cache: rawMember.roles?.cache ?? new Map()
        }
      }
    : {
        id: user?.id,
        user,
        roles: { cache: new Map() }
      };

  const doReply = async (options) => {
    const opts = typeof options === 'string' ? { content: options } : options;
    if (!replied) {
      replied = true;
      const replyOpts = { ...opts, fetchReply: true };
      const result = interaction.deferred
        ? await interaction.editReply(replyOpts).catch(() => null)
        : await interaction.reply(replyOpts).catch(() => null);
      return createEditableProxy(interaction, result);
    }
    return interaction.followUp(opts).catch(() => null);
  };

  return {
    author: user,
    guild,
    member,
    channel: {
      send: async (options) => doReply(options),
      id: interaction.channel?.id
    },
    reply: async (options) => doReply(options)
  };
}

/**
 * Crée un proxy pour le premier message afin que loadingMsg.edit() appelle interaction.editReply
 * au lieu de Message.edit (évite "Interaction has already been acknowledged").
 */
function createEditableProxy(interaction, realMessage) {
  return {
    edit: async (options) => {
      const opts = typeof options === 'string' ? { content: options } : options;
      return interaction.editReply(opts).catch(() => null);
    },
    ...(realMessage || {})
  };
}

/**
 * Répond avec un embed "crédits insuffisants".
 */
async function replyInsufficientCredits(replyFn, cost, totalCredits) {
  const Discord = require('discord.js');
  const embed = new Discord.EmbedBuilder()
    .setTitle('<a:_:1483497365863399536> Crédits insuffisants')
    .setDescription('Vous n\'avez pas assez de crédits pour cette commande OSINT.')
    .addFields(
      { name: '💰 Coût', value: `${cost} crédits`, inline: true },
      { name: '💳 Vos crédits', value: `${totalCredits} crédits`, inline: true }
    )
    .setColor(0xff0000);
  return replyFn({ embeds: [embed] });
}

module.exports = {
  OSINT_COST,
  getCredits,
  checkOsintPermission,
  deductCredits,
  buildMessageFromInteraction,
  replyInsufficientCredits,
  isOsintAbonne,
  addOsintAbonne,
  getOsintAbonne
};
