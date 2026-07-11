const db = require("../../utils/simpledb");
const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require("discord.js");

module.exports = async (client, channelUpdated) => {
  const guild = channelUpdated.guild;
  if (!guild) return;

  const raidlog = guild.channels.cache.get(db.get(`${guild.id}.raidlog`));

  try {
    const entry = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookCreate }).then((a) => a.entries.first());
    if (!entry || !entry.executor) return;

    const executorId = entry.executor.id;


    const owners = client.config.owners || [];
    const guildOwnerId = guild.ownerId;
    const whitelistBypass = db.get(`webhookwl_${guild.id}`);
    let isBypassed = false;
    if (whitelistBypass === null) {
      isBypassed = executorId === client.user.id || executorId === guildOwnerId || owners.includes(executorId) || db.get(`ownermd_${client.user.id}_${executorId}`) === true || db.get(`wlmd_${guild.id}_${executorId}`) === true;
    } else {
      isBypassed = executorId === client.user.id || executorId === guildOwnerId || owners.includes(executorId) || db.get(`ownermd_${client.user.id}_${executorId}`) === true;
    }

    const enabled = db.get(`webhook_${guild.id}`) === true;
    if (!enabled || isBypassed) return;


    const sanction = db.get(`webhooksanction_${guild.id}`) || 'ban';

    const member = await guild.members.fetch(executorId).catch(() => null);
    if (!member) return;


    try {
      if (sanction === 'ban') {
        await guild.members.ban(executorId, { deleteMessageSeconds: 86400, reason: 'Antiwebhook' });
      } else if (sanction === 'kick') {
        await member.kick('Antiwebhook');
      } else if (sanction === 'derank') {
        await member.roles.set([], 'Antiwebhook');
      }
      if (raidlog) await raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`<@${executorId}> a créé un webhook, sanction appliquée: **${sanction}**.`));
    } catch (e) {
      if (raidlog) await raidlog.send(new EmbedBuilder().setColor(client.config.SETTINGS.EMBED_COLOR).setDescription(`<@${executorId}> a créé un webhook, mais la sanction **${sanction}** a échoué.`));
    }


    try {
      const webhooks = await channelUpdated.fetchWebhooks();
      for (const hook of webhooks.values()) {
        if (hook.owner && hook.owner.id === executorId) {
          await hook.delete('Antiwebhook');
        }
      }
    } catch (_) {}
  } catch (_) {
    return;
  }
};
