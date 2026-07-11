const db = require("../../utils/simpledb");
const { EmbedBuilder, ActivityType, PermissionFlagsBits } = require("discord.js");

module.exports = async (client, oldPresence, newPresence) => {
  try {
    const guild = newPresence?.guild;
    if (!guild) return;
    const member = newPresence.member;
    if (!member) return;

    const raidlog = guild.channels.cache.get(db.get(`${guild.id}.raidlog`));
    const owners = client.config.owners || [];
    const isBypassed = (userId) => {
      const wl = db.get(`wlmd_${guild.id}_${userId}`) === true;
      const ownermd = db.get(`ownermd_${client.user.id}_${userId}`) === true;
      return userId === client.user.id || userId === guild.ownerId || owners.includes(userId) || ownermd || wl;
    };


    const enabled = db.get(`automod_status_${guild.id}`) === true;
    if (!enabled) return;

    const userId = member.id;
    if (isBypassed(userId)) return;

    const keywords = (db.get(`automod_status_blacklist_${guild.id}`) || []).map((s) => String(s).toLowerCase());
    if (keywords.length === 0) return;

    const activity = (newPresence.activities || []).find((a) => a.type === ActivityType.Custom);
    const state = activity && activity.state ? String(activity.state).toLowerCase() : '';
    if (!state) return;

    const hit = keywords.some((k) => state.includes(k));
    if (!hit) return;

    const action = db.get(`automod_status_action_${guild.id}`) || 'warn';
    const reason = 'AutoMod: statut suspect';

    try {
      if (action === 'timeout') {
        const me = guild.members.me;
        if (me && me.permissions.has(PermissionFlagsBits.ModerateMembers) && member.moderatable) await member.timeout(10 * 60 * 1000, reason);
      } else {
        try {await member.send({ content: `Votre statut sur "${guild.name}" contient des mots interdits. Merci de le modifier.` });} catch (_) {}
      }
      if (raidlog) await raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`<@${userId}> action **${action}** • ${reason} • Contenu: \`${state}\``));
    } catch (_) {}
  } catch (_) {}
};
