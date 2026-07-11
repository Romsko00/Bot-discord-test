const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, '../config.json');

/**
 * Recharge config.json depuis le disque et met à jour client.config pour tous les clients.
 * À utiliser après avoir modifié config.json (commande buyer, édition manuelle, etc.)
 * @returns {{ success: boolean, config?: object, error?: string }}
 */
function reloadConfigFromDisk() {
  let config;
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    config = JSON.parse(raw);
  } catch (e) {
    return { success: false, error: e.message || 'Impossible de lire config.json' };
  }

  const allClients = globalThis.allClients && Array.isArray(globalThis.allClients) ? globalThis.allClients : [];
  for (const client of allClients) {
    if (client && typeof client === 'object') {
      client.config = config;
    }
  }

  return { success: true, config };
}

module.exports = { reloadConfigFromDisk, CONFIG_PATH };
