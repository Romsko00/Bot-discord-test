const { profileEmbed, createProgressBar, COLORS, EMOJIS, formatNumber } = require('../../utils/embedDesign');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'stu',
  aliases: ['lvl', 'xp'],
  description: 'Affiche votre progression de niveau',
  usage: '[membre]',
  level: 1,
  run: async (client, message, args) => {
    try {
      const target = message.mentions.members.first() || 
                     message.guild.members.cache.get(args[0]) || 
                     message.member;
      
      const user = target.user;
      const guildId = message.guild.id;
      const userId = user.id;

      // Récupération des données
      const level = db.get(`guild_${guildId}_level_${userId}`) || 1;
      const currentXP = db.get(`guild_${guildId}_xp_${userId}`) || 0;
      const messages = db.get(`msg_${guildId}_${userId}`) || 0;
      const xpNeeded = level * (client.config.LEVELS?.XP_REQUIRED_PER_LEVEL || 500);
      
      // Calcul du classement
      const allLevels = db.all()
        .filter(data => data.ID.startsWith(`guild_${guildId}_level_`))
        .map(data => ({
          userId: data.ID.split('_')[3],
          level: data.data,
          xp: db.get(`guild_${guildId}_xp_${data.ID.split('_')[3]}`) || 0
        }))
        .sort((a, b) => {
          if (b.level !== a.level) return b.level - a.level;
          return b.xp - a.xp;
        });
      
      const rank = allLevels.findIndex(u => u.userId === userId) + 1;
      
      // Progression vers le prochain niveau
      const progress = Math.min((currentXP / xpNeeded) * 100, 100);
      const progressBar = createProgressBar(currentXP, xpNeeded, 15);
      
      // Réduction de prix basée sur le niveau
      const reduction = Math.min(level * 0.04, 1.0);
      const reductionPercent = Math.round(reduction * 100);

      const embed = profileEmbed(user, {
        title: `Progression de ${user.username}`,
        color: target.displayHexColor !== '#000000' ? target.displayHexColor : COLORS.ACCENT,
        fields: [
          {
            name: 'Niveau Actuel',
            value: [
              `${EMOJIS.LEVEL} **Niveau ${level}**`,
              `${EMOJIS.DOT} Classement **#${rank}** sur ${allLevels.length}`,
              `${EMOJIS.DOT} ${formatNumber(messages)} messages`
            ].join('\n'),
            inline: true
          },
          {
            name: 'Expérience',
            value: [
              `${EMOJIS.DOT} **${formatNumber(currentXP)}** / ${formatNumber(xpNeeded)} XP`,
              `${EMOJIS.DOT} **${progress.toFixed(1)}%** complété`,
              `${EMOJIS.DOT} **${formatNumber(xpNeeded - currentXP)}** XP restant`
            ].join('\n'),
            inline: true
          },
          {
            name: 'Progression',
            value: `\`\`\`${progressBar}\`\`\``,
            inline: false
          },
          {
            name: 'Avantages',
            value: [
              `${EMOJIS.DOT} Réduction P1: **${reductionPercent}%**`,
              `${EMOJIS.DOT} Bonus crédits: **+${level * 2}** par daily`,
              `${EMOJIS.DOT} Crédits totaux gagnés: **${formatNumber(level * 100)}**`
            ].join('\n'),
            inline: false
          }
        ],
        footer: {
          text: `VNS Bot • ${xpNeeded - currentXP} XP pour le niveau ${level + 1}`
        },
        timestamp: true
      });

      // Ajouter les récompenses de rôle si disponibles
      const rewards = db.all()
        .filter(data => data.ID.startsWith(`rewardlevel_${guildId}_`))
        .map(data => {
          const [,, roleId, levelReq] = data.ID.split('_');
          return {
            roleId,
            level: parseInt(levelReq),
            unlocked: level >= parseInt(levelReq)
          };
        })
        .sort((a, b) => a.level - b.level);

      if (rewards.length > 0) {
        const nextReward = rewards.find(r => !r.unlocked);
        const unlockedRewards = rewards.filter(r => r.unlocked);
        
        let rewardText = '';
        if (unlockedRewards.length > 0) {
          rewardText += `**Débloqués** (${unlockedRewards.length})\n`;
          rewardText += unlockedRewards.slice(-3).map(r => 
            `${EMOJIS.SUCCESS} <@&${r.roleId}> (Niv. ${r.level})`
          ).join('\n');
        }
        
        if (nextReward) {
          rewardText += `\n\n**Prochain**\n${EMOJIS.ARROW} <@&${nextReward.roleId}> (Niv. ${nextReward.level})`;
        }

        if (rewardText) {
          embed.addFields({
            name: 'Récompenses de Rôles',
            value: rewardText,
            inline: false
          });
        }
      }

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Erreur rank:', error);
      const { errorEmbed } = require('../../utils/embedDesign');
      await message.reply({ 
        embeds: [errorEmbed('Erreur', 'Impossible de récupérer vos données de progression.')] 
      });
    }
  }
};
