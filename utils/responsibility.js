/**
 * Logique partagée d'attribution de responsabilité par guilde.
 * Chaque bot répond à tous les serveurs où il est invité, indépendamment des autres bots.
 */

function hashStringToInt(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Crée la fonction isResponsibleForGuild pour un client.
 * Chaque bot est responsable de TOUS les serveurs où il est présent.
 * Cela permet d'utiliser les bots sur plusieurs serveurs simultanément.
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Client[]} [fallbackList]
 * @returns {(guildId: string) => boolean}
 */
function createIsResponsibleForGuild(client, fallbackList = []) {
  return function isResponsibleForGuild(guildId) {
    if (!guildId) return true;
    if (!client.readyAt) return false;
    // Chaque bot répond à tous les serveurs où il est invité, indépendamment des autres bots
    return true;
  };
}

module.exports = {
  hashStringToInt,
  createIsResponsibleForGuild
};
