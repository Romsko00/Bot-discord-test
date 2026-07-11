const { createCanvas, loadImage } = require('canvas');

async function drawSlots({ reels, winLines = [], jackpot = false, theme = 'classic' }) {
  const width = 420;
  const height = 180;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#181818';
  ctx.fillRect(0, 0, width, height);

  // Draw reels
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(70 + i * 140, 40 + j * 50, 32, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      // Emoji or icon
      ctx.font = '38px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = winLines.some(line => line.includes(`${i},${j}`)) ? '#FFD700' : '#fff';
      ctx.fillText(reels[i][j], 70 + i * 140, 40 + j * 50);
      ctx.restore();
    }
  }

  // Jackpot animation
  if (jackpot) {
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#ff1744';
    ctx.fillText('JACKPOT!', width / 2, height - 20);
  }

  return canvas.toBuffer();
}

module.exports = { drawSlots };