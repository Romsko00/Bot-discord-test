const { PermissionFlagsBits } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

const DB_KEY = (uid) => `bl_global_${uid}`;

module.exports = {
  name: 'unbl',
  aliases: ['unblacklist', 'ungban', 'unglobalban'],
  description: 'Retire un utilisateur de la blacklist globale',
  usage: '@user [raison]',
  category: 'bot',
  level: 6,
  run: async (client, message, args) => {
    let perm = false;
    message.member?.roles?.cache?.forEach(r => { if (db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
    const isAuth = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) || perm || message.member?.permissions?.has(PermissionFlagsBits.BanMembers);
    if (!isAuth) return reply(message, errorContainer('**Permission insuffisante.**'));

    let target = message.mentions.users.first() || null;
    if (!target && args[0] && /^\d{17,20}$/.test(args[0])) target = await client.users.fetch(args[0]).catch(() => null);
    if (!target) return reply(message, errorContainer('**Utilisateur introuvable.**'));

    const blData = db.get(DB_KEY(target.id));
    if (!blData) return reply(message, errorContainer('Cet utilisateur n\'est pas dans la blacklist globale.'));

    const reason = args.slice(message.mentions.users.first() ? 1 : 1).join(' ') || 'Aucune raison spécifiée';
    db.delete(DB_KEY(target.id));

    const sent = await reply(message, container(txt('## 🔄 Débannissement en cours...'), sep(), txt('Retrait sur tous les serveurs...')));

    const results = { unbanned: 0, notBanned: 0, failed: 0 };
    const allClients = globalThis.allClients || [client];

    for (const cl of allClients) {
      for (const guild of cl.guilds.cache.values()) {
        try {
          const me = guild.members.me;
          if (!me?.permissions.has(PermissionFlagsBits.BanMembers)) { results.failed++; continue; }
          const bans = await guild.bans.fetch().catch(() => null);
          if (!bans?.has(target.id)) { results.notBanned++; continue; }
          await guild.bans.remove(target.id, `[UNBL GLOBAL] ${reason} — par ${message.author.tag}`);
          results.unbanned++;
        } catch { results.failed++; }
      }
    }

    return sent.edit({ components: [container(
      txt('## ✅ Blacklist Globale — Retrait'),
      sep(),
      txt([`**Utilisateur :** ${target.tag} (\`${target.id}\`)`, `**Modérateur :** ${message.author.tag}`, `**Raison :** ${reason}`].join('\n')),
      sep(),
      txt([`✅ **Débannis :** ${results.unbanned}`, `⚠️ **Non bannis :** ${results.notBanned}`, `❌ **Échecs :** ${results.failed}`].join('\n'))
    )], flags: FLAGS }).catch(() => {});
  }
};
