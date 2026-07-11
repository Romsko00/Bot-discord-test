const { EmbedBuilder } = require('discord.js');
const { LogSystem } = require('../../utils/logSystem');

module.exports = async (client, message) => {
  try {
    if (message?.partial) {
      try { message = await message.fetch(); } catch (_) {}
    }
    const guild = message?.guild;
    if (!guild) return;
    if (message.author?.bot) return;
    if (!message.author) return;

    const content = (message.content || '').slice(0, 1500);
    const desc = [
      `**Message supprimé**`,
      `Auteur : ${message.author} (${message.author.id})`,
      `Salon : <#${message.channelId}>`,
      `Contenu : ${content || '—'}`
    ].join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setDescription(desc)
      .setFooter({ text: LogSystem.logTimestamp() });

    await LogSystem.sendEventLog(guild, 'MESSAGE', embed);
  } catch (e) {
    console.error('Erreur messageDelete:', e);
  }
};
