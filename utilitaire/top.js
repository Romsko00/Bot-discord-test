const Discord = require('discord.js');
const db = require('../../utils/simpledb');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'top', aliases: ['leaderboard'],
  description: 'Classements divers', level: 0,
  run: async (client, message, args) => {
    let perm = false;
    message.member.roles.cache.forEach(r => { if (db.get(`modsp_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`) || db.get(`admin_${message.guild.id}_${r.id}`)) perm = true; });
    const allowed = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true || perm || db.get(`channelpublic_${message.guild.id}_${message.channel.id}`) === true;
    if (!allowed) return;
    if (args[0] === 'rank' || args[0] === 'level') await handleRankLeaderboard(client, message, args);
    else await handleInvitesLeaderboard(client, message, args);
  }
};

function navRow(prevId, nextId, page, totalPages) {
  return new Discord.ActionRowBuilder().addComponents(
    new Discord.ButtonBuilder().setCustomId(prevId).setLabel('◀').setStyle(Discord.ButtonStyle.Secondary).setDisabled(page === 0),
    new Discord.ButtonBuilder().setCustomId(nextId).setLabel('▶').setStyle(Discord.ButtonStyle.Secondary).setDisabled(page === totalPages - 1)
  );
}

async function handleRankLeaderboard(client, message) {
  const data = db.all().filter(d => d.ID.startsWith(`guild_${message.guild.id}_xp`)).sort((a, b) => b.data - a.data);
  let page = 0;
  const PER_PAGE = 15, totalPages = Math.ceil(data.length / PER_PAGE) || 1;
  const buildPage = (p) => {
    const slice = data.slice(p * PER_PAGE, (p + 1) * PER_PAGE).filter(x => message.guild.members.cache.get(x.ID.split('_')[3]));
    const lines = slice.length ? slice.map((m, i) => `${p * PER_PAGE + i + 1}) **${client.users.cache.get(m.ID.split('_')[3])?.tag || 'Inconnu'}** — Niveau **${db.get(`guild_${message.guild.id}_level_${m.ID.split('_')[3]}`) || 0}** (*${m.data || 0} XP*)`) : ['Aucune donnée'];
    return container(txt('## 📊 Classement XP'), sep(), txt(lines.join('\n')), sep(), txt(`*Page ${p + 1}/${totalPages}*`));
  };
  const comps = [buildPage(page)];
  if (totalPages > 1) comps.push(navRow('prev_rank', 'next_rank', page, totalPages));
  const msg = await message.channel.send({ components: comps, flags: FLAGS });
  if (totalPages <= 1) return;
  const col = msg.createMessageComponentCollector({ time: 300_000 });
  col.on('collect', async i => {
    if (i.user.id !== message.author.id) { try { await i.reply({ content: 'Réservé au créateur.', ephemeral: true }); } catch {} return; }
    if (i.customId === 'prev_rank') page = Math.max(0, page - 1);
    else if (i.customId === 'next_rank') page = Math.min(totalPages - 1, page + 1);
    await i.update({ components: [buildPage(page), navRow('prev_rank', 'next_rank', page, totalPages)], flags: FLAGS });
  });
  col.on('end', () => msg.edit({ components: [] }).catch(() => {}));
}

async function handleInvitesLeaderboard(client, message) {
  const data = db.all().filter(d => d.ID.startsWith(`invites_${message.guild.id}`)).sort((a, b) => b.data - a.data);
  let page = 0;
  const PER_PAGE = 15, totalPages = Math.ceil(data.length / PER_PAGE) || 1;
  const buildPage = (p) => {
    const slice = data.slice(p * PER_PAGE, (p + 1) * PER_PAGE).filter(x => message.guild.members.cache.get(x.ID.split('_')[2]));
    const lines = slice.length ? slice.map((m, i) => { const uid = m.ID.split('_')[2]; const joins = db.get(`Regular_${message.guild.id}_${uid}`) || 0; const leaves = db.get(`leaves_${message.guild.id}_${uid}`) || 0; const bonus = db.get(`bonus_${message.guild.id}_${uid}`) || 0; return `${p * PER_PAGE + i + 1}) **${client.users.cache.get(uid)?.tag || 'Inconnu'}** : **${m.data}** invites (${joins} rejoints, ${leaves} départs, ${bonus} bonus)`; }) : ['Aucune donnée'];
    return container(txt('## 🏆 Classement Invitations'), sep(), txt(lines.join('\n')), sep(), txt(`*Page ${p + 1}/${totalPages}*`));
  };
  const comps = [buildPage(page)];
  if (totalPages > 1) comps.push(navRow('prev_invite', 'next_invite', page, totalPages));
  const msg = await message.channel.send({ components: comps, flags: FLAGS });
  if (totalPages <= 1) return;
  const col = msg.createMessageComponentCollector({ time: 300_000 });
  col.on('collect', async i => {
    if (i.user.id !== message.author.id) { try { await i.reply({ content: 'Réservé au créateur.', ephemeral: true }); } catch {} return; }
    if (i.customId === 'prev_invite') page = Math.max(0, page - 1);
    else if (i.customId === 'next_invite') page = Math.min(totalPages - 1, page + 1);
    await i.update({ components: [buildPage(page), navRow('prev_invite', 'next_invite', page, totalPages)], flags: FLAGS });
  });
  col.on('end', () => msg.edit({ components: [] }).catch(() => {}));
}
