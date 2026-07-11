const db = require('./simpledb');


const guildInvites = new Map();





async function initInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    guildInvites.set(guild.id, new Map(invites.map((invite) => [invite.code, invite.uses])));
  } catch (error) {
    console.error(`Erreur lors de l'initialisation des invitations pour ${guild.name}:`, error);
  }
}





async function initAllInvites(client) {
  for (const guild of client.guilds.cache.values()) {
    await initInvites(guild);
  }
}






async function findUsedInvite(guild) {
  try {
    const newInvites = await guild.invites.fetch();
    const oldInvites = guildInvites.get(guild.id);

    if (!oldInvites) {
      await initInvites(guild);
      return null;
    }


    for (const [code, invite] of newInvites) {
      const oldUses = oldInvites.get(code) || 0;
      if (invite.uses > oldUses) {

        guildInvites.set(guild.id, new Map(newInvites.map((inv) => [inv.code, inv.uses])));
        return invite;
      }
    }


    for (const [code, uses] of oldInvites) {
      if (!newInvites.has(code)) {

        guildInvites.set(guild.id, new Map(newInvites.map((inv) => [inv.code, inv.uses])));
        return null;
      }
    }


    guildInvites.set(guild.id, new Map(newInvites.map((inv) => [inv.code, inv.uses])));
    return null;

  } catch (error) {
    console.error('Erreur lors de la recherche de l\'invitation utilisée:', error);
    return null;
  }
}







function getInviteCount(guildId, userId) {
  return db.get(`invitecount_${guildId}_${userId}`) || 0;
}







function incrementInviteCount(guildId, userId) {
  const currentCount = getInviteCount(guildId, userId);
  const newCount = currentCount + 1;
  db.set(`invitecount_${guildId}_${userId}`, newCount);
  return newCount;
}







function decrementInviteCount(guildId, userId) {
  const currentCount = getInviteCount(guildId, userId);
  const newCount = Math.max(0, currentCount - 1);
  db.set(`invitecount_${guildId}_${userId}`, newCount);
  return newCount;
}







function setInviter(guildId, memberId, inviterId) {
  db.set(`inviter_${guildId}_${memberId}`, inviterId);
}







function getInviter(guildId, memberId) {
  return db.get(`inviter_${guildId}_${memberId}`);
}









function replaceVariables(text, member, inviter, inviteCount) {
  if (!text) return text;

  return text.
  replace(/{user}/g, member.toString()).
  replace(/{user:id}/g, member.user.id).
  replace(/{user:tag}/g, member.user.tag).
  replace(/{user:name}/g, member.user.username).
  replace(/{inviter}/g, inviter ? inviter.toString() : 'Inconnu').
  replace(/{inviter:id}/g, inviter ? inviter.id : 'Inconnu').
  replace(/{inviter:tag}/g, inviter ? inviter.tag : 'Inconnu').
  replace(/{inviter:name}/g, inviter ? inviter.username : 'Inconnu').
  replace(/{invites}/g, inviteCount.toString()).
  replace(/{guild:members}/g, member.guild.memberCount.toString()).
  replace(/{guild:name}/g, member.guild.name);
}









function replaceEmbedVariables(embed, member, inviter, inviteCount) {
  const embedData = embed.data || embed;

  if (embedData.title) {
    embedData.title = replaceVariables(embedData.title, member, inviter, inviteCount);
  }

  if (embedData.description) {
    embedData.description = replaceVariables(embedData.description, member, inviter, inviteCount);
  }

  if (embedData.author && embedData.author.name) {
    embedData.author.name = replaceVariables(embedData.author.name, member, inviter, inviteCount);
  }

  if (embedData.footer && embedData.footer.text) {
    embedData.footer.text = replaceVariables(embedData.footer.text, member, inviter, inviteCount);
  }

  if (embedData.fields) {
    embedData.fields = embedData.fields.map((field) => ({
      ...field,
      name: replaceVariables(field.name, member, inviter, inviteCount),
      value: replaceVariables(field.value, member, inviter, inviteCount)
    }));
  }

  return embedData;
}

module.exports = {
  initInvites,
  initAllInvites,
  findUsedInvite,
  getInviteCount,
  incrementInviteCount,
  decrementInviteCount,
  setInviter,
  getInviter,
  replaceVariables,
  replaceEmbedVariables
};
