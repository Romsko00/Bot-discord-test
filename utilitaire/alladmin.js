const Discord = require('discord.js');
const db = require('../../utils/simpledb');
const { getExactPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'alladmin', aliases: ['listadmin'],
  description: 'Liste tous les administrateurs', level: 2,
  run: async (client, message) => {
    let hasPermission = false;
    for (const role of message.member.roles.cache.values()) { if (db.get(`ownerp_${message.guild.id}_${role.id}`) || db.get(`admin_${message.guild.id}_${role.id}`)) { hasPermission = true; break; } }
    const allowed = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) || hasPermission;
    if (!allowed) return reply(message, errorContainer("Permission refusée."));
    await showAdminList(client, message);
  }
};

async function showAdminList(client, message) {
  await message.guild.members.fetch();
  const adminMembers = message.guild.members.cache.filter(m => !m.user.bot && getExactPermissionLevel(client, { author: { id: m.id }, guild: message.guild, member: m }) >= 6);
  if (adminMembers.size === 0) return reply(message, container(txt('## 📋 Liste des Administrateurs'), sep(), txt('Aucun administrateur trouvé sur ce serveur.')));

  let page = 0;
  const PER_PAGE = 10, totalPages = Math.ceil(adminMembers.size / PER_PAGE);
  const adminsArr = Array.from(adminMembers.values());

  const buildPage = (p) => {
    const slice = adminsArr.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
    const lines = slice.map((admin, i) => `${p * PER_PAGE + i + 1}. ${admin.user} (\`${admin.user.id}\`)\n   📅 Rejoint <t:${Math.floor(admin.joinedTimestamp / 1000)}:R>`);
    return container(txt(`## 📋 Administrateurs de ${message.guild.name}`), sep(), txt(lines.join('\n\n')), sep(), txt(`*Page ${p + 1}/${totalPages} • Total: ${adminMembers.size} admin(s)*`));
  };

  const buildButtons = (p) => new Discord.ActionRowBuilder().addComponents(
    new Discord.ButtonBuilder().setCustomId('admin_previous').setLabel('◀').setStyle(Discord.ButtonStyle.Secondary).setDisabled(p === 0),
    new Discord.ButtonBuilder().setCustomId('admin_refresh').setEmoji('🔄').setStyle(Discord.ButtonStyle.Success),
    new Discord.ButtonBuilder().setCustomId('admin_next').setLabel('▶').setStyle(Discord.ButtonStyle.Secondary).setDisabled(p >= totalPages - 1),
    new Discord.ButtonBuilder().setCustomId('admin_close').setLabel('✖').setStyle(Discord.ButtonStyle.Danger)
  );

  const comps = [buildPage(page)];
  if (totalPages > 1 || true) comps.push(buildButtons(page));

  const listMessage = await reply(message, ...comps);
  const realMsg = listMessage;

  const col = realMsg.createMessageComponentCollector({ time: 300_000 });
  col.on('collect', async interaction => {
    if (interaction.user.id !== message.author.id) { try { await interaction.reply({ content: 'Réservé au créateur.', ephemeral: true }); } catch {} return; }
    await interaction.deferUpdate();
    if (interaction.customId === 'admin_previous' && page > 0) page--;
    else if (interaction.customId === 'admin_next' && page < totalPages - 1) page++;
    else if (interaction.customId === 'admin_refresh') { await message.guild.members.fetch(); }
    else if (interaction.customId === 'admin_close') { await interaction.editReply({ components: [] }); col.stop(); return; }
    await interaction.editReply({ components: [buildPage(page), buildButtons(page)], flags: FLAGS });
  });
  col.on('end', () => realMsg.edit({ components: [] }).catch(() => {}));
}

async function getAdminInfo(client, message, adminId) {
  const admin = message.guild.members.cache.get(adminId);
  if (!admin) return null;
  const roles = admin.roles.cache.filter(r => r.id !== message.guild.id).sort((a, b) => b.position - a.position).map(r => r.toString()).join(', ') || 'Aucun rôle';
  const perms = admin.permissions.toArray().join(', ') || 'Aucune permission spéciale';
  const botLevel = getExactPermissionLevel(client, { author: { id: admin.id }, guild: message.guild, member: admin });
  return container(txt(`## 👑 ${admin.user.tag}`), sep(), txt([`**ID :** ${admin.user.id}`, `**Rejoint :** <t:${Math.floor(admin.joinedTimestamp / 1000)}:F>`, `**Créé :** <t:${Math.floor(admin.user.createdTimestamp / 1000)}:F>`, `**Rôles :** ${roles.slice(0, 800)}`, `**Permissions :** ${perms.slice(0, 800)}`, `**Niveau Bot :** ${botLevel}${botLevel >= 6 ? ' (Admin)' : ''}`].join('\n')));
}
module.exports.getAdminInfo = getAdminInfo;
