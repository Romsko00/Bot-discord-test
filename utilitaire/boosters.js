const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'boosters',
  aliases: ['nitro', 'boost'],
  description: 'Gestion des boosters du serveur',
  level: 2,
  run: async (client, message) => {
    try {
      const boosters = message.guild.members.cache.filter(m => m.premiumSince);
      if (boosters.size === 0)
        return reply(message, container(txt('## 💎 Boosters du Serveur'), sep(), txt('Aucun booster pour le moment... 😢\nSoyez le premier à booster le serveur!'), sep(), txt('*Merci à tous les futurs boosters 💖*')));

      const lines = [];
      for (const [, booster] of boosters) {
        const boostDate = booster.premiumSince ? `<t:${Math.floor(booster.premiumSince.getTime() / 1000)}:R>` : 'Inconnu';
        lines.push(`💖 **${booster.user.tag}** — boostant depuis ${boostDate}`);
      }
      await reply(message, container(
        txt(`## 💎 Boosters du Serveur — ${boosters.size} membre(s)`),
        sep(),
        txt(lines.join('\n').slice(0, 3900)),
        sep(),
        txt(`Niveau ${message.guild.premiumTier} • ${message.guild.premiumSubscriptionCount} boost(s)`)
      ));
    } catch (e) {
      console.error('Boosters error:', e);
      await reply(message, errorContainer('Erreur lors de la recherche des boosters.'));
    }
  }
};
