const Discord = require('discord.js');
const { LogSystem } = require('../../utils/logSystem');

module.exports = async (client, messages, channel) => {
  try {
    const guild = channel?.guild || messages?.first()?.guild;
    if (!guild) return;

    const count = messages?.size || 0;
    const desc = [
      `**Suppression multiple de messages**`,
      `Salon : <#${channel.id}>`,
      `Total : ${count} messages`
    ].join('\n');

    const embed = new Discord.EmbedBuilder()
      .setColor(0xe74c3c)
      .setDescription(desc)
      .setFooter({ text: LogSystem.logTimestamp() });

    await LogSystem.sendEventLog(guild, 'MESSAGE', embed);
  } catch (e) {
    console.error('Erreur messageBulkDelete:', e);
  }
};
