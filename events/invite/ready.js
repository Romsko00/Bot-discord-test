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

module.exports = (client) => {
  client.guilds.cache.forEach(async (guild) => {
    try {
      if (typeof client.isResponsibleForGuild === 'function' && !client.isResponsibleForGuild(guild.id)) {
        return;
      }
      let invites = await guild.invites.fetch();
      if (guild.vanityURLCode) {
        try {
          const vanityData = await guild.fetchVanityData();
          if (vanityData) invites.set(guild.vanityURLCode, vanityData);
        } catch (_) {}
      }
      client.guildInvites.set(guild.id, invites);
      persistInvitesToDb(guild.id, invites);
    } catch (error) {
      console.log(`Impossible de récupérer les invitations pour ${guild.name}: ${error.message}`);
    }
  });
};
