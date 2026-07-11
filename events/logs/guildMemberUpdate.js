const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { LogSystem } = require('../../utils/logSystem');

module.exports = async (client, oldMember, newMember) => {
  try {
    const guild = newMember.guild;
    const changes = [];

    // Timeout changes
    const oldTimeout = oldMember.communicationDisabledUntil;
    const newTimeout = newMember.communicationDisabledUntil;
    if (oldTimeout !== newTimeout) {
      if (newTimeout) {
        changes.push(`Timeout : Jusqu'au <t:${Math.floor(newTimeout.getTime() / 1000)}:F>`);
      } else if (oldTimeout) {
        changes.push(`Timeout : Retiré`);
      }
    }

    // Role changes
    const oldRoles = new Set(oldMember.roles.cache.keys());
    const newRoles = new Set(newMember.roles.cache.keys());

    const addedRoleIds = [...newRoles].filter(id => !oldRoles.has(id));
    const removedRoleIds = [...oldRoles].filter(id => !newRoles.has(id));

    const addedRoles = addedRoleIds
      .map(id => guild.roles.cache.get(id))
      .filter(r => !!r && r.id !== guild.id);
    const removedRoles = removedRoleIds
      .map(id => guild.roles.cache.get(id))
      .filter(r => !!r && r.id !== guild.id);

    if (addedRoles.length > 0) {
      changes.push(`Rôles ajoutés : ${addedRoles.map(r => r.toString()).join(', ')}`);
    }
    if (removedRoles.length > 0) {
      changes.push(`Rôles retirés : ${removedRoles.map(r => r.toString()).join(', ')}`);
    }

    // === Enforce role limits (limrole) ===
    try {
      for (const role of addedRoles) {
        const key = `limrole_${guild.id}_${role.id}`;
        const limit = require('../../utils/simpledb').get(key);
        if (typeof limit === 'number') {
          // Fetch fresh count
          const membersWithRole = guild.members.cache.filter(m => m.roles.cache.has(role.id)).size;
          if (membersWithRole > limit) {
            // This member caused the overflow: remove role
            try {
              await newMember.roles.remove(role.id, `Limite (${limit}) dépassée`);
            } catch (e) {
              console.error('Erreur suppression rôle limrole:', e);
            }

            // Notify the member
            try {
              await newMember.send(`<:_:1483497503713394719> Le rôle **${role.name}** est limité à ${limit} membres sur le serveur ${guild.name}. Ton rôle a été retiré automatiquement.`).catch(() => {});
            } catch (_) {}

            // Log to moderation channel via LogSystem, fallback to console
            try {
              const embed = new EmbedBuilder()
                .setColor(0xb71c1c)
                .setDescription(`**Limite de rôle dépassée**\nRôle : ${role.toString()}\nLimite : ${limit} membres\nRôle retiré à : ${newMember.user}`)
                .setFooter({ text: LogSystem.logTimestamp() });
              LogSystem.sendEventLog(guild, 'MODERATION', embed).catch(() => {});
            } catch (_) { console.warn('[limrole] LogSystem not available'); }
          }
        }
      }
    } catch (e) { console.error('Erreur enforcement limrole:', e); }

    // === Update role name brackets [count/limit] for roles with limits ===
    try {
      const db = require('../../utils/simpledb');
      const me = guild.members.me;
      const roleIds = new Set([...addedRoles, ...removedRoles].map(r => r.id));
      for (const roleId of roleIds) {
        const role = guild.roles.cache.get(roleId);
        if (!role) continue;
        const key = `limrole_${guild.id}_${role.id}`;
        const limit = db.get(key);
        if (typeof limit === 'number') {
          const count = guild.members.cache.filter(m => m.roles.cache.has(role.id)).size;
          const baseName = role.name.replace(/\s*\[\d+\/\d+\]$/, '').trim();
          const newName = `${baseName} [${count}/${limit}]`;
          if (newName !== role.name) {
            try {
              if (me && me.permissions.has(PermissionFlagsBits.ManageRoles) && !role.managed && role.position < me.roles.highest.position) {
                if (newName.length <= 100) await role.edit({ name: newName }, 'Mise à jour du compteur limrole').catch(() => {});
              }
            } catch (e) { /* ignore */ }
          }
        }
      }
    } catch (e) { console.error('Erreur mise à jour limrole name:', e); }

    if (changes.length === 0) return;

    let executor = null;
    try {
      let auditType;
      if (addedRoles.length || removedRoles.length) {
        auditType = AuditLogEvent.MemberRoleUpdate;
      } else if (oldTimeout !== newTimeout) {
        auditType = AuditLogEvent.MemberUpdate;
      }
      if (auditType) {
        const fetched = await guild.fetchAuditLogs({ type: auditType, limit: 1 });
        const entry = fetched.entries.first();
        if (entry && entry.target?.id === newMember.id) {
          executor = entry.executor;
        }
      }
    } catch (e) {
      console.error('Erreur fetch audit logs member update:', e);
    }

    let desc;
    if (addedRoles.length && !removedRoles.length && !(oldTimeout !== newTimeout)) {
      desc = `**${newMember.user} a reçu le(s) rôle(s) : ${addedRoles.map(r => r.toString()).join(', ')}**`;
      if (executor) desc += `\nAjouté par : ${executor}`;
    } else if (removedRoles.length && !addedRoles.length && !(oldTimeout !== newTimeout)) {
      desc = `**${newMember.user} a perdu le(s) rôle(s) : ${removedRoles.map(r => r.toString()).join(', ')}**`;
      if (executor) desc += `\nRetiré par : ${executor}`;
    } else {
      desc = `**Modification :** ${newMember.user}\n${changes.join('\n')}`;
      if (executor) desc += `\nPar : ${executor}`;
    }

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setDescription(desc)
      .setFooter({ text: LogSystem.logTimestamp() });

    const result = await LogSystem.sendEventLog(guild, 'MODERATION', embed);
    if (!result) {
      console.warn('[guildMemberUpdate] Salon de logs non configuré pour MODERATION');
    }

  } catch (e) {
    console.error('Erreur guildMemberUpdate:', e);
  }
};
