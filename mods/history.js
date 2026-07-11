const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'history',
  aliases: ['sanctions'],
  description: 'Historique des modérations d\'un membre',
  usage: '[membre]',

  run: async (client, message, args) => {
    try {
      const isSuperOwner = (client.config.superadmin?.includes(message.author.id))
        || (client.config.owners?.includes(message.author.id))
        || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
      let hasPermission = isSuperOwner;
      if (!hasPermission) message.member.roles.cache.forEach(r => { if (db.get(`modsp_${message.guild.id}_${r.id}`) || db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`)) hasPermission = true; });
      if (!hasPermission) return reply(message, errorContainer('**Permission refusée.**'));

      let targetMember = args[0]
        ? (message.mentions.members.first() || message.guild.members.cache.get(args[0]) || await message.guild.members.fetch(args[0]).catch(() => null))
        : message.member;

      if (!targetMember && args[0]) {
        const user = await client.users.fetch(args[0]).catch(() => null);
        if (!user) return reply(message, errorContainer('**Membre introuvable.**'));
        targetMember = { user, id: user.id };
      }
      if (!targetMember) targetMember = message.member;

      const sanctions = db.get(`sanctions_${message.guild.id}_${targetMember.id}`) || [];
      const PER_PAGE = 5;
      const totalPages = Math.max(1, Math.ceil(sanctions.length / PER_PAGE));
      let page = 0;

      const buildPage = (p) => {
        const slice = sanctions.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
        const comps = [
          txt(`## 📋 Sanctions — ${targetMember.user?.tag || 'Utilisateur'}`),
          txt(`Page ${p + 1}/${totalPages} • **${sanctions.length}** sanction(s)`),
          sep()
        ];

        if (sanctions.length === 0) {
          comps.push(txt('✅ Aucune sanction enregistrée pour ce membre.'));
        } else {
          const lines = slice.map((s, i) => {
            const num = p * PER_PAGE + i + 1;
            const ts = Math.floor((s.timestamp || Date.now()) / 1000);
            return `**#${num} — ${(s.type || 'sanction').toUpperCase()}**\nModérateur : ${s.moderator}\nRaison : ${(s.reason || 'Aucune').slice(0, 100)}\nDate : <t:${ts}:R>`;
          });
          comps.push(txt(lines.join('\n\n')));
        }

        const navRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('history_prev').setLabel('‹').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId('history_pageinfo').setLabel(`${p + 1}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId('history_next').setLabel('›').setStyle(ButtonStyle.Secondary).setDisabled(p >= totalPages - 1)
        );

        return { c: container(...comps), navRow, total: totalPages };
      };

      const { c, navRow, total } = buildPage(page);
      const comps = total > 1 ? [c, navRow] : [c];
      const sent = await message.channel.send({ components: comps, flags: FLAGS });
      if (total <= 1) return;

      const collector = sent.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300000 });
      collector.on('collect', async i => {
        if (i.customId === 'history_prev') page = Math.max(0, page - 1);
        else if (i.customId === 'history_next') page = Math.min(total - 1, page + 1);
        const { c: nc, navRow: nr } = buildPage(page);
        await i.update({ components: [nc, nr], flags: FLAGS }).catch(() => {});
      });
      collector.on('end', () => { const { c: ec } = buildPage(page); sent.edit({ components: [ec], flags: FLAGS }).catch(() => {}); });
    } catch (err) {
      console.error('[history]', err);
      reply(message, errorContainer('Une erreur est survenue.'));
    }
  }
};

module.exports.addSanction = function(guildId, userId, type, moderator, reason) {
  try {
    const key = `sanctions_${guildId}_${userId}`;
    const sanctions = db.get(key) || [];
    sanctions.push({ type, moderator, reason: reason || 'Aucune raison spécifiée', timestamp: Date.now() });
    db.set(key, sanctions);
    return sanctions.length;
  } catch (e) { console.error('[history.addSanction]', e); return 0; }
};

module.exports.removeSanction = function(guildId, userId, index) {
  try {
    const key = `sanctions_${guildId}_${userId}`;
    const sanctions = db.get(key) || [];
    if (index >= 0 && index < sanctions.length) { sanctions.splice(index, 1); db.set(key, sanctions); return true; }
    return false;
  } catch (e) { return false; }
};

module.exports.getSanctionCount = function(guildId, userId) {
  try { return (db.get(`sanctions_${guildId}_${userId}`) || []).length; } catch { return 0; }
};
