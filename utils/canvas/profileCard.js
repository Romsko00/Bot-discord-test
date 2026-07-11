const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

// Register custom fonts if needed
// registerFont(path.join(__dirname, 'fonts', 'YourFont.ttf'), { family: 'YourFont' });

async function drawProfileCard({
  avatarURL,
  username,
  userId,
  level,
  xp,
  xpNeeded,
  prestige,
  vip,
  balance,
  streak,
  title,
  background,
  badges = [],
  effects = [],
  frame,
  equipped = {},
}) {
  const width = 700;
  const height = 320;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  if (background) {
    try {
      const bgImg = await loadImage(background);
      ctx.drawImage(bgImg, 0, 0, width, height);
    } catch {
      ctx.fillStyle = '#23272A';
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    ctx.fillStyle = '#23272A';
    ctx.fillRect(0, 0, width, height);
  }

  // Avatar (cercle, glow)
  try {
    const avatar = await loadImage(avatarURL);
    ctx.save();
    ctx.beginPath();
    ctx.arc(90, 90, 70, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = vip ? 30 : 10;
    ctx.clip();
    ctx.drawImage(avatar, 20, 20, 140, 140);
    ctx.restore();
  } catch {}

  // Frame
  if (frame) {
    try {
      const frameImg = await loadImage(frame);
      ctx.drawImage(frameImg, 10, 10, 160, 160);
    } catch {}
  }

  // Username & ID
  ctx.font = 'bold 32px Arial';
  ctx.fillStyle = '#fff';
  ctx.fillText(username, 180, 60);
  ctx.font = '18px Arial';
  ctx.fillStyle = '#aaa';
  ctx.fillText(`#${userId}`, 180, 90);

  // Level, XP bar
  ctx.font = 'bold 22px Arial';
  ctx.fillStyle = '#FFD700';
  ctx.fillText(`Niveau ${level}`, 180, 130);
  ctx.fillStyle = '#fff';
  ctx.fillRect(180, 145, 300, 18);
  ctx.fillStyle = '#43b581';
  ctx.fillRect(180, 145, Math.floor(300 * (xp / xpNeeded)), 18);
  ctx.font = '16px Arial';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${xp} / ${xpNeeded} XP`, 180, 162);

  // Prestige
  if (prestige) {
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#e67e22';
    ctx.fillText(`Prestige: ${prestige}`, 180, 195);
  }

  // VIP badge
  if (vip) {
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#00e6ff';
    ctx.fillText('VIP', 320, 195);
  }

  // Solde
  ctx.font = 'bold 22px Arial';
  ctx.fillStyle = '#fff';
  ctx.fillText(`💰 ${balance} JTN`, 180, 230);

  // Streak
  ctx.font = '18px Arial';
  ctx.fillStyle = '#ffb300';
  ctx.fillText(`🔥 Streak: ${streak}j`, 180, 260);

  // Title
  if (title) {
    ctx.font = 'italic 18px Arial';
    ctx.fillStyle = '#b388ff';
    ctx.fillText(`« ${title} »`, 180, 290);
  }

  // Badges
  let bx = 520;
  for (const badge of badges) {
    try {
      const badgeImg = await loadImage(badge);
      ctx.drawImage(badgeImg, bx, 30, 48, 48);
      bx += 54;
    } catch {}
  }

  // Effects (glow, particules, etc.)
  // ... (à compléter selon effets disponibles)

  return canvas.toBuffer();
}

module.exports = { drawProfileCard };