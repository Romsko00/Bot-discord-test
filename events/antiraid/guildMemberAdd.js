const axios = require('axios');
const db = require("../../utils/simpledb");
const { EmbedBuilder } = require("discord.js");
const ms = require("ms");
const Discord = require("discord.js");
const path = require('path');

module.exports = async (client, member) => {
  // NOTE: handleMemberJoin est géré par events/invite/guildMemberAdd.js pour éviter les doublons
  // Ne pas appeler handleMemberJoin ici pour éviter le double envoi du message de bienvenue

  const guild = member.guild;
  const raidlog = guild.channels.cache.get(db.get(`${guild.id}.raidlog`));
  const color = db.get(`color_${guild.id}`) === null ? client.config.color : db.get(`color_${guild.id}`);


  try {
    const antiTokenEnabled = db.get(`automod_antitoken_${guild.id}`) === true;
    if (antiTokenEnabled) {
      const minDays = db.get(`automod_antitoken_min_days_${guild.id}`) || 3;
      const ageMs = Date.now() - (member.user?.createdTimestamp || 0);
      const minMs = minDays * 24 * 60 * 60 * 1000;
      if (ageMs < minMs) {
        const sanction = db.get(`automod_antitoken_sanction_${guild.id}`) || 'timeout';
        const reason = `AutoMod: Anti-Token (compte < ${minDays}j)`;
        try {
          if (sanction === 'ban') {
            await guild.members.ban(member.id, { deleteMessageSeconds: 86400, reason });
          } else if (sanction === 'kick') {
            await member.kick(reason);
          } else if (sanction === 'derank') {
            await member.roles.set([], reason);
          } else {
            const me = guild.members.me;
            if (me && me.permissions.has(Discord.PermissionFlagsBits.ModerateMembers) && member.moderatable) {
              await member.timeout(10 * 60 * 1000, reason);
            }
          }
          try {await member.send({ content: `Bonjour, votre compte est trop récent pour rejoindre "${guild.name}". Raison: ${reason}.` });} catch (_) {}
          if (raidlog) await raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`${member} sanctionné: **${sanction}** • ${reason}`));
          return;
        } catch (_) {}
      }
    }
  } catch (_) {}


  try {
    const massJoinEnabled = db.get(`automod_massjoin_${guild.id}`) === true;
    if (massJoinEnabled) {
      const max = db.get(`automod_massjoin_max_${guild.id}`) || 5;
      const windowMs = db.get(`automod_massjoin_window_ms_${guild.id}`) || 10000;
      const key = `automod_massjoin_bucket_${guild.id}`;
      const now = Date.now();
      const bucket = (db.get(key) || []).filter((ts) => now - ts <= windowMs);
      bucket.push(now);
      db.set(key, bucket);
      if (bucket.length >= max) {
        const sanction = db.get(`automod_massjoin_sanction_${guild.id}`) || 'timeout';
        const reason = `AutoMod: Mass Join détecté (${bucket.length}/${max} en ${Math.round(windowMs / 1000)}s)`;
        try {
          if (sanction === 'ban') {
            await guild.members.ban(member.id, { deleteMessageSeconds: 0, reason });
          } else if (sanction === 'kick') {
            await member.kick(reason);
          } else if (sanction === 'derank') {
            await member.roles.set([], reason);
          } else {
            const me = guild.members.me;
            if (me && me.permissions.has(Discord.PermissionFlagsBits.ModerateMembers) && member.moderatable) {
              await member.timeout(10 * 60 * 1000, reason);
            }
          }
          try {await member.send({ content: `Bonjour, un flux anormal de joins a été détecté sur "${guild.name}". Raison: ${reason}.` });} catch (_) {}
          if (raidlog) await raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`${member} sanctionné: **${sanction}** • ${reason}`));
        } catch (_) {}
      }

      setTimeout(() => {
        const b = db.get(key) || [];
        db.set(key, b.filter((ts) => Date.now() - ts <= windowMs));
      }, windowMs + 1000);
    }
  } catch (_) {}

  if (db.get(`antitoken_${member.guild.id}`) === true) {

    const joinKey = `join_${guild.id}_${member.id}`;
    const lastJoin = db.get(joinKey);
    const now = Date.now();

    if (lastJoin && now - lastJoin < 60000) {

      if (db.get(`antitokensanction_${guild.id}`) === "ban") {
        member.ban({ reason: 'Antitoken - Rapid rejoin detected' }).then(() => {
          if (raidlog) raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`${member} a été **ban** pour rejoignage rapide suspect (antitoken)`));
        }).catch(() => {
          if (raidlog) raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`${member} rejoignage rapide suspect, mais n'a pas pu être **ban**`));
        });
      } else if (db.get(`antitokensanction_${guild.id}`) === "kick") {
        member.kick('Antitoken - Rapid rejoin detected').then(() => {
          if (raidlog) raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`${member} a été **kick** pour rejoignage rapide suspect (antitoken)`));
        }).catch(() => {
          if (raidlog) raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`${member} rejoignage rapide suspect, mais n'a pas pu être **kick**`));
        });
      }
    }

    db.set(joinKey, now);

    setTimeout(() => db.delete(joinKey), 300000);
  }

  if (db.get(`crealimit_${member.guild.id}`) === true) {
    const duration = ms(db.get(`crealimittemps_${member.guild.id}`) || "0s");
    let created = member.user.createdTimestamp;
    let sum = created + duration;
    let diff = Date.now() - sum;

    if (diff < 0) {

      member.kick();
    }
    const embed = new Discord.EmbedBuilder().
    setColor(client.config.SETTINGS.EMBED_COLOR).
    setDescription(`${member} à été **kick** parce que \`sont compte à été crée trop résamment\``);
    if (raidlog) raidlog.send(embed);
  }

  if (db.get(`blmd_${client.user.id}_${member.id}`) === true) {
    member.ban().then(() => {
      if (raidlog) return raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`${member} a rejoins alors qu'il êtait blacklist, il a été **ban**`));

    }).catch(() => {
      if (raidlog) return raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`${member} a rejoins alors qu'il êtait blacklist, mais il n'a pas pu être **ban**`));

    });
  }

  if (member.user.bot) {
    const action = await guild.fetchAuditLogs({ limit: 1, type: "BOT_ADD" }).then(async (audit) => audit.entries.first());
    if (action.executor.id) {
      let perm = "";
      if (db.get(`botwl_${guild.id}`) === null) perm = client.user.id === action.executor.id || guild.ownerId === action.executor.id || client.config.owners.includes(action.executor.id) || db.get(`ownermd_${client.user.id}_${action.executor.id}`) === true || db.get(`wlmd_${guild.id}_${action.executor.id}`) === true;
      if (db.get(`botwl_${guild.id}`) === true) perm = client.user.id === action.executor.id || guild.ownerId === action.executor.id || client.config.owners.includes(action.executor.id) || db.get(`ownermd_${client.user.id}_${action.executor.id}`) === true;
      if (db.get(`bot_${guild.id}`) === true && !perm) {
        if (db.get(`botsanction_${guild.id}`) === "ban") {
          axios({
            url: `https://discord.com/api/v9/guilds/${guild.id}/bans/${action.executor.id}`,
            method: 'PUT',
            headers: {
              Authorization: `Bot ${client.botToken}`
            },
            data: {
              delete_message_days: '1',
              reason: 'Antiban'
            }
          }).then(() => {

            if (raidlog) return raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`<@${action.executor.id}> a inviter le bot ${member}, il a été **ban** !`));
          }
          ).catch(() => {

            if (raidlog) return raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`<@${action.executor.id}> a inviter le bot ${member}, mais il n'a pas pu être **ban** !`));

          }
          );
        } else if (db.get(`botsanction_${guild.id}`) === "kick") {
          guild.members.cache.get(action.executor.id).kick().then(() => {

            if (raidlog) return raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`<@${action.executor.id}> a inviter le bot ${member}, il a été **kick** !`));
          }).catch(() => {

            if (raidlog) return raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`<@${action.executor.id}> a inviter le bot ${member}, mais il n'a pas pu être **kick** !`));
          });
        } else if (db.get(`botsanction_${guild.id}`) === "derank") {

          guild.members.cache.get(action.executor.id).roles.set([]).then(() => {


            if (raidlog) return raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`<@${action.executor.id}> a inviter le bot ${member}, il a été **derank** !`));
          }).catch(() => {

            if (raidlog) return raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`<@${action.executor.id}> a inviter le bot ${member}, mais il n'a pas pu être **derank** !`));
          });
        }

      }
    }

  }
};
