const { container, txt, sep, reply, errorContainer, formatNumber } = require('../../utils/v2');
const db = require('../../utils/simpledb');

function applyDailyInterest(userId) {
  const last = db.get(`bank_last_interest_${userId}`) || 0;
  const now = Date.now();
  if (now - last < 86400000) return;
  const bal = db.get(`bank_balance_${userId}`) || 0;
  if (bal <= 0) { db.set(`bank_last_interest_${userId}`, now); return; }
  const vip = db.get(`bank_vip_${userId}`) === true;
  const interest = Math.floor(bal * (vip ? 0.02 : 0.01));
  if (interest > 0) db.add(`bank_balance_${userId}`, interest);
  db.set(`bank_last_interest_${userId}`, now);
}

module.exports = {
  name: 'bank',
  aliases: ['banque'],
  description: 'Gère la banque de crédits (dépôt, retrait, infos)',
  usage: '[deposit|withdraw|info] [montant]',
  level: 1,
  run: async (client, message, args) => {
    const sub = (args[0] || 'info').toLowerCase();
    const userId = message.author.id;
    const guildId = message.guild.id;
    applyDailyInterest(userId);

    if (sub === 'deposit' || sub === 'dep' || sub === 'd') {
      const amount = parseInt(args[1], 10);
      if (!amount || amount <= 0) return reply(message, errorContainer('**Usage :** `!bank deposit <montant>`'));
      const walletKey = `credits_${guildId}_${userId}`;
      const wallet = db.get(walletKey) || 0;
      if (wallet < amount) return reply(message, errorContainer('**Solde insuffisant** dans votre portefeuille.'));
      db.subtract(walletKey, amount);
      db.add(`bank_balance_${userId}`, amount);
      return reply(message, container(
        txt('## 🏦 Dépôt Effectué'),
        sep(),
        txt([`**Montant déposé :** ${formatNumber(amount)} crédits`, `**Nouveau solde banque :** ${formatNumber((db.get(`bank_balance_${userId}`) || 0))} crédits`].join('\n'))
      ));
    }

    if (sub === 'withdraw' || sub === 'wd' || sub === 'w') {
      const amount = parseInt(args[1], 10);
      if (!amount || amount <= 0) return reply(message, errorContainer('**Usage :** `!bank withdraw <montant>`'));
      const bal = db.get(`bank_balance_${userId}`) || 0;
      if (bal < amount) return reply(message, errorContainer('**Solde insuffisant** à la banque.'));
      db.subtract(`bank_balance_${userId}`, amount);
      db.add(`credits_${guildId}_${userId}`, amount);
      return reply(message, container(
        txt('## 🏦 Retrait Effectué'),
        sep(),
        txt([`**Montant retiré :** ${formatNumber(amount)} crédits`, `**Nouveau solde banque :** ${formatNumber((db.get(`bank_balance_${userId}`) || 0))} crédits`].join('\n'))
      ));
    }

    const wallet = db.get(`credits_${guildId}_${userId}`) || 0;
    const bal = db.get(`bank_balance_${userId}`) || 0;
    const vip = db.get(`bank_vip_${userId}`) === true;
    const last = db.get(`bank_last_interest_${userId}`) || 0;
    const next = last ? Math.max(0, last + 86400000 - Date.now()) : 0;
    const h = Math.floor(next / 3600000), m = Math.floor(next % 3600000 / 60000);

    return reply(message, container(
      txt(`## 🏦 Banque — ${message.author.username}`),
      sep(),
      txt([
        `**💰 Portefeuille :** ${formatNumber(wallet)} crédits`,
        `**🏦 Banque :** ${formatNumber(bal)} crédits`,
        `**📊 Total :** ${formatNumber(wallet + bal)} crédits`,
        `**👑 Statut VIP :** ${vip ? 'Oui (2%/jour)' : 'Non (1%/jour)'}`,
        `**⏳ Prochain intérêt :** ${next ? `dans ${h}h ${m}m` : 'Disponible maintenant'}`
      ].join('\n'))
    ));
  }
};
