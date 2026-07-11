const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'banner', aliases: [], level: 0,
  description: "Affiche la bannière d'un utilisateur Discord",
  run: async (client, message, args) => {
    let hasPermission = false;
    for (const role of message.member.roles.cache.values()) { if (db.get(`modsp_${message.guild.id}_${role.id}`) || db.get(`ownerp_${message.guild.id}_${role.id}`) || db.get(`admin_${message.guild.id}_${role.id}`)) { hasPermission = true; break; } }
    const allowed = client.config?.owner?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) || hasPermission || db.get(`channelpublic_${message.guild.id}_${message.channel.id}`);
    if (!allowed) return reply(message, errorContainer('Permission refusée.'));
    let targetUser = message.author;
    if (message.mentions.users.first()) targetUser = message.mentions.users.first();
    else if (args[0]) { targetUser = await client.users.fetch(args[0]).catch(() => null); if (!targetUser) return reply(message, errorContainer('Utilisateur introuvable.')); }
    try { await showUserBanner(client, message, targetUser); }
    catch (e) { console.error(e); await reply(message, errorContainer("Erreur lors de la récupération de la bannière.")); }
  }
};

async function showUserBanner(client, message, user) {
  try {
    const bannerInfo = await getUserBannerWithFallback(user.id, client);
    if (bannerInfo.exists && bannerInfo.url) {
      await reply(message, container(txt(`## 🎨 Bannière de ${user.username}`), sep(), txt(`[Lien direct](${bannerInfo.url})\n*Demandé par ${message.author.username}*`)));
    } else if (bannerInfo.accentColor) {
      await reply(message, container(txt(`## 🎨 ${user.username}`), sep(), txt(`Cet utilisateur n'a pas de bannière mais a une couleur d'accent.\n*Demandé par ${message.author.username}*`)));
    } else {
      await reply(message, container(txt(`## 🎨 ${user.username}`), sep(), txt(`Cet utilisateur n'a pas de bannière personnalisée.\n*Demandé par ${message.author.username}*`)));
    }
  } catch (e) { console.error(e); await reply(message, errorContainer("Impossible de récupérer la bannière.")); }
}

async function getUserBannerUrl(userId, client, { dynamicFormat = true, defaultFormat = 'webp', size = 512 } = {}) {
  const validSizes = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
  if (!validSizes.includes(size)) throw new Error(`Taille '${size}' non supportée.`);
  const validFormats = ['webp', 'png', 'jpg', 'jpeg', 'gif'];
  if (!validFormats.includes(defaultFormat)) throw new Error(`Format '${defaultFormat}' non supporté.`);
  try {
    const user = await client.users.fetch(userId, { force: true });
    if (user.banner) { const base = `https://cdn.discordapp.com/banners/${userId}/${user.banner}`, q = `?size=${size}`; return (dynamicFormat && user.banner.startsWith('a_')) ? base + '.gif' + q : base + `.${defaultFormat}` + q; }
    try { const api = await client.api.users(userId).get(); if (api.banner) { const base = `https://cdn.discordapp.com/banners/${userId}/${api.banner}`, q = `?size=${size}`; return (dynamicFormat && api.banner.startsWith('a_')) ? base + '.gif' + q : base + `.${defaultFormat}` + q; } } catch {}
    return null;
  } catch { return null; }
}

async function getUserBannerWithFallback(userId, client) {
  try {
    const url = await getUserBannerUrl(userId, client, { size: 1024, dynamicFormat: true });
    if (url) return { url, isAnimated: url.includes('.gif'), exists: true };
    const user = await client.users.fetch(userId);
    if (user.accentColor) return { url: null, accentColor: user.accentColor, exists: false };
    return { url: null, exists: false };
  } catch (e) { return { url: null, exists: false, error: e.message }; }
}

module.exports.getUserBannerUrl = getUserBannerUrl;
module.exports.getUserBannerWithFallback = getUserBannerWithFallback;
