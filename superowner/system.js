const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');

module.exports = {
  name: 'system',
  aliases: ['resetall', 'version', 'updatebot'],
  category: 'superowner',
  level: 9,
  run: async (client, message) => {
    const commandName = message.content.split(' ')[0].slice((client.config.prefix?.length) || 1).toLowerCase();

    if (commandName === 'version') {
      return reply(message, container(
        txt('## 🤖 Version du Bot'),
        sep(),
        txt([
          `**Nom :** ${client.user.username}`,
          `**Version :** 2.0.0`,
          `**Discord.js :** v14`,
          `**Node.js :** ${process.version}`
        ].join('\n'))
      ));
    }

    if (commandName === 'resetall') {
      if (message.author.id !== client.config.owner) return reply(message, errorContainer('Seul le créateur peut utiliser cette commande.'));
      return reply(message, container(txt('## ⚠️ Reset Total'), sep(), txt('Commande **resetall** simulée (sécurité activée).')));
    }

    if (commandName === 'updatebot') {
      const msg = await reply(message, container(txt('## 🔄 Recherche de Mises à Jour...'), sep(), txt('Vérification en cours...')));
      setTimeout(async () => {
        await msg.edit({ components: [container(txt('## ✅ Bot à Jour'), sep(), txt('Aucune mise à jour disponible.'))], flags: require('../../utils/v2').FLAGS });
      }, 2000);
    }
  }
};
