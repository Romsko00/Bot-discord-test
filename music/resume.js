const { PermissionFlagsBits } = require('discord.js');
const { getQueue, resume } = require('../../utils/musicQueue');

module.exports = {
  name: 'resume',
  aliases: ['continue'],
  description: 'Reprend la musique en pause',
  usage: '+resume',
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

    const ok = resume(queue);
    return message.reply(ok ? '<:_:1483497470754426942> Lecture reprise.' : '<:_:1483497503713394719> Rien à reprendre.');
  }
};
