const db = require('../../utils/simpledb');

function persistInvitesToDb(guildId, invitesCollection) {
  const data = {};
  invitesCollection.forEach((inv) => {
    data[inv.code] = {
      uses: inv.uses ?? 0,
      inviter: inv.inviter?.id ?? null,
      createdTimestamp: inv.createdTimestamp ?? null
    };
  });
  db.set(`guild_invites_${guildId}`, data);
}

module.exports = async (client, invite) => {
  try {
    if (invite?.guild?.id && typeof client.isResponsibleForGuild === 'function') {
      const inGuild = client.guilds?.cache?.has(invite.guild.id);
      const shouldHandle = !inGuild || client.isResponsibleForGuild(invite.guild.id);
      if (!shouldHandle) return;
    }
  } catch (_) {}

  try {
    const invites = await invite.guild.invites.fetch();
    if (invite.guild.vanityURLCode) {
      try {
        const vanityData = await invite.guild.fetchVanityData();
        if (vanityData) invites.set(invite.guild.vanityURLCode, vanityData);
      } catch (_) {}
    }
    client.guildInvites.set(invite.guild.id, invites);
    persistInvitesToDb(invite.guild.id, invites);
  } catch (err) {
    console.error('[inviteDelete] Erreur:', err.message);
  }
};
