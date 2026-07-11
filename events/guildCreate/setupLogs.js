const LogSystem = require('../../utils/logSystem');

module.exports = async (client, guild) => {
  // Initialiser le système de logs pour ce serveur
  const logSystem = new LogSystem(client);
  
  try {
    await logSystem.setupGuildLogs(guild);
    console.log(`[LOGS] Système de logs configuré pour ${guild.name}`);
  } catch (error) {
    console.error(`[LOGS] Erreur lors de la configuration des logs pour ${guild.name}:`, error);
  }
};
