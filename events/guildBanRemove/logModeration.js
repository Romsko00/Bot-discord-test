const LogSystem = require('../../utils/logSystem');

module.exports = async (client, ban) => {
  const logSystem = new LogSystem(client);
  
  // Récupérer l'audit log pour trouver qui a débanni
  let executor = client.user;
  let reason = 'Aucune raison spécifiée';
  
  try {
    const auditLogs = await ban.guild.fetchAuditLogs({
      type: 23, // MEMBER_BAN_REMOVE
      limit: 1
    });
    
    const log = auditLogs.entries.first();
    if (log) {
      executor = log.executor;
      reason = log.reason || reason;
    }
  } catch (error) {
    // Ignorer les erreurs de permissions
  }
  
  await logSystem.logModeration(ban.guild, 'unban', executor, ban.user, reason, {
    caseId: Date.now().toString()
  });
};
