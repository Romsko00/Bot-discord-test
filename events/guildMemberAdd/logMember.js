const LogSystem = require('../../utils/logSystem');

module.exports = async (client, member) => {
  const logSystem = new LogSystem(client);
  
  // Récupérer l'invitation si possible
  let invite = null;
  try {
    const invites = await member.guild.invites.fetch();
    // Logique pour trouver l'invitation utilisée (nécessite un suivi)
    // Pour l'instant, on mettra null
  } catch (error) {
    // Ignorer les erreurs de permissions
  }
  
  const extra = { invite };
  
  await logSystem.logMember(member.guild, 'join', member, extra);
};
