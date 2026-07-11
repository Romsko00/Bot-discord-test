const { PermissionFlagsBits } = require('discord.js');
const { getQueue, stop } = require('../../utils/musicQueue');

module.exports = {
  name: 'stop',
  aliases: ['leave', 'disconnect'],
  description: 'Vide la file et déconnecte le bot du vocal',
  usage: '+stop',
  category: 'music',
  run: async (client, message) => {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) return message.reply('<a:_:1483497365863399536> Vous devez être dans un salon vocal.');

    const me = message.guild.members.me;
    if (!me || !me.permissions.has(PermissionFlagsBits.Connect) || !me.permissions.has(PermissionFlagsBits.Speak)) {
      return message.reply('<a:_:1483497365863399536> Je n\'ai pas la permission de gérer le vocal ici.');
    }

    const queue = getQueue(message.guild.id);
    if (!queue.voiceChannel || queue.voiceChannel.id !== voiceChannel.id) {
      return message.reply('<a:_:1483497365863399536> Vous devez être dans le même vocal que moi.');
    }

    stop(queue);
    return message.reply('⏹️ Lecture arrêtée, file vidée et déconnexion du vocal.');
  }
};
