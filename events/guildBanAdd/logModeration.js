const LogSystem = require('../../utils/logSystem');

module.exports = async (client, ban) => {
  const logSystem = new LogSystem(client);
  
  // Récupérer l'audit log pour trouver qui a banni
  let executor = client.user;
  let reason = 'Aucune raison spécifiée';
  
  try {
    const auditLogs = await ban.guild.fetchAuditLogs({
      type: 22, // MEMBER_BAN_ADD
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
  
  await logSystem.logModeration(ban.guild, 'ban', executor, ban.user, reason, {
    caseId: Date.now().toString()
  });
};
