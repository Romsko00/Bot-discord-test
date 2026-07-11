const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'banlist',
  aliases: [],
  description: 'Liste des membres bannis',

  run: async (client, message, args) => {
    try {
      const isSuperOwner = (client.config.superadmin?.includes(message.author.id))
        || (client.config.owners?.includes(message.author.id))
        || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
      let hasPermission = isSuperOwner;
      if (!hasPermission) message.member.roles.cache.forEach(r => { if (db.get(`modsp_${message.guild.id}_${r.id}`) || db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`)) hasPermission = true; });
      if (!hasPermission) return message.reply({ components: [errorContainer('**Permission refusée.**')], flags: FLAGS });

      let bans;
      try { bans = await message.guild.bans.fetch(); }
      catch { return message.reply({ components: [errorContainer('Je n\'ai pas la permission de voir les bannissements.')], flags: FLAGS }); }

      if (bans.size === 0) return message.reply({ components: [container(txt('## 📋 Bannissements'), sep(), txt('Aucun membre banni sur ce serveur.'))], flags: FLAGS });

      const banArray = Array.from(bans.values());
      const PER_PAGE = 15;
      const totalPages = Math.max(1, Math.ceil(banArray.length / PER_PAGE));
      let page = 0;

      const buildPage = (p) => {
        const slice = banArray.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
        const lines = slice.map((ban, i) => `**${p * PER_PAGE + i + 1}.** ${ban.user.tag} (\`${ban.user.id}\`)\n↳ ${ban.reason || 'Aucune raison'}`).join('\n\n');
        const c = container(
          txt(`## 📋 Bannissements — Page ${p + 1}/${totalPages}`),
          txt(`**Total :** ${banArray.length} ban${banArray.length > 1 ? 's' : ''}`),
          sep(),
          txt(lines)
        );
        const navRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('bl_prev').setLabel('‹').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId('bl_info').setLabel(`${p + 1}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId('bl_next').setLabel('›').setStyle(ButtonStyle.Secondary).setDisabled(p >= totalPages - 1)
        );
        return { c, navRow };
      };

      const { c, navRow } = buildPage(page);
      const sent = await message.channel.send({ components: totalPages > 1 ? [c, navRow] : [c], flags: FLAGS });
      if (totalPages <= 1) return;

      const collector = sent.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300000 });
      collector.on('collect', async i => {
        if (i.customId === 'bl_prev') page = Math.max(0, page - 1);
        else if (i.customId === 'bl_next') page = Math.min(totalPages - 1, page + 1);
        const { c: nc, navRow: nr } = buildPage(page);
        await i.update({ components: [nc, nr], flags: FLAGS }).catch(() => {});
      });
      collector.on('end', () => { const { c: ec } = buildPage(page); sent.edit({ components: [ec], flags: FLAGS }).catch(() => {}); });
    } catch (err) {
      console.error('[banlist]', err);
      message.channel.send({ components: [errorContainer('Une erreur est survenue.')], flags: FLAGS }).catch(() => {});
    }
  }
};
