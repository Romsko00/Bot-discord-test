const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const db = require('../../utils/simpledb');
const admin = require('../../utils/casinoAdmin');

module.exports = {
  name: 'copenloot',
  aliases: ['openloot', 'lootopen'],
  description: 'Ouvre une lootbox et reçois une récompense aléatoire',
  usage: '+copenloot',
  category: 'casino',
  run: async (client, message) => {
    if (!message.guild) return;
    const userId = message.author.id;
    const guildId = message.guild.id;
    if (admin.isSuspended(guildId, userId)) return reply(message, errorContainer('Accès casino suspendu.'));
    let tickets = db.get(`casino_loot_${userId}`) || 0;
    if (tickets <= 0) return reply(message, errorContainer('Tu n\'as pas de ticket. Achète-en dans la boutique: `+casino shop`.'));
    db.set(`casino_loot_${userId}`, tickets - 1);
    const pool = [
      { type: 'chips', amount: 500, w: 25 }, { type: 'chips', amount: 1000, w: 18 }, { type: 'chips', amount: 2500, w: 8 },
      { type: 'xp', amount: 150, w: 18 }, { type: 'xp', amount: 300, w: 10 }, { type: 'jackpot', amount: 0, w: 2 },
      { type: 'ticket', amount: 1, w: 8 }, { type: 'vip', amount: 1, w: 1 }
    ];
    const bag = [];
    pool.forEach(p => { for (let i = 0; i < p.w; i++) bag.push(p); });
    const reward = bag[Math.floor(Math.random() * bag.length)];
    let desc = '';
    if (reward.type === 'chips') { Casino.addCasinoCredits(userId, reward.amount); desc = `💰 +${reward.amount} jetons`; }
    else if (reward.type === 'xp') { const res = Casino.addXp(userId, reward.amount); desc = `⭐ +${reward.amount} XP${res.levelUp ? ` • Niveau ${res.level}` : ''}`; }
    else if (reward.type === 'jackpot') { const win = (Casino.tryWinGuildJackpot && Casino.tryWinGuildJackpot(guildId)) || (Casino.tryWinJackpot && Casino.tryWinJackpot()) || 0; if (win > 0) { Casino.addCasinoCredits(userId, win); desc = `💎 JACKPOT! +${win} jetons`; } else { Casino.addCasinoCredits(userId, 800); desc = '💎 Consolation: +800 jetons'; } }
    else if (reward.type === 'ticket') { db.add(`casino_loot_${userId}`, reward.amount); desc = `🎟️ +${reward.amount} ticket(s)`; }
    else if (reward.type === 'vip') { db.set(`casino_vip_${userId}`, Date.now() + 24*60*60*1000); desc = '💠 VIP 24h activé'; }
    try { admin.addAudit(guildId, { type: 'loot_open', userId, reward: reward.type }); } catch {}
    return reply(message, container(
      txt('## 🎟️ Lootbox Ouverte !'),
      sep(),
      txt([desc, `**Tickets restants :** ${db.get(`casino_loot_${userId}`) || 0}`].join('\n'))
    ));
  }
};
