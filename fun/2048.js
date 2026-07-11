const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
  name: '2048',
  description: 'Joue au jeu 2048.',
  category: 'fun',
  run: async (client, message, args) => {
    let grid = Array(4).fill().map(() => Array(4).fill(0));
    let score = 0;

    function addRandomTile() {
      let empty = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (grid[r][c] === 0) empty.push({ r, c });
      if (empty.length > 0) { let { r, c } = empty[Math.floor(Math.random() * empty.length)]; grid[r][c] = Math.random() < 0.9 ? 2 : 4; }
    }

    addRandomTile(); addRandomTile();

    const numMap = { 0:'⬛',2:'2️⃣',4:'4️⃣',8:'8️⃣',16:'🔆',32:'🔴',64:'🟠',128:'🟡',256:'🟢',512:'🔵',1024:'🟣',2048:'🏆' };
    function renderGrid() {
      let str = '';
      for (let r = 0; r < 4; r++) { for (let c = 0; c < 4; c++) str += (numMap[grid[r][c]] || `[${grid[r][c]}]`) + ' '; str += '\n'; }
      return str;
    }

    function slide(row) { let arr = row.filter(v => v), zeros = Array(4 - arr.length).fill(0); return arr.concat(zeros); }
    function combine(row) { for (let i = 0; i < 3; i++) if (row[i] !== 0 && row[i] === row[i+1]) { row[i] *= 2; row[i+1] = 0; score += row[i]; } return row; }
    function moveLeft() { for (let i = 0; i < 4; i++) grid[i] = slide(combine(slide(grid[i]))); }
    function moveRight() { for (let i = 0; i < 4; i++) grid[i] = slide(combine(slide(grid[i].reverse()))).reverse(); }
    function moveUp() { for (let i = 0; i < 4; i++) { let col = [grid[0][i],grid[1][i],grid[2][i],grid[3][i]]; let s = slide(combine(slide(col))); for (let j = 0; j < 4; j++) grid[j][i] = s[j]; } }
    function moveDown() { for (let i = 0; i < 4; i++) { let col = [grid[0][i],grid[1][i],grid[2][i],grid[3][i]]; let s = slide(combine(slide(col.reverse()))).reverse(); for (let j = 0; j < 4; j++) grid[j][i] = s[j]; } }

    const buildGrid = () => container(txt(`## 🎮 2048 — Score: ${score}`), sep(), txt(renderGrid()));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('2048_left').setLabel('◀').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('2048_up').setLabel('▲').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('2048_down').setLabel('▼').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('2048_right').setLabel('▶').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('2048_stop').setLabel('Stop').setStyle(ButtonStyle.Danger)
    );

    const msg = await message.channel.send({ components: [buildGrid(), row], flags: FLAGS });

    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 600000 });
    collector.on('collect', async i => {
      await i.deferUpdate();
      if (i.customId === '2048_stop') return collector.stop();
      const old = JSON.stringify(grid);
      if (i.customId === '2048_left') moveLeft();
      else if (i.customId === '2048_right') moveRight();
      else if (i.customId === '2048_up') moveUp();
      else if (i.customId === '2048_down') moveDown();
      if (JSON.stringify(grid) !== old) addRandomTile();
      if (grid.flat().includes(2048)) {
        await msg.edit({ components: [container(txt('## 🏆 2048 — Victoire !'), sep(), txt(`**Score final :** ${score}\n\n${renderGrid()}`))], flags: FLAGS });
        return collector.stop();
      }
      await msg.edit({ components: [buildGrid(), row], flags: FLAGS }).catch(() => {});
    });
    collector.on('end', () => msg.edit({ components: [buildGrid()] }).catch(() => {}));
  }
};
