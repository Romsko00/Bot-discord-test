const db = require('../../utils/simpledb');
const logger = require('../../utils/logger');
const { EmbedBuilder } = require('discord.js');

function formatInviteMessage(text, member, inviter, inviteCount) {
  if (!text || !member?.user || !member?.guild) return text;
  const invName = inviter ? inviter.username : 'Inconnu';
  const invTag = inviter ? (inviter.tag || `${inviter.username}#0000`) : 'Inconnu';
  const invId = inviter ? inviter.id : 'Inconnu';
  return String(text)
    .replaceAll('{user}', member.user.toString())
    .replaceAll('{user:name}', member.user.username)
    .replaceAll('{user:tag}', member.user.tag)
    .replaceAll('{user:id}', member.user.id)
    .replaceAll('{inviter}', inviter ? inviter.toString() : 'Inconnu')
    .replaceAll('{inviter:name}', invName)
    .replaceAll('{inviter:tag}', invTag)
    .replaceAll('{inviter:id}', invId)
    .replaceAll('{invite}', String(inviteCount ?? 0))
    .replaceAll('{invites}', String(inviteCount ?? 0))
    .replaceAll('{membre:counter}', String(member.guild.memberCount))
    .replaceAll('{guild:name}', member.guild.name)
    .replaceAll('{guild:member}', String(member.guild.memberCount))
    .replaceAll('{guild:members}', String(member.guild.memberCount));
}

module.exports = async (client, member) => {
  // Dedup cross-clients : un seul bot traite chaque arrivee
  if (!global._handledMemberAdd) global._handledMemberAdd = new Set();
  const memberKey = `${member.guild.id}:${member.id}`;
  if (global._handledMemberAdd.has(memberKey)) return;
  global._handledMemberAdd.add(memberKey);
  setTimeout(() => global._handledMemberAdd.delete(memberKey), 60000);

  try {
    let inviter = null;
    let inviteCount = 0;

    // --- 1. TRACKING DES INVITATIONS (en premier pour avoir inviter + sauvegarder l'état) ---
    const trackingEnabled = db.get(`invitetracking_${member.guild.id}`);
    if (trackingEnabled) {
      const guildInvites = await member.guild.invites.fetch().catch(() => null);
      if (guildInvites) {
        const storedInvites = db.get(`guild_invites_${member.guild.id}`) || {};

        for (const [code, inviteData] of Object.entries(storedInvites)) {
          const cachedInvite = guildInvites.get(code);
          if (cachedInvite && inviteData.uses < cachedInvite.uses) {
            inviter = cachedInvite.inviter;
            inviteCount = cachedInvite.uses;
            break;
          }
        }

        const updatedInvites = {};
        guildInvites.forEach((inv) => {
          updatedInvites[inv.code] = {
            uses: inv.uses,
            inviter: inv.inviter ? inv.inviter.id : null,
            createdTimestamp: inv.createdTimestamp
          };
        });
        db.set(`guild_invites_${member.guild.id}`, updatedInvites);
        if (client.guildInvites) client.guildInvites.set(member.guild.id, guildInvites);

        if (inviter) {
          const currentInvites = db.get(`invites_${member.guild.id}_${inviter.id}`) || 0;
          const newCount = currentInvites + 1;
          db.set(`invites_${member.guild.id}_${inviter.id}`, newCount);
          const currentRegular = db.get(`Regular_${member.guild.id}_${inviter.id}`) || 0;
          db.set(`Regular_${member.guild.id}_${inviter.id}`, currentRegular + 1);
          db.set(`inviter_${member.guild.id}_${member.id}`, inviter.id);

          const roleRewards = db.all()
            .filter((d) => d.ID && d.ID.startsWith(`inviterole_${member.guild.id}_`))
            .map((d) => {
              const parts = d.ID.split('_');
              return { roleId: parts[2], invites: parseInt(parts[3], 10) || 0 };
            })
            .filter((r) => r.roleId && !isNaN(r.invites));
          const inviterMember = await member.guild.members.fetch(inviter.id).catch(() => null);
          if (inviterMember) {
            for (const reward of roleRewards) {
              if (newCount >= reward.invites) {
                const role = member.guild.roles.cache.get(reward.roleId);
                if (role && !inviterMember.roles.cache.has(role.id)) {
                  await inviterMember.roles.add(role).catch(() => {});
                }
              }
            }
          }
        }
      } else {
        logger.warn && logger.warn(`[guildMemberAdd] Impossible de récupérer les invitations pour ${member.guild.id}`);
      }
    }

    // --- 2. MESSAGE D'INVITATION (salon configuré via +invite) ---
    const inviteChannelId = db.get(`invitechannelmessage_${member.guild.id}`);
    const inviteMsg = db.get(`invitemessage_${member.guild.id}`);
    const inviteEmbed = db.get(`invitemessageembed_${member.guild.id}`);
    const inviteStyle = db.get(`invitestyle_${member.guild.id}`) || (inviteEmbed ? 'embed' : 'message');
    if (inviteChannelId && (inviteMsg || inviteEmbed)) {
      try {
        const channel = member.guild.channels.cache.get(inviteChannelId);
        if (channel?.isTextBased()) {
          const me = member.guild.members.me;
          if (me && channel.permissionsFor(me)?.has('SendMessages')) {
            if (inviteStyle === 'embed' && inviteEmbed) {
              const embedData = typeof inviteEmbed === 'object' && !inviteEmbed.toJSON ? inviteEmbed : (inviteEmbed.data || inviteEmbed);
              const payload = typeof embedData.toJSON === 'function' ? embedData.toJSON() : { ...embedData };
              if (payload.title) payload.title = formatInviteMessage(payload.title, member, inviter, inviteCount);
              if (payload.description) payload.description = formatInviteMessage(payload.description, member, inviter, inviteCount);
              if (payload.footer?.text) payload.footer.text = formatInviteMessage(payload.footer.text, member, inviter, inviteCount);
              if (payload.author?.name) payload.author.name = formatInviteMessage(payload.author.name, member, inviter, inviteCount);
              if (payload.fields) {
                payload.fields = payload.fields.map((f) => ({
                  ...f,
                  name: formatInviteMessage(f.name, member, inviter, inviteCount),
                  value: formatInviteMessage(f.value, member, inviter, inviteCount)
                }));
              }
              await channel.send({ embeds: [new EmbedBuilder(payload)] });
            } else if (inviteMsg) {
              const content = formatInviteMessage(inviteMsg, member, inviter, inviteCount);
              await channel.send(content);
            }
          }
        }
      } catch (err) {
        logger.error && logger.error(`[guildMemberAdd] Erreur envoi message invitation: ${err.message}`);
      }
    }

    // --- 3. WELCOME (message de bienvenue + rôle auto) ---
    try {
      const welcomeCommand = require('../../commands/gestion/welcome.js');
      if (welcomeCommand?.handleMemberJoin) {
        await welcomeCommand.handleMemberJoin(client, member);
      }
    } catch (err) {
      logger.error && logger.error(`[guildMemberAdd] Erreur welcome pour ${member.user.tag}: ${err.message}`);
    }

    logger.info && logger.info(`[guildMemberAdd] ${member.user.tag} (${member.user.id}) a rejoint ${member.guild.name} (${member.guild.id})`);
  } catch (error) {
    logger.error && logger.error(`[guildMemberAdd] Erreur générale: ${error.message}`);
  }
};
