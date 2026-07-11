const { PermissionFlagsBits } = require('discord.js');
const { getQueue, pause } = require('../../utils/musicQueue');

module.exports = {
  name: 'pause',
  aliases: [],
  description: 'Met la musique en pause',
  usage: '+pause',
  category: 'music',
  run: async (client, message) => {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) return message.reply('<a:_:1483497365863399536> Vous devez être dans un salon vocal.');

    const me = message.guild.members.me;
    if (!me || !me.permissions.has(PermissionFlagsBits.Connect) || !me.permissions.has(PermissionFlagsBits.Speak)) {
      return message.reply('<a:_:1483497365863399536> Je n\'ai pas la permission de gérer le vocal ici.');
    }

    const queue = getQueue(message.guild.id);
    if (!queue.playing) return message.reply('<:_:1483497503713394719> Aucune musique en cours.');
    if (!queue.voiceChannel || queue.voiceChannel.id !== voiceChannel.id) {
      return message.reply('<a:_:1483497365863399536> Vous devez être dans le même vocal que moi.');
    }

    const ok = pause(queue);
    return message.reply(ok ? '⏸️ Lecture mise en pause.' : '<:_:1483497503713394719> Rien à mettre en pause.');
  }
};
