const LogSystem = require('../../utils/logSystem');

module.exports = async (client, oldChannel, newChannel) => {
  const logSystem = new LogSystem(client);
  
  // Récupérer l'auditor log pour trouver qui a modifié le salon
  let executor = client.user;
  try {
    const auditLogs = await newChannel.guild.fetchAuditLogs({
      type: 11, // CHANNEL_UPDATE
      limit: 1
    });
    
    const log = auditLogs.entries.first();
    if (log) {
      executor = log.executor;
    }
  } catch (error) {
    // Ignorer les erreurs de permissions
  }
  
  const changes = {};
  
  // Vérifier les changements
  if (oldChannel.name !== newChannel.name) {
    changes['Nom'] = `${oldChannel.name} → ${newChannel.name}`;
  }
  
  if (oldChannel.parent?.name !== newChannel.parent?.name) {
    changes['Catégorie'] = `${oldChannel.parent?.name || 'Aucune'} → ${newChannel.parent?.name || 'Aucune'}`;
  }
  
  if (oldChannel.topic !== newChannel.topic) {
    changes['Sujet'] = `${oldChannel.topic || 'Aucun'} → ${newChannel.topic || 'Aucun'}`;
  }
  
  if (oldChannel.nsfw !== newChannel.nsfw) {
    changes['NSFW'] = `${oldChannel.nsfw ? 'Oui' : 'Non'} → ${newChannel.nsfw ? 'Oui' : 'Non'}`;
  }
  
  // Si des changements ont été détectés
  if (Object.keys(changes).length > 0) {
    await logSystem.logChannel(newChannel.guild, 'update', newChannel, executor, changes);
  }
};
