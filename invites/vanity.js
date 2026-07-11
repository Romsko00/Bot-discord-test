const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');

module.exports = {
  name: 'vanity',
  description: 'Affiche l\'URL personnalisée (Vanity) du serveur',
  category: 'invites',
  level: 0,
  run: async (client, message) => {
    const vanityCode = message.guild.vanityURLCode;
    const uses = message.guild.vanityURLUses;
    if (!vanityCode) return reply(message, errorContainer('Ce serveur n\'a pas d\'URL personnalisée (Vanity).'));
    return reply(message, container(
      txt('## 🔗 Lien Personnalisé'),
      sep(),
      txt([
        `**URL :** \`discord.gg/${vanityCode}\``,
        `**Utilisations :** ${uses || 0}`
      ].join('\n'))
    ));
  }
};
