const db = require('./simpledb');
const { EmbedBuilder } = require('discord.js');

function getRaidLogChannel(guild) {
  const channelId = db.get(`${guild.id}.raidlog`);
  if (!channelId) return null;
  return guild.channels.cache.get(channelId) || null;
}

async function sendRaidLog(guild, data) {
  try {
    const raidlog = getRaidLogChannel(guild);
    if (!raidlog) return false;

    const embed = new EmbedBuilder().
    setColor(data.color || guild.client.config.SETTINGS.EMBED_COLOR).
    setTitle(data.title || 'Alerte Antiraid').
    setDescription(data.description || '').
    setTimestamp(new Date());

    if (data.fields && Array.isArray(data.fields)) embed.addFields(data.fields);
    if (data.footer) embed.setFooter({ text: data.footer.text || data.footer, iconURL: data.footer.iconURL });
    if (data.thumbnail) embed.setThumbnail(data.thumbnail);

    await raidlog.send({ embeds: [embed] });
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { getRaidLogChannel, sendRaidLog };
