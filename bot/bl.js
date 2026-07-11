const { PermissionFlagsBits } = require('discord.js');
const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

const DB_KEY = (uid) => `bl_global_${uid}`;

module.exports = {
  name: 'bl',
  aliases: ['blacklist', 'globalban', 'gban'],
  description: 'Blacklist globale — banni l\'utilisateur sur tous les serveurs du bot',
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
    if (target.id === message.author.id) return reply(message, errorContainer('Vous ne pouvez pas vous blacklister vous-même.'));
    if (target.id === client.user.id) return reply(message, errorContainer('Je ne peux pas me blacklister moi-même.'));
    if (client.config.superadmin?.includes(target.id) || client.config.owners?.includes(target.id)) return reply(message, errorContainer('Impossible de blacklister un owner/superadmin.'));
    if (db.get(DB_KEY(target.id))) return reply(message, errorContainer('Cet utilisateur est déjà dans la blacklist globale.'));

    const reason = args.slice(message.mentions.users.first() ? 1 : 1).join(' ') || 'Aucune raison spécifiée';
    const sent = await reply(message, container(txt('## 🔄 Bannissement en cours...'), sep(), txt('Bannissement sur tous les serveurs...')));

    const results = { banned: 0, alreadyBanned: 0, failed: 0, servers: [] };
    const allClients = globalThis.allClients || [client];

    for (const cl of allClients) {
      for (const guild of cl.guilds.cache.values()) {
        try {
          const me = guild.members.me;
          if (!me?.permissions.has(PermissionFlagsBits.BanMembers)) { results.failed++; continue; }
          const bans = await guild.bans.fetch().catch(() => null);
          if (bans?.has(target.id)) { results.alreadyBanned++; results.servers.push(guild.id); continue; }
          await guild.bans.create(target.id, { reason: `[BL GLOBAL] ${reason} — par ${message.author.tag}`, deleteMessageSeconds: 0 });
          results.banned++;
          results.servers.push(guild.id);
        } catch { results.failed++; }
      }
    }

    db.set(DB_KEY(target.id), { reason, mod: message.author.id, modTag: message.author.tag, timestamp: Date.now(), servers: results.servers });

    return sent.edit({ components: [container(
      txt('## 🔨 Blacklist Globale'),
      sep(),
      txt([`**Utilisateur :** ${target.tag} (\`${target.id}\`)`, `**Modérateur :** ${message.author.tag}`, `**Raison :** ${reason}`].join('\n')),
      sep(),
      txt([`✅ **Bannis :** ${results.banned}`, `⚠️ **Déjà bannis :** ${results.alreadyBanned}`, `❌ **Échecs :** ${results.failed}`].join('\n'))
    )], flags: require('../../utils/v2').FLAGS }).catch(() => {});
  }
};
