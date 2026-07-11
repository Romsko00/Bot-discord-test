const db = require('../../utils/simpledb');
const { EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const { safeSend } = require('../../utils/safeSend');

function formatTemplate(text, member, inviter, inviteCount) {
  if (!member || !member.user || !member.guild) return text;

  const invName = inviter ? inviter.username : 'Inconnu';
  const invTag = inviter ? inviter.tag || `${inviter.username}#0000` : 'Inconnu';
  const invId = inviter ? inviter.id : 'Inconnu';
  const memberCounter = member.guild.memberCount;

  return String(text).
    replaceAll('{user}', member.user.toString()).
    replaceAll('{user:name}', member.user.username).
    replaceAll('{user:tag}', member.user.tag).
    replaceAll('{user:id}', member.user.id).
    replaceAll('{inviter}', inviter ? inviter.toString() : 'Inconnu').
    replaceAll('{inviter:name}', invName).
    replaceAll('{inviter:tag}', invTag).
    replaceAll('{inviter:id}', invId).
    replaceAll('{invite}', String(inviteCount ?? 0)).
    replaceAll('{invites}', String(inviteCount ?? 0)).
    replaceAll('{membre:counter}', String(memberCounter)).
    replaceAll('{guild:name}', member.guild.name).
    replaceAll('{guild:member}', String(member.guild.memberCount)).
    replaceAll('{guild:members}', String(member.guild.memberCount));
}

module.exports = async (client, member) => {
  try {
    const guildId = member.guild.id;
    const trackingEnabled = db.get(`invitetracking_${guildId}`);

    // --- 1. TRACKING INVITATIONS (uniquement si activé) ---
    if (trackingEnabled) {
      const inviterId = db.get(`inviter_${guildId}_${member.id}`);

      if (inviterId) {
        const currentInvites = db.get(`invites_${guildId}_${inviterId}`) || 0;
        if (currentInvites > 0) {
          db.set(`invites_${guildId}_${inviterId}`, currentInvites - 1);
        }
        const currentLeaves = db.get(`leaves_${guildId}_${inviterId}`) || 0;
        db.set(`leaves_${guildId}_${inviterId}`, currentLeaves + 1);

        const roleRewards = db.all()
          .filter((d) => d.ID && d.ID.startsWith(`inviterole_${guildId}_`))
          .map((d) => {
            const parts = d.ID.split('_');
            return { roleId: parts[2], invites: parseInt(parts[3], 10) || 0 };
          })
          .filter((r) => r.roleId && !isNaN(r.invites));
        const inviterMember = await member.guild.members.fetch(inviterId).catch(() => null);

        if (inviterMember) {
          const newCount = currentInvites > 0 ? currentInvites - 1 : 0;
          for (const reward of roleRewards) {
            if (newCount < reward.invites) {
              const role = member.guild.roles.cache.get(reward.roleId);
              if (role && inviterMember.roles.cache.has(role.id)) {
                await inviterMember.roles.remove(role).catch(() => {});
              }
            }
          }
        }
      }
    }

    // --- 2. MESSAGE D'AUREVOIR (toujours exécuté si configuré, même sans tracking) ---
    const leaveChannelId = db.get(`leavechannelmessage_${guildId}`);
    const leaveMsg = db.get(`leavemessage_${guildId}`);
    const leaveEmbed = db.get(`leavemessageembed_${guildId}`);
    const leaveStyle = db.get(`leavestyle_${guildId}`) || (leaveEmbed ? 'embed' : 'message');
    const inviteCountForTemplate = 0;

    if (leaveChannelId && (leaveMsg || leaveEmbed)) {
      try {
        let payload;
        if (leaveStyle === 'embed' && leaveEmbed) {
          const raw = leaveEmbed.data ?? leaveEmbed;
          const embedData = typeof raw === 'string' ? JSON.parse(raw) : { ...raw };
          if (embedData.title) embedData.title = formatTemplate(embedData.title, member, null, inviteCountForTemplate);
          if (embedData.description) embedData.description = formatTemplate(embedData.description, member, null, inviteCountForTemplate);
          if (embedData.footer?.text) embedData.footer.text = formatTemplate(embedData.footer.text, member, null, inviteCountForTemplate);
          if (embedData.author?.name) embedData.author.name = formatTemplate(embedData.author.name, member, null, inviteCountForTemplate);
          if (Array.isArray(embedData.fields)) {
            embedData.fields = embedData.fields.map((f) => ({
              ...f,
              name: formatTemplate(f.name || '', member, null, inviteCountForTemplate),
              value: formatTemplate(f.value || '', member, null, inviteCountForTemplate)
            }));
          }
          payload = { embeds: [new EmbedBuilder(embedData)] };
        } else if (leaveMsg) {
          payload = { content: formatTemplate(leaveMsg, member, null, inviteCountForTemplate) };
        } else {
          payload = null;
        }
        if (payload) {
          let channel = member.guild.channels.cache.get(leaveChannelId);
          if (!channel) channel = await client.channels.fetch(leaveChannelId).catch(() => null);
          if (channel?.isTextBased()) {
            const me = member.guild.members?.me;
            if (me && channel.permissionsFor(me)?.has?.('SendMessages')) {
              await channel.send(payload);
            } else {
              await safeSend(client, member.guild, leaveChannelId, payload, !!leaveEmbed, 'LEAVE');
            }
          } else {
            await safeSend(client, member.guild, leaveChannelId, payload, !!leaveEmbed, 'LEAVE');
          }
        }
      } catch (err) {
        logger.error && logger.error(`[guildMemberRemove] Erreur envoi message leave: ${err.message}`);
      }
    }

    logger.info && logger.info(`[guildMemberRemove] ${member.user?.tag || member.id} a quitté ${member.guild.name} (${guildId})`);
  } catch (error) {
    logger.error && logger.error(`[guildMemberRemove] Erreur générale: ${error.message}`);
  }
};
