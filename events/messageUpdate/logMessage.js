const LogSystem = require('../../utils/logSystem');

module.exports = async (client, oldMessage, newMessage) => {
  // Ignorer les messages des bots
  if (newMessage.author.bot) return;
  
  // Ignorer si le contenu n'a pas vraiment changé
  if (oldMessage.content === newMessage.content) return;
  
  const logSystem = new LogSystem(client);
  
  const data = {
    author: newMessage.author,
    channel: newMessage.channel.toString(),
    oldContent: oldMessage.content,
    newContent: newMessage.content,
    timestamp: newMessage.createdTimestamp
  };
  
  await logSystem.logMessage(newMessage.guild, 'edit', data);
};
