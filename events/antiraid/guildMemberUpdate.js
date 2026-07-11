const db = require("../../utils/simpledb");
const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require("discord.js");

module.exports = async (client, oldMember, newMember) => {
  try {
    const guild = newMember.guild;
    if (!guild) return;
    const raidlog = guild.channels.cache.get(db.get(`${guild.id}.raidlog`));
    const owners = client.config.owners || [];

    const isBypassed = (userId) => {
      const wl = db.get(`wlmd_${guild.id}_${userId}`) === true;
      const ownermd = db.get(`ownermd_${client.user.id}_${userId}`) === true;
      return userId === client.user.id || userId === guild.ownerId || owners.includes(userId) || ownermd || wl;
    };


    try {
      const enabled = db.get(`automod_nickspam_${guild.id}`) === true;
      if (enabled && oldMember && newMember) {
        const before = oldMember.nickname;
        const after = newMember.nickname;
        if (before !== after) {
          const uid = newMember.id;
          if (!isBypassed(uid)) {
            const key = `automod_nickspam_${guild.id}_${uid}`;
            const windowMs = 10 * 60 * 1000;
            const max = db.get(`automod_nickspam_max_per_10m_${guild.id}`) || 3;
            const now = Date.now();
            const bucket = (db.get(key) || []).filter((ts) => now - ts <= windowMs);
            bucket.push(now);
            db.set(key, bucket);
            if (bucket.length > max) {
              const sanction = db.get(`automod_nickspam_sanction_${guild.id}`) || 'timeout';
              const reason = `AutoMod: Nickname spam (${bucket.length}/${max} sur 10 min)`;
              try {
                if (sanction === 'ban') await guild.members.ban(uid, { reason });else
                if (sanction === 'kick') await newMember.kick(reason);else
                if (sanction === 'derank') await newMember.roles.set([], reason);else
                {
                  const me = guild.members.me;
                  if (me && me.permissions.has(PermissionFlagsBits.ModerateMembers) && newMember.moderatable) await newMember.timeout(10 * 60 * 1000, reason);
                }
                try {await newMember.send({ content: `Votre pseudo a été modifié trop souvent. ${reason}.` });} catch (_) {}
                if (raidlog) await raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`<@${uid}> sanctionné: **${sanction}** • ${reason}`));
              } catch (_) {}
            }
            setTimeout(() => {
              const b = db.get(key) || [];
              db.set(key, b.filter((ts) => Date.now() - ts <= windowMs));
            }, windowMs + 1000);
          }
        }
      }
    } catch (_) {}


    try {
      const enabled = db.get(`automod_nsfwname_${guild.id}`) === true;
      if (enabled) {
        const blacklist = (db.get(`automod_nsfwname_blacklist_${guild.id}`) || []).map((s) => String(s).toLowerCase());
        const nameNow = (newMember.nickname || newMember.user?.username || '').toLowerCase();
        const bad = blacklist.length > 0 && blacklist.some((w) => nameNow.includes(w));
        if (bad && !isBypassed(newMember.id)) {
          const action = db.get(`automod_nsfwname_action_${guild.id}`) || 'auto_nickname';
          const template = db.get(`automod_nsfwname_template_${guild.id}`) || 'Membre sécurisé';
          const reason = 'AutoMod: NSFW/Offensif dans pseudo';
          try {
            if (action === 'timeout') {
              const me = guild.members.me;
              if (me && me.permissions.has(PermissionFlagsBits.ModerateMembers) && newMember.moderatable) await newMember.timeout(10 * 60 * 1000, reason);
            } else if (action === 'ask_rename') {
              try {await newMember.send({ content: `Votre pseudo/nom contient des termes interdits. Merci de le modifier. (${guild.name})` });} catch (_) {}
            } else {
              if (guild.members.me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
                await newMember.setNickname(template, reason).catch(() => {});
              }
            }
            if (raidlog) await raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`<@${newMember.id}> action **${action}** • ${reason}`));
          } catch (_) {}
        }
      }
    } catch (_) {}


    try {
      const enabled = db.get(`automod_rolespam_${guild.id}`) === true;
      if (enabled) {
        const entry = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate }).then((a) => a.entries.first()).catch(() => null);
        if (entry && entry.executor) {
          const actorId = entry.executor.id;
          if (!isBypassed(actorId)) {
            const key = `automod_rolespam_${guild.id}_${actorId}`;
            const windowMs = 60 * 1000;
            const max = db.get(`automod_rolespam_max_per_min_${guild.id}`) || 10;
            const now = Date.now();
            const bucket = (db.get(key) || []).filter((ts) => now - ts <= windowMs);
            bucket.push(now);
            db.set(key, bucket);
            if (bucket.length > max) {
              const sanction = db.get(`automod_rolespam_sanction_${guild.id}`) || 'timeout';
              const reason = `AutoMod: Role spam (${bucket.length}/${max} par min)`;
              try {
                const member = await guild.members.fetch(actorId).catch(() => null);
                if (member) {
                  if (sanction === 'ban') await member.ban({ reason });else
                  if (sanction === 'kick') await member.kick(reason);else
                  if (sanction === 'derank') await member.roles.set([], reason);else
                  {
                    const me = guild.members.me;
                    if (me && me.permissions.has(PermissionFlagsBits.ModerateMembers) && member.moderatable) await member.timeout(10 * 60 * 1000, reason);
                  }
                  try {await member.send({ content: `Vous avez modifié trop de rôles rapidement. ${reason}.` });} catch (_) {}
                  if (raidlog) await raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`<@${actorId}> sanctionné: **${sanction}** • ${reason}`));
                }
              } catch (_) {}
            }
            setTimeout(() => {
              const b = db.get(key) || [];
              db.set(key, b.filter((ts) => Date.now() - ts <= windowMs));
            }, windowMs + 1000);
          }
        }
      }
    } catch (_) {}
  } catch (_) {}
};
