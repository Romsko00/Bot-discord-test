const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const { v4: uuidv4 } = require('uuid');

const pokerTables = {};

module.exports = {
  name: 'poker',
  aliases: ['pokerpvp'],
  description: 'Poker PvP Texas Hold\'em (tables, buy-in, rake)',
  usage: '+poker create <buyin> | join <tableId> | start <tableId>',
  category: 'casino',
  run: async (client, message, args) => {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'create') return createTable(message, args);
    if (sub === 'join') return joinTable(message, args);
    if (sub === 'start') return startTable(message, args);
    return reply(message, errorContainer('Usage: `+poker create <buyin>` | `+poker join <tableId>` | `+poker start <tableId>`'));
  }
};

async function createTable(message, args) {
  const buyin = parseInt(args[1], 10);
  if (isNaN(buyin) || buyin < 100) return reply(message, errorContainer('Buy-in minimum: 100 JTN'));
  const userId = message.author.id;
  if (!Casino.hasEnoughCasino(userId, buyin)) return reply(message, errorContainer(`Fonds insuffisants. Solde: ${Casino.getCasinoBalance(userId)} JTN`));
  Casino.deductCasinoCredits(userId, buyin);
  const tableId = uuidv4().slice(0, 6);
  pokerTables[tableId] = { id: tableId, buyin, players: [{ id: userId, username: message.author.username, stack: buyin }], started: false, pot: buyin, owner: userId, rake: Math.floor(buyin * 0.05), stage: 'waiting' };
  return reply(message, container(txt('## 🃏 Table Poker Créée'), sep(), txt([`**ID :** \`${tableId}\` | **Buy-in :** ${buyin} JTN`, `Rejoindre: \`+poker join ${tableId}\` | Démarrer: \`+poker start ${tableId}\``].join('\n'))));
}

async function joinTable(message, args) {
  const tableId = args[1];
  if (!tableId || !pokerTables[tableId]) return reply(message, errorContainer('Table introuvable.'));
  const table = pokerTables[tableId];
  if (table.started) return reply(message, errorContainer('La partie a déjà commencé.'));
  const userId = message.author.id;
  if (table.players.find(p => p.id === userId)) return reply(message, errorContainer('Déjà à la table.'));
  if (!Casino.hasEnoughCasino(userId, table.buyin)) return reply(message, errorContainer(`Fonds insuffisants. Solde: ${Casino.getCasinoBalance(userId)} JTN`));
  Casino.deductCasinoCredits(userId, table.buyin);
  table.players.push({ id: userId, username: message.author.username, stack: table.buyin });
  table.pot += table.buyin;
  return reply(message, container(txt('## 🃏 Table Rejointe'), sep(), txt([`${message.author.username} rejoint la table **${tableId}** (${table.players.length} joueur(s))`, `**Pot :** ${table.pot} JTN`].join('\n'))));
}

async function startTable(message, args) {
  const tableId = args[1];
  if (!tableId || !pokerTables[tableId]) return reply(message, errorContainer('Table introuvable.'));
  const table = pokerTables[tableId];
  if (table.started) return reply(message, errorContainer('Déjà démarrée.'));
  if (table.owner !== message.author.id) return reply(message, errorContainer('Seul le créateur peut démarrer.'));
  if (table.players.length < 2) return reply(message, errorContainer('Minimum 2 joueurs.'));
  table.started = true;
  return reply(message, container(txt('## 🃏 Poker Texas Hold\'em'), sep(), txt([`**Table :** ${tableId} | **Pot :** ${table.pot} JTN`, `**Joueurs :** ${table.players.map(p => p.username).join(', ')}`].join('\n'))));
}
