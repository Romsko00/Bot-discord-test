const { container, txt, sep, reply, errorContainer, formatNumber } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'claim',
  aliases: ['daily', 'day'],
  description: 'Récupérer vos crédits quotidiens',
  usage: '',
  level: 1,
  run: async (client, message) => {
    try {
      const userId = message.author.id;
      const guildId = message.guild.id;
      const lastClaim = db.get(`lastclaim_${guildId}_${userId}`) || 0;
      const oneDay = 86400000;
      const now = Date.now();

      if (now - lastClaim < oneDay) {
        const remaining = oneDay - (now - lastClaim);
        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        return reply(message, container(
          txt('## ⏳ Cooldown Daily'),
          sep(),
          txt(`Vous avez déjà réclamé vos crédits aujourd'hui.\n**Prochain claim dans :** ${h}h ${m}m`)
        ));
      }

      const level = db.get(`guild_${guildId}_level_${userId}`) || 1;
      const baseAmount = 10;
      const levelBonus = level * 2;
      const totalAmount = baseAmount + levelBonus;

      if (client.CreditLevelSystem?.addUserCredits) {
        client.CreditLevelSystem.addUserCredits(userId, guildId, totalAmount);
      } else {
        db.add(`credits_${guildId}_${userId}`, totalAmount);
      }
      db.set(`lastclaim_${guildId}_${userId}`, now);

      const newBalance = client.CreditLevelSystem?.getUserCredits?.(userId, guildId) ||
        db.get(`credits_${guildId}_${userId}`) || 0;

      return reply(message, container(
        txt('## ✅ Daily Claim'),
        sep(),
        txt([
          `**💰 Crédits reçus :** +${formatNumber(totalAmount)} crédits`,
          `**🎁 Bonus niveau ${level} :** +${formatNumber(levelBonus)} crédits`,
          `**📊 Nouveau solde :** ${formatNumber(newBalance)} crédits`,
          '',
          '*Revenez dans 24h pour votre prochain claim !*'
        ].join('\n'))
      ));
    } catch (error) {
      console.error('Erreur claim:', error);
      return reply(message, errorContainer('Une erreur est survenue lors du claim.'));
    }
  }
};
