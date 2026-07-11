const Discord = require('discord.js');
const { LogSystem } = require('../../utils/logSystem');

module.exports = async (client, member) => {
  try {
    const guild = member.guild;
    const user = member.user;

    let executor = null;
    let leaveType = 'a quitté le serveur';

    try {
      const banLogs = await guild.fetchAuditLogs({ type: Discord.AuditLogEvent.MemberBanAdd, limit: 1 });
      const banEntry = banLogs.entries.first();
      if (banEntry && banEntry.target?.id === member.id) {
        executor = banEntry.executor;
        leaveType = 'a été banni';
      } else {
        const kickLogs = await guild.fetchAuditLogs({ type: Discord.AuditLogEvent.MemberKick, limit: 1 });
        const kickEntry = kickLogs.entries.first();
        if (kickEntry && kickEntry.target?.id === member.id) {
          executor = kickEntry.executor;
          leaveType = 'a été expulsé';
        }
      }
    } catch (_) {}

    let desc = `**${user} ${leaveType}**`;
    if (executor) {
      desc += `\n${leaveType.includes('banni') ? 'Banni' : 'Expulsé'} par : ${executor}`;
    }

    const color = leaveType.includes('banni') ? 0xb71c1c : leaveType.includes('expulsé') ? 0xe65100 : 0x6d4c41;
    const embed = new Discord.EmbedBuilder()
      .setColor(color)
      .setDescription(desc)
      .setFooter({ text: LogSystem.logTimestamp() });

    await LogSystem.sendEventLog(guild, 'FLUX', embed);
  } catch (e) {
    console.error('Erreur guildMemberRemove:', e);
  }
};
