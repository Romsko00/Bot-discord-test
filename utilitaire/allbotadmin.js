const Discord = require('discord.js');
const db = require('../../utils/simpledb');
const { getExactPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'allbotadmin', aliases: [],
  description: 'Liste tous les bots administrateurs', level: 2,
  run: async (client, message) => {
    let hasPermission = false;
    for (const role of message.member.roles.cache.values()) { if (db.get(`ownerp_${message.guild.id}_${role.id}`) || db.get(`admin_${message.guild.id}_${role.id}`)) { hasPermission = true; break; } }
    const allowed = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) || hasPermission;
    if (!allowed) return reply(message, errorContainer('Permission refusée.'));
    await showBotAdminList(client, message);
  }
};

async function showBotAdminList(client, message) {
  await message.guild.members.fetch();
  let botAdminMembers = message.guild.members.cache.filter(m => m.user.bot && getExactPermissionLevel(client, { author: { id: m.id }, guild: message.guild, member: m }) >= 6);
  if (botAdminMembers.size === 0) return reply(message, container(txt('## 🤖 Bots Administrateurs'), sep(), txt('Aucun bot avec les permissions administrateur trouvé.')));

  function getDangerousPermissions(member) {
    const dangerous = ['Administrator','ManageGuild','ManageRoles','ManageChannels','ManageWebhooks','ManageMessages','KickMembers','BanMembers','MentionEveryone'];
    const arr = [];
    const lvl = getExactPermissionLevel(client, { author: { id: member.id }, guild: message.guild, member });
    if (lvl >= 6) arr.push('Bot-Level Admin');
    return arr.concat((member.permissions?.toArray() || []).filter(p => dangerous.includes(p)));
  }

  function getBotInfo(b) {
    const info = [];
    if (b.user.flags?.has(Discord.UserFlags.VerifiedBot)) info.push('✅ Vérifié'); else info.push('⚠️ Non vérifié');
    info.push(`📅 <t:${Math.floor(b.joinedTimestamp / 1000)}:R>`);
    const dp = getDangerousPermissions(b);
    if (dp.length > 0) info.push(`🚨 ${dp.length} perm(s) dangereuse(s)`);
    return info.join(' • ');
  }

  let page = 0;
  const PER_PAGE = 10;
  let totalPages = Math.ceil(botAdminMembers.size / PER_PAGE);
  const botsArr = Array.from(botAdminMembers.values());

  const buildPage = (p) => {
    const slice = botsArr.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
    const lines = slice.map((b, i) => `${p * PER_PAGE + i + 1}. ${b.user} (\`${b.user.id}\`)\n   ${getBotInfo(b)}`);
    return container(txt(`## 🤖⚠️ Bots Administrateurs — ${message.guild.name}`), sep(), txt('Ces bots ont un niveau admin ou des permissions dangereuses.'), sep(), txt(lines.join('\n\n')), sep(), txt(`*Page ${p + 1}/${totalPages} • Total: ${botAdminMembers.size}*`));
  };
  const buildButtons = (p) => new Discord.ActionRowBuilder().addComponents(
    new Discord.ButtonBuilder().setCustomId('botadmin_previous').setLabel('◀').setStyle(Discord.ButtonStyle.Secondary).setDisabled(p === 0),
    new Discord.ButtonBuilder().setCustomId('botadmin_refresh').setEmoji('🔄').setStyle(Discord.ButtonStyle.Success),
    new Discord.ButtonBuilder().setCustomId('botadmin_audit').setLabel('🔍 Audit').setStyle(Discord.ButtonStyle.Danger),
    new Discord.ButtonBuilder().setCustomId('botadmin_next').setLabel('▶').setStyle(Discord.ButtonStyle.Secondary).setDisabled(p >= totalPages - 1),
    new Discord.ButtonBuilder().setCustomId('botadmin_close').setLabel('✖').setStyle(Discord.ButtonStyle.Danger)
  );

  const listMessage = await message.channel.send({ components: [buildPage(page), buildButtons(page)], flags: FLAGS });
  const col = listMessage.createMessageComponentCollector({ time: 300_000 });
  col.on('collect', async interaction => {
    if (interaction.user.id !== message.author.id) { try { await interaction.reply({ content: 'Réservé au créateur.', ephemeral: true }); } catch {} return; }
    await interaction.deferUpdate();
    if (interaction.customId === 'botadmin_previous' && page > 0) page--;
    else if (interaction.customId === 'botadmin_next' && page < totalPages - 1) page++;
    else if (interaction.customId === 'botadmin_refresh') { botAdminMembers = message.guild.members.cache.filter(m => m.user.bot && getExactPermissionLevel(client, { author: { id: m.id }, guild: message.guild, member: m }) >= 6); totalPages = Math.ceil(botAdminMembers.size / PER_PAGE); if (page >= totalPages) page = Math.max(0, totalPages - 1); }
    else if (interaction.customId === 'botadmin_audit') {
      const bots = Array.from(botAdminMembers.values());
      const verified = bots.filter(b => b.user.flags?.has(Discord.UserFlags.VerifiedBot)).length;
      const atRisk = bots.filter(b => getDangerousPermissions(b).length > 1).length;
      const unverifiedList = bots.filter(b => !b.user.flags?.has(Discord.UserFlags.VerifiedBot)).slice(0, 5).map(b => `• ${b.user.tag} (\`${b.user.id}\`)`).join('\n');
      await interaction.followUp({ content: `**🔍 Audit de Sécurité**\nTotal: ${bots.length} | Vérifiés: ${verified} | À risque: ${atRisk}\n${unverifiedList ? `\n**Bots non vérifiés:**\n${unverifiedList}` : ''}`, ephemeral: true });
      return;
    }
    else if (interaction.customId === 'botadmin_close') { await interaction.editReply({ components: [] }); col.stop(); return; }
    await interaction.editReply({ components: [buildPage(page), buildButtons(page)], flags: FLAGS });
  });
  col.on('end', () => listMessage.edit({ components: [] }).catch(() => {}));
}

async function getBotAdminSecurityDetails(botAdminMember, client, guild) {
  const dangerous = ['Administrator','ManageGuild','ManageRoles','ManageChannels','ManageWebhooks','ManageMessages','KickMembers','BanMembers','MentionEveryone'];
  const lvl = getExactPermissionLevel(client, { author: { id: botAdminMember.id }, guild, member: botAdminMember });
  const dangerousPerms = (lvl >= 6 ? ['Bot-Level Admin'] : []).concat((botAdminMember.permissions?.toArray() || []).filter(p => dangerous.includes(p)));
  const isVerified = botAdminMember.user.flags?.has(Discord.UserFlags.VerifiedBot);
  const risk = dangerousPerms.length > 1 ? '🚨 Élevé' : isVerified ? '⚠️ Moyen' : '🔴 Critique';
  return container(txt(`## 🔍 ${botAdminMember.user.tag}`), sep(), txt([`**ID :** ${botAdminMember.user.id}`, `**Vérifié :** ${isVerified ? 'Oui' : 'Non'}`, `**Niveau de risque :** ${risk}`, `**Ajouté :** <t:${Math.floor(botAdminMember.joinedTimestamp / 1000)}:F>`, `**Permissions dangereuses :** ${dangerousPerms.join(', ') || 'Aucune'}`].join('\n')));
}

module.exports.getBotAdminSecurityDetails = getBotAdminSecurityDetails;
module.exports.showBotAdminList = showBotAdminList;
