const LogSystem = require('../../utils/logSystem');

module.exports = async (client, member) => {
  const logSystem = new LogSystem(client);
  
  await logSystem.logMember(member.guild, 'leave', member);
};
