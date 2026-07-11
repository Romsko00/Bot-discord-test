const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const admin = require('../../utils/casinoAdmin');
const notify = require('../../utils/casinoNotify');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'prestige',
  aliases: ['casino-prestige', 'cprestige'],
  description: 'Prestige — réinitialise ta progression contre des bonus permanents',
  usage: '+prestige',
  category: 'casino',
  run: async (client, message) => {
    if (!message.guild) return;
    const userId = message.author.id, guildId = message.guild.id;
    if (admin.isSuspended(guildId, userId)) return reply(message, errorContainer('Accès casino suspendu.'));
    const lvl = Casino.getLevel(userId);
    const bal = Casino.getCasinoBalance(userId);
    if (lvl < 10 && bal < 10000) return reply(message, errorContainer('Conditions non atteintes. Il faut au moins niveau 10 ou 10,000 jetons.'));
    db.set(`casino_credits_${userId}`, 0);
    db.set(`casino_xp_${userId}`, 0);
    db.set(`casino_level_${userId}`, 1);
    const prev = db.get(`casino_prestige_${userId}`) || 0;
    const now = prev + 1;
    db.set(`casino_prestige_${userId}`, now);
    const prevMult = db.get(`casino_xp_mult_${userId}`) || 1.0;
    const newMult = Number((prevMult + 0.05).toFixed(2));
    db.set(`casino_xp_mult_${userId}`, newMult);
    try { admin.addAudit(guildId, { type: 'prestige', userId, count: now }); } catch {}
    try { const nEmb = notify.buildEmbed('💫 Prestige', `${message.author} a atteint le prestige ${now}!`); await notify.notify(client, guildId, nEmb); } catch {}
    return reply(message, container(txt('## 💫 Prestige Réussi !'), sep(), txt([`**Prestige n°${now}** atteint !`, `Bonus XP permanent: **x${newMult.toFixed(2)}**`].join('\n'))));
  }
};
