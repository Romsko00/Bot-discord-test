const { container, txt, sep, reply, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'listvoice',
  description: 'Liste les membres en vocal',
  category: 'utilitaire',
  run: async (client, message) => {
    const voiceMembers = message.guild.members.cache.filter(m => m.voice.channel);
    const list = voiceMembers.map(m => `${m.user.tag} → ${m.voice.channel.name}`).join('\n').slice(0, 3900) || 'Personne en vocal.';
    await reply(message, container(txt(`## 🎤 Membres en Vocal (${voiceMembers.size})`), sep(), txt(list)));
  }
};
