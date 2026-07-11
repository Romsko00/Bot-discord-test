const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'membercount',
  aliases: ['members', 'mc'],
  description: 'Affiche le nombre de membres',
  usage: '',
  level: 0,
  run: async (client, message) => {
    try {
      await message.guild.members.fetch();

      const members = message.guild.members.cache;
      const total   = members.size;
      const humans  = members.filter(m => !m.user.bot).size;
      const bots    = members.filter(m => m.user.bot).size;
      const online  = members.filter(m => m.presence?.status === 'online').size;

      const lines = [
        `## 👥 Membres de ${message.guild.name}`,
        '',
        `• **Total :** ${total}`,
        `• **Humains :** ${humans}`,
        `• **Bots :** ${bots}`,
        `• **En Ligne :** 🟢 ${online}`,
        `• **Hors Ligne :** ⚫ ${total - online}`
      ];

      await message.reply({
        components: [container(txt(lines.join('\n')))],
        flags: FLAGS
      });

    } catch (error) {
      await message.reply({
        components: [container(txt('## ❌ Erreur\n\nImpossible de compter les membres.'))],
        flags: FLAGS
      });
    }
  }
};
