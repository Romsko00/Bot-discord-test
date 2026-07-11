const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, FLAGS } = require('../../utils/v2');
const Talents = require('../../utils/talents');

module.exports = {
  name: 'ctalents',
  aliases: ['talents', 'arbre'],
  description: 'Gère ton arbre de talents casino',
  usage: '+ctalents',
  category: 'casino',
  run: async (client, message, args) => {
    const userId = message.author.id;
    const points = Talents.getTalentPoints(userId);
    const talents = Talents.getTalents(userId);
    const tree = Talents.TALENT_TREE;
    const lines = tree.map(t => `**${t.name}** (${talents[t.id]||0}/${t.max}) — ${t.desc}`);
    const row = new ActionRowBuilder().addComponents(
      tree.slice(0, 5).map(t => new ButtonBuilder().setCustomId(`talent_${t.id}`).setLabel(t.name).setStyle(ButtonStyle.Primary).setDisabled(points <= 0 || (talents[t.id]||0) >= t.max))
    );
    const sent = await message.channel.send({
      components: [container(txt('## 🧬 Arbre de Talents Casino'), sep(), txt([`**Points disponibles :** ${points}`, '', ...lines].join('\n'))), row],
      flags: FLAGS
    });
    const collector = sent.createMessageComponentCollector({ time: 30000 });
    collector.on('collect', async i => {
      if (i.user.id !== userId) return i.reply({ content: 'Ce n\'est pas ton arbre !', ephemeral: true });
      const talentId = i.customId.replace('talent_', '');
      const ok = Talents.spendTalentPoint(userId, talentId);
      return i.reply({ content: ok ? `✅ Talent **${tree.find(t=>t.id===talentId)?.name}** amélioré !` : 'Impossible d\'améliorer ce talent.', ephemeral: true });
    });
  }
};
