const { container, txt, sep, row, btn, reply, errorContainer, formatNumber, FLAGS, ButtonStyle } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'leaderboard',
  aliases: ['lb', 'top', 'classement'],
  description: 'Affiche le classement des membres par niveau',
  usage: '[page]',
  level: 0,
  run: async (client, message, args) => {
    try {
      const guildId = message.guild.id;
      const PER_PAGE = 10;
      const allLevels = db.all()
        .filter(d => d.ID.startsWith(`guild_${guildId}_level_`))
        .map(d => ({ userId: d.ID.split('_')[3], level: d.data, xp: db.get(`guild_${guildId}_xp_${d.ID.split('_')[3]}`) || 0, messages: db.get(`msg_${guildId}_${d.ID.split('_')[3]}`) || 0 }))
        .sort((a, b) => b.level !== a.level ? b.level - a.level : b.xp - a.xp);

      if (!allLevels.length) return reply(message, container(txt('## 🏆 Classement'), sep(), txt('Aucun membre n\'a encore gagné d\'XP sur ce serveur.')));

      const totalPages = Math.ceil(allLevels.length / PER_PAGE);
      let page = Math.max(1, Math.min(parseInt(args[0]) || 1, totalPages));
      const userRank = allLevels.findIndex(u => u.userId === message.author.id) + 1;

      const buildPage = (p) => {
        const start = (p - 1) * PER_PAGE;
        const pageData = allLevels.slice(start, start + PER_PAGE);
        const medals = ['🥇', '🥈', '🥉'];
        const lines = pageData.map((u, i) => {
          const rank = start + i + 1;
          const medal = rank <= 3 ? medals[rank - 1] : `**#${rank}**`;
          const isMe = u.userId === message.author.id ? ' **›**' : '';
          return `${medal}${isMe} <@${u.userId}>\n↳ Niveau **${u.level}** • ${formatNumber(u.xp)} XP • ${formatNumber(u.messages)} msgs`;
        }).join('\n\n');

        const c = container(
          txt(`## 🏆 Classement — ${message.guild.name}`),
          sep(),
          txt(lines),
          sep(),
          txt([
            `**📊 Membres classés :** ${allLevels.length}`,
            userRank > 0 ? `**Votre position :** #${userRank}` : null
          ].filter(Boolean).join(' | ')),
          ...(totalPages > 1 ? [row(
            btn('lb_first', '⏮', ButtonStyle.Secondary, null, p === 1),
            btn('lb_prev', '‹', ButtonStyle.Primary, null, p === 1),
            btn('lb_page', `${p}/${totalPages}`, ButtonStyle.Secondary, null, true),
            btn('lb_next', '›', ButtonStyle.Primary, null, p === totalPages),
            btn('lb_last', '⏭', ButtonStyle.Secondary, null, p === totalPages)
          )] : [])
        );
        return c;
      };

      const sent = await reply(message, buildPage(page));
      if (totalPages <= 1) return;

      const collector = sent.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300000 });
      collector.on('collect', async i => {
        if (i.customId === 'lb_first') page = 1;
        else if (i.customId === 'lb_last') page = totalPages;
        else if (i.customId === 'lb_prev') page = Math.max(1, page - 1);
        else if (i.customId === 'lb_next') page = Math.min(totalPages, page + 1);
        await i.update({ components: [buildPage(page)], flags: FLAGS });
      });
      collector.on('end', () => sent.edit({ components: [buildPage(page)], flags: FLAGS }).catch(() => {}));
    } catch (error) {
      console.error('Erreur leaderboard:', error);
      return reply(message, errorContainer('Impossible d\'afficher le classement.'));
    }
  }
};
