const fs = require('fs');
const path = require('path');
const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const { loadExpirations, saveExpirations } = require('../../utils/buyerExpirationChecker');
const { reloadConfigFromDisk, CONFIG_PATH } = require('../../utils/reloadConfig');
const { connectMissingTokensFromConfig } = require('../../utils/connectNewTokens');
const { invalidateBuyersCache } = require('../../utils/permissionUtils');
const BUYERS_PATH = path.resolve(__dirname, '../../data/buyers.json');
const DATA_DIR = path.resolve(__dirname, '../../data');

function isValidTokenFormat(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.trim().split('.');
  return parts.length >= 3 && parts.every(p => p.length > 0);
}

function parseDuration(duration) {
  if (!duration) return null;
  const match = duration.match(/^(\d+)(h|d|w|mois|an|ans)$/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { h: 3600000, d: 86400000, w: 604800000, mois: 2592000000, an: 31536000000, ans: 31536000000 };
  return multipliers[unit] ? value * multipliers[unit] : null;
}

function formatDuration(ms) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000);
  if (h < 24) return `${h} heure${h > 1 ? 's' : ''}`;
  if (d < 7) return `${d} jour${d > 1 ? 's' : ''}`;
  if (d < 30) { const w = Math.floor(d / 7); return `${w} semaine${w > 1 ? 's' : ''}`; }
  if (d < 365) { const mo = Math.floor(d / 30); return `${mo} mois`; }
  const y = Math.floor(d / 365); return `${y} an${y > 1 ? 's' : ''}`;
}

module.exports = {
  name: 'buyer',
  aliases: ['addbuyer'],
  description: 'Ajoute un buyer et le token de son bot',
  usage: '<id user> <bot token> [temps]',
  category: 'admin',
  level: 9,
  run: async (client, message, args, prefix) => {
    if (!client.config.superadmin || !client.config.superadmin.includes(message.author.id)) {
      return reply(message, errorContainer('**Permission insuffisante** — Superadmin requis.'));
    }

    const userId = (args[0] || '').trim();
    let duration = null;
    const tokenParts = [];
    for (let i = 1; i < args.length; i++) {
      const part = (args[i] || '').trim();
      if (parseDuration(part)) { duration = part; break; }
      tokenParts.push(part);
    }
    const botToken = (tokenParts.length === 1 ? tokenParts[0] : tokenParts.join('.')).trim();

    if (!userId || !botToken) {
      return reply(message, container(
        txt('## 🛒 Buyer — Usage'),
        sep(),
        txt([
          `**Commande :** \`!buyer <id user> <bot token> [temps]\``,
          '',
          '**Formats de durée :**',
          '• `1h`, `2h`, `24h` — Heures',
          '• `1d`, `3d`, `7d` — Jours',
          '• `1w`, `2w` — Semaines',
          '• `1mois`, `2mois` — Mois',
          '• `1an`, `2ans` — Années',
          '',
          '*Sans durée = permanent*'
        ].join('\n'))
      ));
    }

    if (!isValidTokenFormat(botToken)) {
      return reply(message, errorContainer('**Token invalide** — Le token doit avoir 3 parties séparées par des points.'));
    }

    let buyers = {};
    try {
      if (fs.existsSync(BUYERS_PATH)) buyers = JSON.parse(fs.readFileSync(BUYERS_PATH, 'utf8')) || {};
    } catch { return reply(message, errorContainer('Impossible de lire `buyers.json`')); }

    const existing = buyers[userId];
    if (!existing) buyers[userId] = botToken;
    else if (Array.isArray(existing)) { if (!existing.includes(botToken)) existing.push(botToken); }
    else if (existing !== botToken) buyers[userId] = [existing, botToken];

    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(BUYERS_PATH, JSON.stringify(buyers, null, 2), 'utf8');
      invalidateBuyersCache();
    } catch { return reply(message, errorContainer('Impossible d\'écrire dans `buyers.json`')); }

    let config;
    try { config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
    catch (e) { return reply(message, errorContainer(`Impossible de lire \`config.json\`: ${e.message}`)); }

    if (!config.DISCORD) config.DISCORD = {};
    const tokensArray = Array.isArray(config.DISCORD.TOKEN) ? [...config.DISCORD.TOKEN]
      : (config.DISCORD.TOKEN ? [config.DISCORD.TOKEN] : []);
    let configUpdated = false;
    if (!tokensArray.includes(botToken)) {
      tokensArray.push(botToken);
      config.DISCORD.TOKEN = tokensArray;
      configUpdated = true;
    }

    if (configUpdated) {
      try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8'); }
      catch (e) { return reply(message, errorContainer(`Impossible d\'écrire \`config.json\`: ${e.message}`)); }
      reloadConfigFromDisk();
      try { await connectMissingTokensFromConfig(); } catch {}
    } else { reloadConfigFromDisk(); }

    try {
      let botId = null;
      try { const parts = botToken.split('.'); botId = Buffer.from(parts[0], 'base64').toString('ascii'); } catch {}
      if (botId) db.set(`buyer_bot_${botId}_${userId}`, true);
      else db.set(`buyer_global_${userId}`, true);
    } catch {}

    let expirationInfo = null;
    if (duration) {
      const ms = parseDuration(duration);
      if (ms) {
        const expiresAt = Date.now() + ms;
        try {
          const expirations = loadExpirations();
          expirations[botToken] = { userId, expiresAt, duration, addedAt: Date.now() };
          saveExpirations(expirations);
          expirationInfo = {
            duration: formatDuration(ms),
            expiresAt: new Date(expiresAt).toLocaleString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          };
        } catch {}
      }
    }

    const lines = [
      `**Utilisateur :** <@${userId}>`,
      `**Token :** \`[masqué]\``,
      expirationInfo ? `**Durée :** ${expirationInfo.duration}` : `**Type :** Permanent`,
      expirationInfo ? `**Expire le :** ${expirationInfo.expiresAt}` : null,
      `**Config :** ${configUpdated ? 'Token ajouté + bot démarré' : 'Buyer enregistré (token déjà présent)'}`,
      `**Effectué par :** ${message.author}`
    ].filter(Boolean);

    await reply(message, container(
      txt('## ✅ Buyer Enregistré'),
      sep(),
      txt(lines.join('\n'))
    ));

    const { exec } = require('child_process');
    exec('pm2 -v', async (err) => {
      if (err) {
        message.channel.send({ components: [container(txt('ℹ️ PM2 non disponible — chargement sans redémarrage global.'))], flags: FLAGS });
      } else {
        exec('pm2 restart all', (error) => {
          if (error) message.channel.send(`❌ Erreur PM2 : ${error.message}`);
          else message.channel.send({ components: [container(txt('✅ Bot relancé via PM2.'))], flags: FLAGS });
        });
      }
    });
  }
};
