const { container, txt, sep, reply, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'listonline',
  description: 'Liste les membres en ligne',
  category: 'utilitaire',
  run: async (client, message) => {
    const online = message.guild.members.cache.filter(m => m.presence?.status === 'online' || m.presence?.status === 'dnd' || m.presence?.status === 'idle');
    const desc = online.map(m => m.user.tag).join(', ').slice(0, 3900) || 'Personne en ligne.';
    await reply(message, container(txt(`## 🟢 Membres En Ligne (${online.size})`), sep(), txt(desc)));
  }
};
