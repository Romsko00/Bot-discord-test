const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

function getWeekKey(date = new Date()) {
  const onejan = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date - onejan) / 86400000) + 1;
  return `${date.getFullYear()}_w${Math.ceil(dayOfYear / 7)}`;
}

module.exports = {
  name: 'ctournament',
  aliases: ['ctour', 'ct'],
  description: 'Tournoi hebdo — rejoins et consulte le classement',
  usage: '+ctournament join | +ctournament status',
  category: 'casino',
  run: async (client, message, args) => {
    if (!message.guild) return;
    const guildId = message.guild.id, userId = message.author.id;
    const sub = (args[0] || '').toLowerCase();
    if (!['join', 'status'].includes(sub)) return reply(message, errorContainer('Usage: `+ctournament join` | `+ctournament status`'));
    const weekKey = getWeekKey();
    const baseKey = `casino_tour_${guildId}_${weekKey}`;
    if (sub === 'join') {
      const players = db.get(baseKey + '_players') || {};
      players[userId] = players[userId] || { best: 0 };
      db.set(baseKey + '_players', players);
      return reply(message, container(txt('## 🏆 Tournoi Hebdo'), sep(), txt(`✅ Inscription validée pour la semaine **${weekKey}** !`)));
    }
    if (sub === 'status') {
      const players = db.get(baseKey + '_players') || {};
      const arr = Object.entries(players).map(([uid, o]) => ({ uid, best: o.best || 0 })).sort((a, b) => b.best - a.best);
      const lines = arr.slice(0, 10).map((p, i) => `**#${i + 1}** <@${p.uid}> — meilleur gain: ${p.best} JTN`);
      return reply(message, container(txt('## 🏆 Tournoi Hebdo — Plus Gros Gain'), sep(), txt([`**Semaine :** ${weekKey}`, '', lines.join('\n') || 'Aucun participant'].join('\n'))));
    }
  }
};
