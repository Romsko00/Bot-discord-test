const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { LogSystem } = require('../../utils/logSystem');

module.exports = async (client, ban) => {
  try {
    const guild = ban.guild;
    const user = ban.user;

    let moderator = 'Inconnu';
    try {
      const fetchedLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 1 });
      const entry = fetchedLogs.entries.first();
      if (entry && entry.target?.id === user.id) {
        moderator = entry.executor?.tag || entry.executor?.id || 'Inconnu';
      }
    } catch (e) {
      console.error('Erreur fetch audit logs unban:', e);
    }

    const embed = new EmbedBuilder()
      .setColor(0x2e7d32)
      .setDescription(`**${user} a été débanni**\nPar : ${moderator}`)
      .setFooter({ text: LogSystem.logTimestamp() });

    const result = await LogSystem.sendEventLog(guild, 'MODERATION', embed);
    if (!result) {
      console.warn('[guildBanRemove] Salon de logs non configuré pour MODERATION');
    }
  } catch (e) {
    console.error('Erreur guildBanRemove:', e);
  }
};
