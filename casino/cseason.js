const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, FLAGS } = require('../../utils/v2');
const Season = require('../../utils/season');
const Casino = require('../../utils/casino');

module.exports = {
  name: 'cseason',
  aliases: ['season', 'battlepass'],
  description: 'Affiche la progression de la saison casino (battle pass)',
  usage: '+cseason',
  category: 'casino',
  run: async (client, message, args) => {
    const userId = message.author.id;
    const season = Season.getCurrentSeason();
    const progress = Season.getSeasonProgress(userId);
    const rewards = Season.getSeasonRewards(userId);
    const vip = Casino.getVipActive(userId);
    const rewardLines = (season.rewards || []).map(r =>
      `**Niv.${r.level}** — Gratuit: ${r.free}${rewards[r.level] ? ' ✅' : ''} | VIP: ${r.vip}${vip && rewards[r.level] ? ' ✅' : ''}`
    );
    const row = new ActionRowBuilder().addComponents(
      ...(season.rewards || []).slice(0, 5).map(r =>
        new ButtonBuilder().setCustomId(`season_claim_${r.level}`).setLabel(`Niv.${r.level}`).setStyle(ButtonStyle.Success).setDisabled(!!rewards[r.level])
      )
    );
    const msg = await message.channel.send({
      components: [container(
        txt('## 🌌 Saison Casino — Battle Pass'),
        sep(),
        txt([
          `**Saison :** ${season.id} | **Progression :** ${progress} XP`,
          `Début: ${new Date(season.start).toLocaleDateString()} — Fin: ${new Date(season.end).toLocaleDateString()}`,
          '',
          ...rewardLines
        ].join('\n'))
      ), row],
      flags: FLAGS
    });
    const collector = msg.createMessageComponentCollector({ time: 30000 });
    collector.on('collect', async i => {
      if (i.user.id !== userId) return i.reply({ content: 'Ce n\'est pas ton battle pass !', ephemeral: true });
      const level = parseInt(i.customId.replace('season_claim_', ''), 10);
      const ok = Season.claimReward(userId, level, vip);
      return i.reply({ content: ok ? `✅ Récompense niv.${level} réclamée !` : 'Déjà réclamé ou non débloqué.', ephemeral: true });
    });
  }
};
