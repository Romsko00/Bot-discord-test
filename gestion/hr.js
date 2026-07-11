const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'hr',
  aliases: ['hierarchy', 'roles'],
  description: 'Affiche la hiérarchie des rôles sur le serveur.',
  category: 'gestion',
  run: async (client, message) => {
    try {
      const roles = message.guild.roles.cache.sort((a, b) => b.position - a.position).map(role => `• **${role.name}** — ${role.members.size} membre(s)`).join('\n');
      return reply(message, container(txt(`## 🏅 Hiérarchie des Rôles — ${message.guild.name}`), sep(), txt(roles || 'Aucun rôle trouvé.')));
    } catch (e) { console.error('Erreur hr:', e); return reply(message, errorContainer('Une erreur est survenue lors de la récupération de la hiérarchie.')); }
  }
};
