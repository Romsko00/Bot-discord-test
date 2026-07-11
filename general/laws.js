const { container, txt, sep, reply } = require('../../utils/v2');

module.exports = {
  name: 'laws',
  aliases: ['rules', 'regles', 'lois'],
  description: 'Affiche les règles du serveur',
  usage: '',
  level: 0,
  run: async (client, message) => {
    const guildRules = client.config?.RULES || [
      '1. Respectez tous les membres.',
      '2. Pas de spam, flood ou publicité.',
      '3. Contenu approprié uniquement.',
      '4. Suivez les directives de Discord.',
      '5. Écoutez les modérateurs.'
    ];
    const rulesText = Array.isArray(guildRules) ? guildRules.join('\n') : String(guildRules);
    return reply(message, container(
      txt(`## 📜 Règles — ${message.guild.name}`),
      sep(),
      txt(rulesText)
    ));
  }
};
