const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

async function getMuteRole(guild) {
  const id = db.get(`mRole_${guild.id}`);
  if (id) { const r = guild.roles.cache.get(id); if (r) return r; }
  return guild.roles.cache.find(r => ['muet', 'muted', 'mute'].includes(r.name.toLowerCase())) || null;
}

module.exports = {
  name: 'mutelist',
  aliases: ['muted', 'mutes'],
  description: 'Liste des membres mutés',

  run: async (client, message, args) => {
    try {
      const isSuperOwner = (client.config.superadmin?.includes(message.author.id))
        || (client.config.owners?.includes(message.author.id))
        || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
      let hasPermission = isSuperOwner;
      if (!hasPermission) message.member.roles.cache.forEach(r => { if (db.get(`modsp_${message.guild.id}_${r.id}`) || db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`)) hasPermission = true; });
      if (!hasPermission) return message.reply({ components: [errorContainer('**Permission refusée.**')], flags: FLAGS });

      const muteRole = await getMuteRole(message.guild);
      if (!muteRole) return message.reply({ components: [container(txt('## 🔇 Mutés'), sep(), txt('Aucun rôle muet trouvé sur ce serveur.'))], flags: FLAGS });

      const mutedMembers = muteRole.members.filter(m => message.guild.members.cache.has(m.id));
      if (mutedMembers.size === 0) return message.reply({ components: [container(txt('## 🔇 Mutés'), sep(), txt('Aucun membre actuellement muté.'))], flags: FLAGS });

      const mutedArray = Array.from(mutedMembers.values());
      const PER_PAGE = 15;
      const totalPages = Math.max(1, Math.ceil(mutedArray.length / PER_PAGE));
      let page = 0;

      const buildPage = (p) => {
        const slice = mutedArray.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
        const lines = slice.map((m, i) => `**${p * PER_PAGE + i + 1}.** ${m.user.tag} (\`${m.user.id}\`)`).join('\n');
        const c = container(
          txt(`## 🔇 Membres Mutés — Page ${p + 1}/${totalPages}`),
          txt(`**Total :** ${mutedArray.length} membre${mutedArray.length > 1 ? 's' : ''}`),
          sep(),
          txt(lines)
        );
        const navRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ml_prev').setLabel('‹').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId('ml_info').setLabel(`${p + 1}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId('ml_next').setLabel('›').setStyle(ButtonStyle.Secondary).setDisabled(p >= totalPages - 1)
        );
        return { c, navRow };
      };

      const { c, navRow } = buildPage(page);
      const sent = await message.reply({ components: totalPages > 1 ? [c, navRow] : [c], flags: FLAGS });
      if (totalPages <= 1) return;

      const collector = sent.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300000 });
      collector.on('collect', async i => {
        if (i.customId === 'ml_prev') page = Math.max(0, page - 1);
        else if (i.customId === 'ml_next') page = Math.min(totalPages - 1, page + 1);
        const { c: nc, navRow: nr } = buildPage(page);
        await i.update({ components: [nc, nr], flags: FLAGS }).catch(() => {});
      });
      collector.on('end', () => { const { c: ec } = buildPage(page); sent.edit({ components: [ec], flags: FLAGS }).catch(() => {}); });
    } catch (err) {
      console.error('[mutelist]', err);
      message.reply({ components: [errorContainer('Une erreur est survenue.')], flags: FLAGS }).catch(() => {});
    }
  }
};
