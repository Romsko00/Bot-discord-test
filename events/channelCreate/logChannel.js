const LogSystem = require('../../utils/logSystem');

module.exports = async (client, channel) => {
  const logSystem = new LogSystem(client);
  
  // Récupérer l'auditor log pour trouver qui a créé le salon
  let executor = client.user;
  try {
    const auditLogs = await channel.guild.fetchAuditLogs({
      type: 10, // CHANNEL_CREATE
      limit: 1
    });
    
    const log = auditLogs.entries.first();
    if (log) {
      executor = log.executor;
    }
  } catch (error) {
    // Ignorer les erreurs de permissions
  }
  
  const changes = {
    'Type': channel.type === 0 ? 'Textuel' : channel.type === 2 ? 'Vocal' : 'Autre',
    'Catégorie': channel.parent?.name || 'Aucune',
    'NSFW': channel.nsfw ? 'Oui' : 'Non'
  };
  
  await logSystem.logChannel(channel.guild, 'create', channel, executor, changes);
};
