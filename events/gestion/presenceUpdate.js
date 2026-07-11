const db = require("../../utils/simpledb");
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const soutien = require("../../utils/soutienSystem");

module.exports = async (client, oldPresence, newPresence) => {
  try {
    const guild = newPresence?.guild;
    const member = newPresence?.member;
    if (!guild || !member || member.user.bot) return;

    const config = soutien.getConfig(guild.id);

    if (!config.isActive || !config.roleId || !config.statusText) return;

    const role = guild.roles.cache.get(config.roleId);
    if (!role) return;

    const me = guild.members.me;
    if (!me || !me.permissions.has(PermissionFlagsBits.ManageRoles)) return;

    if (Array.isArray(config.whitelistRoles) && config.whitelistRoles.length > 0) {
      const inWhitelist = member.roles.cache.some((r) => config.whitelistRoles.includes(r.id));
      if (!inWhitelist) return;
    }

    if (Array.isArray(config.blacklistRoles) && config.blacklistRoles.length > 0) {
      const inBlacklist = member.roles.cache.some((r) => config.blacklistRoles.includes(r.id));
      if (inBlacklist) return;
    }

    const now = Date.now();
    const lastCheckKey = `soutien_last_${guild.id}_${member.id}`;
    const lastCheck = db.get(lastCheckKey) || 0;
    const interval = config.checkInterval || 120000;
    if (now - lastCheck < interval) return;
    db.set(lastCheckKey, now);

    const hasStatus = await soutien.checkMemberStatus(member, config);

    const hadRole = member.roles.cache.has(role.id);

    if (hasStatus && !hadRole) {
      await member.roles.add(role).catch(() => { });
      if (config.logsEnabled && config.logChannel) {
        const logChannel = guild.channels.cache.get(config.logChannel);
        if (logChannel && logChannel.send) {
          try {
            await logChannel.send({
              embeds: [
                new EmbedBuilder().
                  setColor(client.config.SETTINGS.EMBED_COLOR).
                  setDescription(`<a:_:1483497369315315786> Ajout du rôle ${role} à ${member} (statut de soutien détecté).`)
              ]
            });
          } catch (_) { }
        }
      }
    } else if (!hasStatus && hadRole) {
      await member.roles.remove(role).catch(() => { });
      if (config.logsEnabled && config.logChannel) {
        const logChannel = guild.channels.cache.get(config.logChannel);
        if (logChannel && logChannel.send) {
          try {
            await logChannel.send({
              embeds: [
                new EmbedBuilder().
                  setColor(client.config.SETTINGS.EMBED_COLOR).
                  setDescription(`<a:_:1483497365863399536> Retrait du rôle ${role} à ${member} (statut de soutien non détecté).`)
              ]
            });
          } catch (_) { }
        }
      }
    }
  } catch (e) {
    console.error("Erreur presenceUpdate soutien:", e);
  }
};
