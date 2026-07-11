const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const db = require('../../utils/simpledb');

const TYPE_LABELS = { balance: 'Solde (JTN)', xp: 'Expérience', level: 'Niveau', games: 'Parties Jouées', wins: 'Victoires', streak: 'Série' };
const formatValue = (type, value) => {
  if (type === 'balance') return `${value.toLocaleString()} JTN`;
  if (type === 'xp') return `${value.toLocaleString()} XP`;
  if (type === 'level') return `Niveau ${value}`;
  if (type === 'games') return `${value.toLocaleString()} partie${value > 1 ? 's' : ''}`;
  if (type === 'wins') return `${value.toLocaleString()} victoire${value > 1 ? 's' : ''}`;
  if (type === 'streak') return `${value} jour${value > 1 ? 's' : ''}`;
  return String(value);
};

async function getLeaderboard(type) {
  const all = db.all();
  const players = [];
  if (type === 'balance') { for (const row of all) { if (row.ID.startsWith('casino_credits_')) { const val = Number(row.data) || 0; if (val > 0) players.push({ userId: row.ID.replace('casino_credits_', ''), value: val }); } } }
  else if (type === 'xp') { for (const row of all) { if (row.ID.startsWith('casino_xp_')) { const val = Number(row.data) || 0; if (val > 0) players.push({ userId: row.ID.replace('casino_xp_', ''), value: val }); } } }
  else if (type === 'level') { for (const row of all) { if (row.ID.startsWith('casino_level_')) { const val = Number(row.data) || 1; if (val > 1) players.push({ userId: row.ID.replace('casino_level_', ''), value: val }); } } }
  else if (type === 'games') { for (const row of all) { if (row.ID.startsWith('casino_stats_')) { const total = Object.values(row.data || {}).reduce((s, v) => s + (v || 0), 0); if (total > 0) players.push({ userId: row.ID.replace('casino_stats_', ''), value: total }); } } }
  else if (type === 'wins') { const seen = new Set(); for (const row of all) { if (row.ID.startsWith('casino_history_')) { const m = row.ID.match(/casino_history_(\d+)_.+/); if (m && !seen.has(m[1])) { seen.add(m[1]); let wins = 0; for (const hr of all) { if (hr.ID.startsWith(`casino_history_${m[1]}_`)) wins += (hr.data || []).filter(h => h.win).length; } if (wins > 0) players.push({ userId: m[1], value: wins }); } } } }
  else if (type === 'streak') { for (const row of all) { if (row.ID.startsWith('casino_streak_')) { const val = Number(row.data) || 0; if (val > 0) players.push({ userId: row.ID.replace('casino_streak_', ''), value: val }); } } }
  players.sort((a, b) => b.value - a.value);
  return players;
}

module.exports = {
  name: 'ctop',
  aliases: ['cleaderboard', 'clb', 'casino-top'],
  description: 'Affiche le classement des joueurs du casino',
  usage: '+ctop [balance|xp|level|games|wins|streak]',
  category: 'casino',
  run: async (client, message, args) => {
    const type = (args[0] || 'balance').toLowerCase();
    if (!Object.keys(TYPE_LABELS).includes(type)) return reply(message, errorContainer(`Type invalide. Utilise: ${Object.keys(TYPE_LABELS).join(', ')}`));
    let page = 0;
    const perPage = 10;
    const renderPage = async (p) => {
      const lb = await getLeaderboard(type);
      const totalPages = Math.max(1, Math.ceil(lb.length / perPage));
      p = Math.max(0, Math.min(p, totalPages - 1));
      const pageData = lb.slice(p * perPage, (p + 1) * perPage);
      const userPos = lb.findIndex(x => x.userId === message.author.id) + 1;
      const medals = ['🥇', '🥈', '🥉'];
      const lines = await Promise.all(pageData.map(async (player, idx) => {
        const rank = p * perPage + idx + 1;
        const medal = medals[rank - 1] || `${rank}.`;
        const user = await client.users.fetch(player.userId).catch(() => null);
        const name = user ? user.tag : `Utilisateur ${player.userId}`;
        return `${medal} **${name}** — ${formatValue(type, player.value)}`;
      }));
      return { lines, totalPages, p, userPos };
    };
    const { lines, totalPages, p: cp, userPos } = await renderPage(page);
    page = cp;
    const buildContainer = (lines, page, totalPages, userPos) => container(
      txt(`## 🏆 Leaderboard Casino — ${TYPE_LABELS[type]}`),
      sep(),
      txt([userPos > 0 ? `*Votre position : #${userPos}*` : '', lines.join('\n') || 'Aucun joueur', `\nPage ${page + 1}/${totalPages}`].filter(Boolean).join('\n'))
    );
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('prev').setLabel('◀ Précédent').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('next').setLabel('Suivant ▶').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('refresh').setLabel('🔄 Actualiser').setStyle(ButtonStyle.Primary)
    );
    const msg = await message.channel.send({ components: [buildContainer(lines, page, totalPages, userPos), ...(totalPages > 1 ? [row] : [])], flags: FLAGS });
    if (totalPages <= 1) return;
    const collector = msg.createMessageComponentCollector({ time: 120000, filter: i => i.user.id === message.author.id });
    collector.on('collect', async i => {
      if (i.customId === 'prev') page = Math.max(0, page - 1);
      else if (i.customId === 'next') page = Math.min(totalPages - 1, page + 1);
      const { lines: newLines, totalPages: tp, p: np, userPos: up } = await renderPage(page);
      page = np;
      await i.update({ components: [buildContainer(newLines, page, tp, up), row], flags: FLAGS });
    });
    collector.on('end', () => msg.edit({ components: [buildContainer(lines, page, totalPages, userPos)] }).catch(() => {}));
  }
};
