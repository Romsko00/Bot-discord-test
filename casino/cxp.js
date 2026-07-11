const { container, txt, sep, reply } = require('../../utils/v2');
const Casino = require('../../utils/casino');

module.exports = {
  name: 'cxp',
  aliases: ['casino-xp', 'clevel'],
  description: 'Affiche l\'expérience et le niveau casino',
  usage: '+cxp [@user]',
  category: 'casino',
  run: async (client, message) => {
    const target = message.mentions.users.first() || message.author;
    const userId = target.id;
    const level = Casino.getLevel(userId);
    const xp = Casino.getXp(userId);
    const needed = Casino.xpNeededForLevel(level);
    const pct = Math.max(0, Math.min(10, Math.floor(xp / needed * 10)));
    const bar = `${'█'.repeat(pct)}${'░'.repeat(10 - pct)} ${(pct * 10)}%`;
    return reply(message, container(
      txt(`## 🎚️ Niveau Casino — ${target.username}`),
      sep(),
      txt([`**Niveau :** ${level}`, `**XP :** ${xp} / ${needed}`, `**Progression :** [${bar}]`, `**Jackpot :** ${Casino.getJackpot()} JTN`].join('\n'))
    ));
  }
};
