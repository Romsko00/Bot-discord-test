const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

const EMPTY = ' ', X = 'X', O = 'O';
function prettyCell(v) { if (v === X) return '❌'; if (v === O) return '⭕'; return '➖'; }
function renderBoard(board) { return [0,3,6].map(i => `${prettyCell(board[i])}${prettyCell(board[i+1])}${prettyCell(board[i+2])}`).join('\n'); }
function getWinner(board) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of lines) if (board[a] !== EMPTY && board[a] === board[b] && board[b] === board[c]) return board[a];
  return board.includes(EMPTY) ? null : 'draw';
}
function makeButtons(board, disableAll = false) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 3; c++) {
      const i = r*3+c, v = board[i], isEmpty = v === EMPTY;
      row.addComponents(new ButtonBuilder().setCustomId(`m_${i}`).setEmoji(prettyCell(v)).setStyle(isEmpty ? ButtonStyle.Secondary : ButtonStyle.Primary).setDisabled(disableAll || !isEmpty));
    }
    rows.push(row);
  }
  return rows;
}

module.exports = {
  name: 'morpion',
  aliases: ['tictactoe'],
  description: 'Joue au morpion',
  run: async (client, message) => {
    const opponent = message.mentions.users.first();
    if (!opponent) return reply(message, errorContainer('Tu dois mentionner un utilisateur.'));
    if (opponent.bot) return reply(message, errorContainer('Choisis un utilisateur non-bot.'));
    if (opponent.id === message.author.id) return reply(message, errorContainer('Tu as besoin d\'un adversaire.'));

    const board = Array(9).fill(EMPTY);
    const players = [message.author.id, opponent.id];
    const symbols = { [players[0]]: X, [players[1]]: O };
    let turn = players[0];

    const buildContent = () => container(
      txt('#️⃣ Morpion'),
      sep(),
      txt(`${renderBoard(board)}\n\nAu tour de <@${turn}> (${symbols[turn] === X ? '❌' : '⭕'})`)
    );

    const msg = await message.channel.send({ components: [buildContent(), ...makeButtons(board)], flags: FLAGS });
    const filter = i => i.message.id === msg.id && players.includes(i.user.id);
    const collector = msg.createMessageComponentCollector({ filter, time: 60_000 });

    collector.on('collect', async i => {
      if (i.user.id !== turn) return i.reply({ content: "Ce n'est pas ton tour !", ephemeral: true });
      const index = parseInt(i.customId.split('_')[1], 10);
      if (isNaN(index) || board[index] !== EMPTY) return i.reply({ content: 'Case invalide.', ephemeral: true });
      board[index] = symbols[turn];
      turn = turn === players[0] ? players[1] : players[0];
      const w = getWinner(board);
      if (w) {
        collector.stop('end');
        const result = w === 'draw' ? 'Match nul !' : `Victoire de ${w === X ? `<@${players[0]}>` : `<@${players[1]}>`} !`;
        return i.update({ components: [container(txt('#️⃣ Morpion — Fin'), sep(), txt(`${renderBoard(board)}\n\n${result}`)), ...makeButtons(board, true)], flags: FLAGS });
      }
      await i.update({ components: [buildContent(), ...makeButtons(board)], flags: FLAGS });
    });

    collector.on('end', async (_, reason) => {
      if (reason !== 'end') await msg.edit({ components: [container(txt('#️⃣ Morpion — Expiré'), sep(), txt(`${renderBoard(board)}\n\nTemps écoulé.`)), ...makeButtons(board, true)], flags: FLAGS }).catch(() => {});
      else await msg.edit({ components: makeButtons(board, true) }).catch(() => {});
    });
  }
};
