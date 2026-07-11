const LogSystem = require('../../utils/logSystem');

module.exports = async (client, oldState, newState) => {
  const logSystem = new LogSystem(client);
  const member = newState.member;
  
  // Ignorer les bots
  if (member.user.bot) return;
  
  // Déterminer le type d'événement vocal
  const oldChannel = oldState.channel;
  const newChannel = newState.channel;
  
  // Join/Leave de salon vocal
  if (!oldChannel && newChannel) {
    await logSystem.logVoice(newState.guild, 'join', member, newChannel);
  } else if (oldChannel && !newChannel) {
    await logSystem.logVoice(newState.guild, 'leave', member, oldChannel);
  } else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
    // Changement de salon vocal
    await logSystem.logVoice(newState.guild, 'leave', member, oldChannel);
    await logSystem.logVoice(newState.guild, 'join', member, newChannel);
  }
  
  // Mute/Unmute vocal
  if (oldState.serverMute !== newState.serverMute) {
    await logSystem.logVoice(newState.guild, 'mute', member, newChannel, { mute: newState.serverMute });
  }
  
  // Mute/Unmute casque
  if (oldState.serverDeaf !== newState.serverDeaf) {
    await logSystem.logVoice(newState.guild, 'deaf', member, newChannel, { deaf: newState.serverDeaf });
  }
};
