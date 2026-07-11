const { container, txt, sep, reply } = require('../../utils/v2');

module.exports = {
  name: 'minesweeper',
  aliases: ['demineur'],
  description: 'Génère une grille de démineur.',
  category: 'fun',
  run: async (client, message, args) => {
    const rows = 8, cols = 8, mines = 10;
    let grid = Array(rows).fill().map(() => Array(cols).fill(0));
    let placed = 0;
    while (placed < mines) {
      let r = Math.floor(Math.random() * rows), c = Math.floor(Math.random() * cols);
      if (grid[r][c] !== '💣') { grid[r][c] = '💣'; placed++; }
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (grid[r][c] === '💣') continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        let nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === '💣') count++;
      }
      grid[r][c] = count;
    }
    const numMap = { 0:'0️⃣',1:'1️⃣',2:'2️⃣',3:'3️⃣',4:'4️⃣',5:'5️⃣',6:'6️⃣',7:'7️⃣',8:'8️⃣','💣':'💣' };
    let content = '';
    for (let r = 0; r < rows; r++) { for (let c = 0; c < cols; c++) content += `||${numMap[grid[r][c]]}||`; content += '\n'; }
    return reply(message, container(txt(`## 💣 Démineur (${mines} bombes)`), sep(), txt(content)));
  }
};
