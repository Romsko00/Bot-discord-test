const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'allbot',
  level: 2,
  description: 'Affiche la liste de tous les bots présents sur le serveur.',
  run: async (client, message) => {
    await message.guild.members.fetch();
    const bots = message.guild.members.cache.filter(m => m.user.bot);
    if (bots.size === 0) return reply(message, errorContainer('Aucun bot trouvé sur ce serveur.'));
    let description = '';
    let count = 1;
    for (const [, bot] of bots) { description += `${count}. ${bot.user} (\`${bot.user.id}\`)\n`; count++; }
    await reply(message, container(txt(`## 🤖 Bots sur ${message.guild.name}`), sep(), txt(description.slice(0, 3900)), sep(), txt(`**Total :** ${bots.size} bot(s)`)));
  }
};
