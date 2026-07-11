const { EmbedBuilder } = require('discord.js');
const { LogSystem } = require('../../utils/logSystem');

module.exports = async (client, oldMember, newMember) => {
  try {
    const guild = newMember.guild;
    const user = newMember.user;

    const oldBoosting = oldMember.premiumSince;
    const newBoosting = newMember.premiumSince;

    if (!oldBoosting && newBoosting) {
      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setDescription(`**${user} a boosté le serveur**`)
        .setFooter({ text: LogSystem.logTimestamp() });
      await LogSystem.sendEventLog(guild, 'BOOST', embed);
    } else if (oldBoosting && !newBoosting) {
      const embed = new EmbedBuilder()
        .setColor(0x757575)
        .setDescription(`**${user} a retiré son boost**`)
        .setFooter({ text: LogSystem.logTimestamp() });
      await LogSystem.sendEventLog(guild, 'BOOST', embed);
    }
  } catch (e) {
    console.error('Erreur guildBoost:', e);
  }
};
