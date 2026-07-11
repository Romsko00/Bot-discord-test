const db = require('./simpledb');
const { EmbedBuilder } = require('discord.js');

async function notify(client, guildId, embedOrText) {
  try {
    const chId = db.get(`casino_notify_${guildId}`);
    if (!chId) return false;

    const bot = (globalThis.allClients || []).find((c) => c.guilds?.cache?.has(guildId)) || client;
    const ch = bot.channels.cache.get(chId) || (await bot.channels.fetch(chId).catch(() => null));
    if (!ch) return false;
    const payload = typeof embedOrText === 'string' ? { content: embedOrText } : { embeds: [embedOrText] };
    await ch.send(payload).catch(() => {});
    return true;
  } catch (_) {
    return false;
  }
}

function buildEmbed(title, description, color = '#00FFFF') {
  return new EmbedBuilder().setTitle(title).setDescription(description).setColor(color);
}

module.exports = {
  notify,
  buildEmbed
};
