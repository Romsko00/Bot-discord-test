const axios = require('axios');
const db = require("../../utils/simpledb");
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { sendRaidLog } = require('../../utils/raidlog');
const ms = require("ms");

module.exports = (client, channel) => {
  const guild = channel.guild;
  if (!guild) return;

  const color = db.get(`color_${guild.id}`) === null ? client.config.color : db.get(`color_${guild.id}`);

  try {
    axios.get(`https://discord.com/api/v9/guilds/${guild.id}/audit-logs?limit=1&action_type=10`, {
      headers: {
        Authorization: `Bot ${client.botToken}`
      }
    }).then(async (response) => {
      if (response.data && response.data.audit_log_entries[0].user_id) {
        const actorId = response.data.audit_log_entries[0].user_id;
        let perm = "";
        if (db.get(`channelscreatewl_${guild.id}`) === null) perm = client.user.id === actorId || guild.ownerId === actorId || client.config.owners.includes(actorId) || db.get(`ownermd_${client.user.id}_${actorId}`) === true || db.get(`wlmd_${guild.id}_${actorId}`) === true;
        if (db.get(`channelscreatewl_${guild.id}`) === true) perm = client.user.id === actorId || guild.ownerId === actorId || client.config.owners.includes(actorId) || db.get(`ownermd_${client.user.id}_${actorId}`) === true;

        try {
          const chSpamEnabled = db.get(`automod_channelspam_${guild.id}`) === true;
          if (chSpamEnabled && !perm) {
            const max = db.get(`automod_channelspam_max_${guild.id}`) || 5;
            const windowMs = db.get(`automod_channelspam_window_ms_${guild.id}`) || 10000;
            const key = `automod_channelspam_${guild.id}_${actorId}`;
            const now = Date.now();
            const bucket = (db.get(key) || []).filter((ts) => now - ts <= windowMs);
            bucket.push(now);
            db.set(key, bucket);
            if (bucket.length >= max) {
              const sanction = db.get(`automod_channelspam_sanction_${guild.id}`) || 'timeout';
              const reason = `AutoMod: Channel spam (créations ${bucket.length}/${max} en ${Math.round(windowMs / 1000)}s)`;
              try {
                const member = guild.members.cache.get(actorId) || (await guild.members.fetch(actorId).catch(() => null));
                if (member) {
                  if (sanction === 'ban') await member.ban({ deleteMessageSeconds: 0, reason });else
                  if (sanction === 'kick') await member.kick(reason);else
                  if (sanction === 'derank') await member.roles.set([], reason);else
                  {
                    const me = guild.members.me;
                    if (me && me.permissions.has(PermissionFlagsBits.ModerateMembers) && member.moderatable) await member.timeout(10 * 60 * 1000, reason);
                  }
                }
              } catch (_) {}
            }
            setTimeout(() => {
              const b = db.get(key) || [];
              db.set(key, b.filter((ts) => Date.now() - ts <= windowMs));
            }, windowMs + 1000);
          }
        } catch (_) {}

        if (db.get(`channelscreate_${guild.id}`) === true && !perm) {
          const raidlog = guild.channels.cache.get(db.get(`${guild.id}.raidlog`));
          if (db.get(`channelscreatesanction_${guild.id}`) === "ban") {
            axios({
              url: `https://discord.com/api/v9/guilds/${guild.id}/bans/${response.data.audit_log_entries[0].user_id}`,
              method: 'PUT',
              headers: {
                Authorization: `Bot ${client.botToken}`
              },
              data: {
                delete_message_days: '1',
                reason: 'Antichannel'
              }
            }).then(() => {
              axios({
                url: `https://discord.com/api/v9/guilds/${guild.id}/channels/${channel.id}`,
                method: 'DELETE',
                headers: {
                  Authorization: `Bot ${client.botToken}`
                }
              });
              sendRaidLog(guild, {
                title: 'AntiChannel • Création de salon bloquée',
                description: `<@${actorId}> a créé le salon \`${channel.name}\`.
Sanction appliquée: **ban**. Le salon a été supprimé.`,
                fields: [
                { name: 'Acteur', value: `<@${actorId}> (${actorId})`, inline: true },
                { name: 'Salon', value: `${channel.name} (${channel.id})`, inline: true },
                { name: 'Résultat', value: 'Succès', inline: true }]

              });
            }
            ).catch(() => {
              axios({
                url: `https://discord.com/api/v9/guilds/${guild.id}/channels/${channel.id}`,
                method: 'DELETE',
                headers: {
                  Authorization: `Bot ${client.botToken}`
                }
              });
              sendRaidLog(guild, {
                title: 'AntiChannel • Création de salon détectée',
                description: `<@${actorId}> a créé le salon \`${channel.name}\`.
Sanction **ban** échouée. Le salon a été supprimé.`,
                fields: [
                { name: 'Acteur', value: `<@${actorId}> (${actorId})`, inline: true },
                { name: 'Salon', value: `${channel.name} (${channel.id})`, inline: true },
                { name: 'Résultat', value: 'Partiel', inline: true }]

              });

            }
            );
          } else if (db.get(`channelscreatesanction_${guild.id}`) === "kick") {
            guild.members.cache.get(response.data.audit_log_entries[0].user_id).kick().then(() => {

              axios({
                url: `https://discord.com/api/v9/guilds/${guild.id}/channels/${channel.id}`,
                method: 'DELETE',
                headers: {
                  Authorization: `Bot ${client.botToken}`
                }
              });
              sendRaidLog(guild, {
                title: 'AntiChannel • Création de salon bloquée',
                description: `<@${actorId}> a créé le salon \`${channel.name}\`.
Sanction appliquée: **kick**. Le salon a été supprimé.`,
                fields: [
                { name: 'Acteur', value: `<@${actorId}> (${actorId})`, inline: true },
                { name: 'Salon', value: `${channel.name} (${channel.id})`, inline: true },
                { name: 'Résultat', value: 'Succès', inline: true }]

              });
            }).catch(() => {
              axios({
                url: `https://discord.com/api/v9/guilds/${guild.id}/channels/${channel.id}`,
                method: 'DELETE',
                headers: {
                  Authorization: `Bot ${client.botToken}`
                }
              });
              sendRaidLog(guild, {
                title: 'AntiChannel • Création de salon détectée',
                description: `<@${actorId}> a créé le salon \`${channel.name}\`.
Sanction **kick** échouée. Le salon a été supprimé.`,
                fields: [
                { name: 'Acteur', value: `<@${actorId}> (${actorId})`, inline: true },
                { name: 'Salon', value: `${channel.name} (${channel.id})`, inline: true },
                { name: 'Résultat', value: 'Partiel', inline: true }]

              });
            });
          } else if (db.get(`channelscreatesanction_${guild.id}`) === "derank") {

            guild.members.cache.get(response.data.audit_log_entries[0].user_id).roles.set([]).then(() => {

              axios({
                url: `https://discord.com/api/v9/guilds/${guild.id}/channels/${channel.id}`,
                method: 'DELETE',
                headers: {
                  Authorization: `Bot ${client.botToken}`
                }
              });
              sendRaidLog(guild, {
                title: 'AntiChannel • Création de salon bloquée',
                description: `<@${actorId}> a créé le salon \`${channel.name}\`.
Sanction appliquée: **derank**. Le salon a été supprimé.`,
                fields: [
                { name: 'Acteur', value: `<@${actorId}> (${actorId})`, inline: true },
                { name: 'Salon', value: `${channel.name} (${channel.id})`, inline: true },
                { name: 'Résultat', value: 'Succès', inline: true }]

              });
            }).catch(() => {
              axios({
                url: `https://discord.com/api/v9/guilds/${guild.id}/channels/${channel.id}`,
                method: 'DELETE',
                headers: {
                  Authorization: `Bot ${client.botToken}`
                }
              });
              sendRaidLog(guild, {
                title: 'AntiChannel • Création de salon détectée',
                description: `<@${actorId}> a créé le salon \`${channel.name}\`.
Sanction **derank** échouée. Le salon a été supprimé.`,
                fields: [
                { name: 'Acteur', value: `<@${actorId}> (${actorId})`, inline: true },
                { name: 'Salon', value: `${channel.name} (${channel.id})`, inline: true },
                { name: 'Résultat', value: 'Partiel', inline: true }]

              });
            });
          }
        }
      }
    });
  } catch (error) {
    return;
  }
};
