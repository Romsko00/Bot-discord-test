const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { connectMissingTokensFromConfig } = require('../../utils/connectNewTokens');

module.exports = {
  name: 'reloadbuyers',
  aliases: ['reloadbots', 'loadbuyers', 'loadbots'],
  description: 'Charge dynamiquement les bots manquants depuis config.json',
  category: 'admin',
  level: 9,
  run: async (client, message) => {
    if (!client.config.superadmin || !client.config.superadmin.includes(message.author.id)) {
      return reply(message, errorContainer('**Permission insuffisante** — Superadmin requis.'));
    }

    const allClients = globalThis.allClients && Array.isArray(globalThis.allClients) ? globalThis.allClients : [client];
    const botsBefore = allClients.filter(c => c.user).length;

    const progressMsg = await reply(message, container(
      txt('## 🔄 Rechargement des Buyers'),
      sep(),
      txt('Chargement des tokens manquants depuis `config.json`...')
    ));

    const result = await connectMissingTokensFromConfig();

    const botsAfter = allClients.filter(c => c.user).length;
    const newTokens = result.connected || 0;
    const invalidRemoved = result.failed || 0;

    await progressMsg.edit({
      components: [container(
        txt('## 🔄 Rechargement des Buyers'),
        sep(),
        txt([
          `**Avant :** ${botsBefore} bot${botsBefore > 1 ? 's' : ''} actif${botsBefore > 1 ? 's' : ''}`,
          `**Après :** ${botsAfter} bot${botsAfter > 1 ? 's' : ''} actif${botsAfter > 1 ? 's' : ''}`,
          `**Nouveaux tokens chargés :** ${newTokens}`,
          `**Tokens invalides supprimés :** ${invalidRemoved}`
        ].join('\n'))
      )],
      flags: require('../../utils/v2').FLAGS
    });
  }
};
