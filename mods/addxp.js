const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'addxp',
  aliases: ['givexp', 'addlevel'],
  description: 'Ajoute de l\'XP à un utilisateur',
  usage: '@utilisateur <montant>',

  run: async (client, message, args, prefix) => {
    try {
      const isSuperOwner = (client.config.superadmin?.includes(message.author.id)) || (client.config.owners?.includes(message.author.id)) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
      let hasPermission = isSuperOwner;
      if (!hasPermission) message.member.roles.cache.forEach(r => { if (db.get(`ownerp_${message.guild.id}_${r.id}`)) hasPermission = true; });
      if (!hasPermission) return reply(message, errorContainer('**Permission refusée.**'));
      if (!args[0] || !args[1]) return reply(message, errorContainer(`**Usage :** \`${prefix}addxp @utilisateur <montant>\``));

      let target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
      if (!target) return reply(message, errorContainer(`**Membre introuvable :** \`${args[0]}\``));

      const xpAmount = parseInt(args[1]);
      if (isNaN(xpAmount) || xpAmount <= 0) return reply(message, errorContainer('**Montant invalide.** Nombre positif requis.'));
      if (xpAmount > 1000000) return reply(message, errorContainer('**Maximum :** 1 000 000 XP par ajout.'));

      const guildId = message.guild.id;
      const userId = target.user.id;
      const xpKey = `guild_${guildId}_xp_${userId}`;
      const levelKey = `guild_${guildId}_level_${userId}`;
      const xpPerLevel = client.config.LEVELS?.XP_REQUIRED_PER_LEVEL || 500;

      const currentXP = db.get(xpKey) || 0;
      const currentLevel = db.get(levelKey) || 1;

      let newLevel = currentLevel;
      let remainingXP = currentXP + xpAmount;
      while (remainingXP >= newLevel * xpPerLevel) { remainingXP -= newLevel * xpPerLevel; newLevel++; }

      db.set(xpKey, remainingXP);
      db.set(levelKey, newLevel);

      const leveledUp = newLevel > currentLevel;

      return reply(message, container(
        txt(`## ${leveledUp ? '🎉 Montée de Niveau' : '⭐ XP Ajouté'}`),
        sep(),
        txt([
          `**Utilisateur :** ${target.user.tag}`,
          `**XP ajouté :** +${xpAmount.toLocaleString('fr-FR')}`,
          `**Niveau :** ${currentLevel} → **${newLevel}**`,
          `**XP actuel :** ${remainingXP.toLocaleString('fr-FR')} / ${(newLevel * xpPerLevel).toLocaleString('fr-FR')}`,
          leveledUp ? `**Niveaux gagnés :** ${newLevel - currentLevel}` : null
        ].filter(Boolean).join('\n'))
      ));
    } catch (err) {
      console.error('[addxp]', err);
      reply(message, errorContainer('Une erreur est survenue.'));
    }
  }
};
