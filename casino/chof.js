const { container, txt, sep, reply } = require('../../utils/v2');
const HallOfFame = require('../../utils/hallOfFame');

module.exports = {
  name: 'chof',
  aliases: ['hof', 'halloffame'],
  description: 'Hall of Fame casino (records, prestige ultime)',
  usage: '+chof',
  category: 'casino',
  run: async (client, message, args) => {
    const records = HallOfFame.getRecords();
    const lines = records.length
      ? records.map(r => `🏆 **${r.title}** — <@${r.userId}> : ${r.value}`)
      : ['Aucun record enregistré pour le moment.'];
    return reply(message, container(txt('## 🏆 Hall of Fame Casino'), sep(), txt(['*Records éternels, gagnants légendaires, prestige ultime.*', '', ...lines].join('\n'))));
  }
};
