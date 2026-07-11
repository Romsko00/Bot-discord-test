const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'snake',
  description: 'Joue au jeu Snake.',
  category: 'fun',
  run: async (client, message, args) => {
    const width = 10, height = 10;
    let snake = [{ x: 5, y: 5 }], food = { x: 2, y: 2 }, direction = { x: 0, y: 0 }, score = 0, gameOver = false;

    function spawnFood() {
      while (true) {
        let x = Math.floor(Math.random() * width), y = Math.floor(Math.random() * height);
        if (!snake.some(s => s.x === x && s.y === y)) { food = { x, y }; break; }
      }
    }

    function renderBoard() {
      let str = '';
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (snake[0].x === x && snake[0].y === y) str += '🟢';
          else if (snake.some(s => s.x === x && s.y === y)) str += '🟩';
          else if (food.x === x && food.y === y) str += '🍎';
          else str += '⬛';
        }
        str += '\n';
      }
      return str;
    }

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sn_left').setLabel('◀').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('sn_up').setLabel('▲').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('sn_right').setLabel('▶').setStyle(ButtonStyle.Primary)
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sn_down').setLabel('▼').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('sn_stop').setLabel('Stop').setStyle(ButtonStyle.Danger)
    );

    const buildContent = () => container(txt(`## 🐍 Snake — Score: ${score}`), sep(), txt(renderBoard()));
    const msg = await message.channel.send({ components: [buildContent(), row1, row2], flags: FLAGS });

    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300000 });
    let interval = setInterval(async () => {
      if (direction.x === 0 && direction.y === 0 || gameOver) return;
      const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
      if (head.x < 0 || head.x >= width || head.y < 0 || head.y >= height || snake.some(s => s.x === head.x && s.y === head.y)) {
        gameOver = true; clearInterval(interval);
        await msg.edit({ components: [container(txt(`## 💀 Snake — Game Over`), sep(), txt(`**Score final :** ${score}`))], flags: FLAGS }).catch(() => {});
        return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) { score++; spawnFood(); } else snake.pop();
      await msg.edit({ components: [buildContent(), row1, row2], flags: FLAGS }).catch(() => {});
    }, 2000);

    collector.on('collect', async i => {
      await i.deferUpdate();
      if (i.customId === 'sn_stop') { gameOver = true; clearInterval(interval); await msg.edit({ components: [container(txt(`## 🛑 Snake — Arrêté`), sep(), txt(`**Score :** ${score}`))], flags: FLAGS }).catch(() => {}); return; }
      if (i.customId === 'sn_up' && direction.y !== 1) direction = { x: 0, y: -1 };
      if (i.customId === 'sn_down' && direction.y !== -1) direction = { x: 0, y: 1 };
      if (i.customId === 'sn_left' && direction.x !== 1) direction = { x: -1, y: 0 };
      if (i.customId === 'sn_right' && direction.x !== -1) direction = { x: 1, y: 0 };
    });

    collector.on('end', () => { clearInterval(interval); if (!gameOver) msg.edit({ components: [buildContent()] }).catch(() => {}); });
  }
};
