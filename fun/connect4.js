const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'connect4',
  aliases: ['p4', 'puissance4'],
  description: 'Joue au Puissance 4 avec un ami.',
  category: 'fun',
  usage: 'connect4 <@user>',
  run: async (client, message, args) => {
    const opponent = message.mentions.users.first();
    if (!opponent) return reply(message, errorContainer('Mentionne un adversaire !'));
    if (opponent.bot || opponent.id === message.author.id) return reply(message, errorContainer('Adversaire invalide.'));

    const board = Array(6).fill().map(() => Array(7).fill(0));
    const players = [message.author.id, opponent.id];
    let turn = 0;
    const pieces = ['🔴', '🟡'];

    function renderBoard() {
      let str = '';
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 7; c++) {
          str += board[r][c] === 0 ? '⬛' : board[r][c] === 1 ? pieces[0] : pieces[1];
        }
        str += '\n';
      }
      str += '1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣';
      return str;
    }

    function checkWin(player) {
      for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) if (board[r][c]===player&&board[r][c+1]===player&&board[r][c+2]===player&&board[r][c+3]===player) return true;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) if (board[r][c]===player&&board[r+1][c]===player&&board[r+2][c]===player&&board[r+3][c]===player) return true;
      for (let r = 3; r < 6; r++) for (let c = 0; c < 4; c++) if (board[r][c]===player&&board[r-1][c+1]===player&&board[r-2][c+2]===player&&board[r-3][c+3]===player) return true;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) if (board[r][c]===player&&board[r+1][c+1]===player&&board[r+2][c+2]===player&&board[r+3][c+3]===player) return true;
      return false;
    }

    const buildRow1 = () => new ActionRowBuilder().addComponents(...[1,2,3,4].map(i => new ButtonBuilder().setCustomId(`c4_${i-1}`).setLabel(String(i)).setStyle(ButtonStyle.Secondary)));
    const buildRow2 = () => new ActionRowBuilder().addComponents(...[5,6,7].map(i => new ButtonBuilder().setCustomId(`c4_${i-1}`).setLabel(String(i)).setStyle(ButtonStyle.Secondary)));

    const buildContent = (t) => container(
      txt(`## 🔴🟡 Puissance 4`),
      sep(),
      txt(`${renderBoard()}\n\nTour de <@${players[t]}> (${pieces[t]})`),
    );

    const msg = await message.channel.send({ components: [buildContent(turn), buildRow1(), buildRow2()], flags: FLAGS });
    const collector = msg.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async i => {
      if (i.user.id !== players[turn]) return i.reply({ content: "Ce n'est pas ton tour !", ephemeral: true });
      const col = parseInt(i.customId.replace('c4_', ''));
      let rowPlaced = -1;
      for (let r = 5; r >= 0; r--) if (board[r][col] === 0) { board[r][col] = turn + 1; rowPlaced = r; break; }
      if (rowPlaced === -1) return i.reply({ content: 'Colonne pleine !', ephemeral: true });
      await i.deferUpdate();
      if (checkWin(turn + 1)) {
        await msg.edit({ components: [container(txt(`## 🏆 Puissance 4`), sep(), txt(`${renderBoard()}\n\n🏆 Victoire de <@${players[turn]}> (${pieces[turn]}) !`))], flags: FLAGS });
        return collector.stop();
      }
      if (board.every(r => r.every(c => c !== 0))) {
        await msg.edit({ components: [container(txt('## 🤝 Puissance 4 — Match nul'), sep(), txt(renderBoard()))], flags: FLAGS });
        return collector.stop();
      }
      turn = (turn + 1) % 2;
      await msg.edit({ components: [buildContent(turn), buildRow1(), buildRow2()], flags: FLAGS });
    });

    collector.on('end', () => msg.edit({ components: [container(txt('## Puissance 4 — Terminé'), sep(), txt(renderBoard()))], flags: FLAGS }).catch(() => {}));
  }
};
