const db = require("../../utils/simpledb");
const { EmbedBuilder } = require("discord.js");
const { LogSystem } = require("../../utils/logSystem");

module.exports = async (client, message) => {
  try {
    if (message.partial) {
      try { await message.fetch(); } catch (_) {}
    }

    // VN1 cleanup
    try {
      const vnKey = `vn1_buttons_${message.id}`;
      if (db.has(vnKey)) {
        const payload = db.get(vnKey);
        if (payload && Array.isArray(payload.buttons) && client.vn1Buttons) {
          for (const b of payload.buttons) {
            if (b.customid) client.vn1Buttons.delete(b.customid);
          }
        }
        db.delete(vnKey);
      }
    } catch (_) {}

    // ── Snipes (global partagé entre tous les clients) ─────────────────────
    const channelId = message.channel?.id;
    if (channelId) {
      if (!global._snipes) global._snipes = new Map();
      if (!global._snipes.has(channelId)) global._snipes.set(channelId, []);

      const snipeData = {
        content: message.content || '',
        author: message.author
          ? { username: message.author.username, id: message.author.id }
          : null,
        timestamp: message.createdTimestamp || Date.now(),
        stickers: message.stickers
          ? Array.from(message.stickers.values()).map(s => ({ name: s.name, url: s.url }))
          : [],
        attachments: message.attachments
          ? Array.from(message.attachments.values()).map(a => ({
              name: a.name,
              url: a.url,
              proxyURL: a.proxyURL,
              contentType: a.contentType,
            }))
          : [],
        deletedAt: Date.now(),
      };

      const snipes = global._snipes.get(channelId);
      snipes.unshift(snipeData);
      if (snipes.length > 10) snipes.pop();

      const now = Date.now();
      global._snipes.set(channelId, snipes.filter(s => (now - s.deletedAt) < 86400000));

      // Rétrocompat client.snipes
      if (client.snipes) client.snipes.set(channelId, global._snipes.get(channelId));
    }
  } catch (_) {}


  try {
    if (!message?.guild || !message?.channel) return;
    const enabled = db.get(`automod_ghostping_${message.guild.id}`) === true;
    if (!enabled) return;

    const mentionedUsers = message.mentions?.users ? Array.from(message.mentions.users.values()) : [];
    const mentionedRoles = message.mentions?.roles ? Array.from(message.mentions.roles.values()) : [];
    const pingEveryone = message.mentions?.everyone === true;
    const total = (mentionedUsers?.length || 0) + (mentionedRoles?.length || 0) + (pingEveryone ? 1 : 0);
    if (total <= 0) return;

    const mentionsText = [
      ...(mentionedUsers || []).map((u) => `${u}`),
      ...(mentionedRoles || []).map((r) => `<@&${r.id}>`),
      ...(pingEveryone ? ['@everyone/@here'] : [])
    ].join(' ');

    const desc = [
      `Ghost ping : un message mentionnant ${total} cible(s) a été supprimé.`,
      `Auteur : ${message.author ? `${message.author} (${message.author.id})` : 'Inconnu'}`,
      `Salon : <#${message.channelId}>`,
      `Mentions : ${mentionsText || '—'}`
    ].join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xff5555)
      .setDescription(desc)
      .setFooter({ text: LogSystem.logTimestamp() });

    await LogSystem.sendEventLog(message.guild, 'MESSAGE', embed);
  } catch (_) {}
};
