const LogSystem = require('../../utils/logSystem');

module.exports = async (client, message) => {
  // Ignorer les messages des bots
  if (message.author.bot) return;
  
  const logSystem = new LogSystem(client);
  
  const data = {
    author: message.author,
    channel: message.channel.toString(),
    content: message.content,
    timestamp: message.createdTimestamp
  };
  
  await logSystem.logMessage(message.guild, 'delete', data);
};
