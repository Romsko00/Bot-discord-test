const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { LogSystem } = require('../../utils/logSystem');

module.exports = async (client, ban) => {
  try {
    const guild = ban.guild;
    const user = ban.user;

    let moderator = 'Inconnu';
    let reason = ban.reason || 'Aucune raison';
    
    try {
      const fetchedLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
      const entry = fetchedLogs.entries.first();
      if (entry && entry.target?.id === user.id) {
        moderator = entry.executor?.tag || entry.executor?.id || 'Inconnu';
        reason = entry.reason || 'Aucune raison';
      }
    } catch (e) {
      console.error('Erreur fetch audit logs ban:', e);
    }

    const embed = new EmbedBuilder()
      .setColor(0xb71c1c)
      .setDescription(`**${user} a été banni**\nPar : ${moderator}\nRaison : ${reason}`)
      .setFooter({ text: LogSystem.logTimestamp() });

    const result = await LogSystem.sendEventLog(guild, 'MODERATION', embed);
    if (!result) {
      console.warn('[guildBanAdd] Salon de logs non configuré pour MODERATION');
    }

  } catch (e) {
    console.error('Erreur guildBanAdd:', e);
  }
};
