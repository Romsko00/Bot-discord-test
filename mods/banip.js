const { hasPermissionLevel, AccessLevels } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');
let vpnDetector;
try { vpnDetector = require('../../utils/vpnDetector'); } catch { vpnDetector = null; }

const KEY_LIST = (g) => `banip_list_${g}`;
const KEY_ENTRY = (g, ip) => `banip_${g}_${ip.replace(/\./g, '_').replace(/:/g, '_')}`;

module.exports = {
  name: 'banip',
  aliases: ['ipban'],
  description: 'Bannit l\'IP d\'un utilisateur',
  usage: '<@utilisateur|ID> [raison]',

  run: async (client, message, args) => {
    try {
      if (!hasPermissionLevel(client, message, AccessLevels?.PERM6 || 6))
        return reply(message, errorContainer('**Permission refusée** — Niveau 6 requis.'));

      if (!args.length) return reply(message, container(
        txt('## 🚫 Ban IP — Aide'),
        sep(),
        txt([
          '**Syntaxe :** `!banip @utilisateur [raison]` ou `!banip <ID> [raison]`',
          '**Note :** Si l\'IP n\'est pas détectable, elle sera demandée manuellement.'
        ].join('\n'))
      ));

      const userId = args[0].replace(/[<@!>]/g, '');
      let targetUser;
      try { targetUser = await client.users.fetch(userId); } catch { targetUser = null; }
      if (!targetUser) return reply(message, errorContainer('**Utilisateur introuvable.** Vérifiez l\'ID ou la mention.'));

      const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
      if (targetMember?.permissions.has(8n)) return reply(message, errorContainer('Impossible de bannir l\'IP d\'un **administrateur**.'));

      const reason = args.slice(1).join(' ') || 'Non spécifiée';
      let userIP = db.get(`userip_${message.guild.id}_${targetUser.id}`) || null;

      if (!userIP) {
        await reply(message, container(
          txt('## ⚠️ IP non disponible automatiquement'),
          sep(),
          txt(`L\'IP de **${targetUser.tag}** n'a pas pu être récupérée automatiquement.\n\nEntrez l'adresse IP manuellement ci-dessous, ou tapez \`annuler\` (délai : 30s).`)
        ));
        const collected = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 30000 }).catch(() => null);
        if (!collected?.size || collected.first().content.toLowerCase() === 'annuler')
          return message.channel.send({ components: [errorContainer('Aucune IP fournie. Opération abandonnée.')], flags: require('../../utils/v2').FLAGS });
        userIP = collected.first().content.trim();
      }

      const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
      const ipv6 = /^[0-9a-fA-F:]{2,39}$/;
      if (!ipv4.test(userIP) && !ipv6.test(userIP))
        return reply(message, errorContainer(`Format IP invalide : \`${userIP}\``));

      const existing = db.get(KEY_ENTRY(message.guild.id, userIP));
      if (existing) return reply(message, container(
        txt('## ⚠️ IP Déjà Bannie'),
        sep(),
        txt([`**IP :** \`${userIP}\``, `**Utilisateur :** ${existing.username}`, `**Modérateur :** ${existing.moderatorName}`, `**Raison :** ${existing.reason}`, `**Date :** <t:${Math.floor(existing.date / 1000)}:F>`].join('\n'))
      ));

      let vpnCheck = { isVPN: false, score: 0, isp: 'Inconnu' };
      if (vpnDetector?.checkVPN) { try { vpnCheck = await vpnDetector.checkVPN(userIP); } catch {} }

      const entry = { ip: userIP, userId: targetUser.id, username: targetUser.tag, reason: reason + (vpnCheck.isVPN ? ' [VPN DÉTECTÉ]' : ''), moderatorId: message.author.id, moderatorName: message.author.tag, date: Date.now(), vpn: vpnCheck.isVPN, vpnScore: vpnCheck.score, isp: vpnCheck.isp };
      db.set(KEY_ENTRY(message.guild.id, userIP), entry);
      const list = db.get(KEY_LIST(message.guild.id)) || [];
      if (!list.includes(userIP)) { list.push(userIP); db.set(KEY_LIST(message.guild.id), list); }

      let banned = false;
      if (targetMember) { try { await targetMember.ban({ reason: `[BAN IP] ${reason}` }); banned = true; } catch (e) { console.error('[banip ban]', e); } }

      const logCh = message.guild.channels.cache.get(db.get(`logmod_${message.guild.id}`));
      if (logCh) logCh.send({ components: [container(txt(`## 🚫 Ban IP\n\n**Modérateur :** ${message.author.tag}\n**Cible :** ${targetUser.tag}\n**IP :** \`${userIP}\`\n**Raison :** ${reason}`))], flags: FLAGS }).catch(() => {});

      return reply(message, container(
        txt('## 🚫 Ban IP — Enregistré'),
        sep(),
        txt([
          `**Utilisateur :** ${targetUser.tag} (\`${targetUser.id}\`)`,
          `**IP :** \`${userIP}\``,
          `**VPN :** ${vpnCheck.isVPN ? `Détecté (score : ${vpnCheck.score}/100)` : 'Non détecté'}`,
          `**Ban compte :** ${banned ? 'Effectué' : 'Non membre / échec'}`,
          `**Raison :** ${reason}`,
          `**Modérateur :** ${message.author.tag}`
        ].join('\n'))
      ));
    } catch (err) {
      console.error('[banip]', err);
      reply(message, errorContainer('Une erreur est survenue.'));
    }
  }
};
