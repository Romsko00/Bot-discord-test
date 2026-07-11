const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

function hasModPermission(client, message) {
  if (client.config.superadmin?.includes(message.author.id)) return true;
  if (client.config.owners?.includes(message.author.id)) return true;
  if (db.get(`ownermd_${client.user.id}_${message.author.id}`) === true) return true;
  for (const r of message.member.roles.cache.values()) {
    if (db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`)) return true;
  }
  return false;
}

function calcDuration(startTime) {
  if (!startTime) return 'Inconnue';
  const d = Date.now() - startTime;
  const h = Math.floor(d / 3600000);
  const m = Math.floor((d % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

async function sendLog(guild, content) {
  const logCh = guild.channels.cache.get(db.get(`logmod_${guild.id}`));
  if (logCh?.isTextBased()) logCh.send({ content }).catch(() => {});
}

module.exports = {
  name: 'lockdown',
  aliases: ['ld'],
  description: 'Verrouillage d\'urgence du serveur',
  usage: '<on|off|status>',

  run: async (client, message, args, prefix) => {
    try {
      if (!hasModPermission(client, message)) return reply(message, errorContainer('**Permission refusée.**'));

      const action = args[0]?.toLowerCase();

      if (action === 'on' || action === 'start' || action === 'enable') {
        if (db.get(`lockdown_status_${message.guild.id}`)) return reply(message, errorContainer('Le lockdown est déjà actif.'));

        const everyone = message.guild.roles.everyone;
        const channels = message.guild.channels.cache.filter(c => c.isTextBased() && c.manageable);
        const perms = {};
        for (const [id, ch] of channels) {
          const ow = ch.permissionOverwrites.cache.get(everyone.id);
          perms[id] = ow ? { allow: String(ow.allow.bitfield), deny: String(ow.deny.bitfield) } : null;
        }
        db.set(`lockdown_status_${message.guild.id}`, true);
        db.set(`lockdown_perms_${message.guild.id}`, perms);
        db.set(`lockdown_moderator_${message.guild.id}`, message.author.id);
        db.set(`lockdown_timestamp_${message.guild.id}`, Date.now());

        let locked = 0, failed = 0;
        for (const [, ch] of channels) {
          try {
            await ch.permissionOverwrites.edit(everyone, { SendMessages: false, AddReactions: false, CreatePublicThreads: false, CreatePrivateThreads: false, SendMessagesInThreads: false }, { reason: `Lockdown par ${message.author.tag}` });
            locked++;
          } catch { failed++; }
        }
        await sendLog(message.guild, `🔒 **LOCKDOWN ACTIVÉ** par ${message.author.tag} — ${locked} salons verrouillés`);
        return reply(message, container(
          txt('## 🔒 LOCKDOWN ACTIVÉ'),
          sep(),
          txt([`**Salons verrouillés :** ${locked}`, failed > 0 ? `**Échecs :** ${failed}` : null, `**Modérateur :** ${message.author.tag}`].filter(Boolean).join('\n'))
        ));

      } else if (action === 'off' || action === 'stop' || action === 'disable') {
        if (!db.get(`lockdown_status_${message.guild.id}`)) return reply(message, errorContainer('Le lockdown n\'est pas actif.'));

        const everyone = message.guild.roles.everyone;
        const savedPerms = db.get(`lockdown_perms_${message.guild.id}`) || {};
        const channels = message.guild.channels.cache.filter(c => c.isTextBased() && c.manageable);
        let unlocked = 0, failed = 0;

        for (const [id, ch] of channels) {
          try {
            if (savedPerms[id] !== null && savedPerms[id] !== undefined) {
              await ch.permissionOverwrites.edit(everyone, { SendMessages: null, AddReactions: null, CreatePublicThreads: null, CreatePrivateThreads: null, SendMessagesInThreads: null }, { reason: `Lockdown off par ${message.author.tag}` });
            } else {
              await ch.permissionOverwrites.delete(everyone, `Lockdown off par ${message.author.tag}`);
            }
            unlocked++;
          } catch { failed++; }
        }

        const duration = calcDuration(db.get(`lockdown_timestamp_${message.guild.id}`));
        db.delete(`lockdown_status_${message.guild.id}`);
        db.delete(`lockdown_perms_${message.guild.id}`);
        db.delete(`lockdown_moderator_${message.guild.id}`);
        db.delete(`lockdown_timestamp_${message.guild.id}`);

        await sendLog(message.guild, `🔓 **LOCKDOWN DÉSACTIVÉ** par ${message.author.tag} — durée : ${duration}`);
        return reply(message, container(
          txt('## 🔓 Lockdown Désactivé'),
          sep(),
          txt([`**Salons déverrouillés :** ${unlocked}`, failed > 0 ? `**Échecs :** ${failed}` : null, `**Durée :** ${duration}`].filter(Boolean).join('\n'))
        ));

      } else if (action === 'status' || action === 'info') {
        const isLocked = db.get(`lockdown_status_${message.guild.id}`);
        const startTs = db.get(`lockdown_timestamp_${message.guild.id}`);
        const modId = db.get(`lockdown_moderator_${message.guild.id}`);
        let modTag = 'Inconnu';
        if (modId) { const u = await client.users.fetch(modId).catch(() => null); if (u) modTag = u.tag; }

        return reply(message, container(
          txt(`## ${isLocked ? '🔒 Lockdown ACTIF' : '🔓 Lockdown Inactif'}`),
          sep(),
          txt(isLocked
            ? [`**Activé par :** ${modTag}`, `**Depuis :** <t:${Math.floor(startTs / 1000)}:R>`, `**Durée :** ${calcDuration(startTs)}`].join('\n')
            : 'Aucun lockdown actif sur ce serveur.\n\n`!lockdown on` / `!lockdown off`')
        ));

      } else {
        return reply(message, container(
          txt('## 🔒 Lockdown — Aide'),
          sep(),
          txt([
            `\`${prefix}lockdown on\` — Activer le lockdown`,
            `\`${prefix}lockdown off\` — Désactiver le lockdown`,
            `\`${prefix}lockdown status\` — Afficher l\'état`
          ].join('\n'))
        ));
      }
    } catch (err) {
      console.error('[lockdown]', err);
      reply(message, errorContainer('Une erreur est survenue.'));
    }
  }
};
