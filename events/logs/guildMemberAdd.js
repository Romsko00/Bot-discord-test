const { EmbedBuilder } = require('discord.js');
const { LogSystem } = require('../../utils/logSystem');

module.exports = async (client, member) => {
  try {
    const guild = member.guild;
    const user = member.user;

    const embed = new EmbedBuilder()
      .setColor(0x2d7d46)
      .setDescription(`**${user} a rejoint le serveur**`)
      .setFooter({ text: LogSystem.logTimestamp() });

    await LogSystem.sendEventLog(guild, 'FLUX', embed);
  } catch (e) {
    console.error('Erreur guildMemberAdd:', e);
  }
};
