const { EmbedBuilder, AuditLogEvent, ChannelType } = require('discord.js');
const { LogSystem } = require('../../utils/logSystem');

module.exports = async (client, channel) => {
  try {
    if (!channel.guild) return;
    const guild = channel.guild;

    let executor = null;
    try {
      const logs = await guild.fetchAuditLogs({ 
        type: AuditLogEvent.ChannelCreate, 
        limit: 1 
      });
      const entry = logs.entries.first();
      if (entry && entry.target?.id === channel.id) {
        executor = entry.executor;
      }
    } catch (e) {
      console.error('Erreur fetch audit logs channel create:', e);
    }

    const by = executor ? executor.toString() : 'Inconnu';
    const desc = `**Salon créé :** ${channel}\nPar : ${by}`;
    const embed = new EmbedBuilder()
      .setColor(0x2e7d32)
      .setDescription(desc)
      .setFooter({ text: LogSystem.logTimestamp() });

    await LogSystem.sendEventLog(guild, 'CHANNEL', embed);

  } catch (e) {
    console.error('Erreur channelCreate:', e);
  }
};
