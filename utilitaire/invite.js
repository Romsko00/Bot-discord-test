const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'invites', aliases: ['invite'],
  level: 0,
  description: "Affiche les statistiques d'invitations",
  run: async (client, message, args) => {
    let targetUser = message.author, targetMember = message.member;
    if (args[0]) { const u = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null); if (u) { targetUser = u; targetMember = await message.guild.members.fetch(u.id).catch(() => null); } }
    try { await showInvitesStats(client, message, targetUser, targetMember); }
    catch (e) { console.error(e); await reply(message, errorContainer("Erreur lors de la récupération des statistiques d'invitations.")); }
  }
};

async function showInvitesStats(client, message, targetUser, targetMember) {
  const invites = db.get(`invites_${message.guild.id}_${targetUser.id}`) || 0;
  const leaves  = db.get(`leaves_${message.guild.id}_${targetUser.id}`) || 0;
  const regular = db.get(`Regular_${message.guild.id}_${targetUser.id}`) || 0;
  const fake    = db.get(`fake_${message.guild.id}_${targetUser.id}`) || 0;
  const net = regular - leaves;
  const successRate = regular > 0 ? Math.round(regular / (regular + leaves + fake) * 100) : 0;
  const allInvites = await getAllInvites(message.guild.id);
  const rank = getRank(allInvites, targetUser.id);
  const lines = [
    `**Total :** ${invites} invitation(s)`,
    `**Net :** ${net} invitation(s)`,
    `**Rejoints :** ${regular}`,
    `**Départs :** ${leaves}`,
    `**Suspects :** ${fake}`,
    `**Taux de réussite :** ${successRate}%`,
    `**Classement :** ${rank > 0 ? `#${rank}` : 'Non classé'}`,
    rank <= 10 && rank > 0 ? '\n⭐ Dans le top 10 des inviteurs !' : '',
  ].filter(Boolean);
  await reply(message, container(txt(`## 📊 Invitations de ${targetUser.username}`), sep(), txt(lines.join('\n'))));
}

async function getAllInvites(guildId) {
  try { return db.all().filter(e => typeof e?.ID === 'string' && e.ID.startsWith(`invites_${guildId}_`)).map(e => ({ userId: e.ID.replace(`invites_${guildId}_`, ''), invites: e.data || 0 })).sort((a, b) => b.invites - a.invites); }
  catch { return []; }
}
function getRank(inviteData, userId) { const i = inviteData.findIndex(d => d.userId === userId); return i !== -1 ? i + 1 : 0; }

async function addInvite(client, guildId, userId, type = 'regular') {
  try { db.set(`invites_${guildId}_${userId}`, (db.get(`invites_${guildId}_${userId}`) || 0) + 1); db.set(`${type}_${guildId}_${userId}`, (db.get(`${type}_${guildId}_${userId}`) || 0) + 1); return true; }
  catch { return false; }
}
async function getUserInviteStats(guildId, userId) { return { total: db.get(`invites_${guildId}_${userId}`) || 0, regular: db.get(`Regular_${guildId}_${userId}`) || 0, leaves: db.get(`leaves_${guildId}_${userId}`) || 0, fake: db.get(`fake_${guildId}_${userId}`) || 0, net: (db.get(`Regular_${guildId}_${userId}`) || 0) - (db.get(`leaves_${guildId}_${userId}`) || 0) }; }
async function getInviteLeaderboard(guildId, limit = 10) { return (await getAllInvites(guildId)).slice(0, limit); }

module.exports.addInvite = addInvite;
module.exports.getUserInviteStats = getUserInviteStats;
module.exports.getInviteLeaderboard = getInviteLeaderboard;
module.exports.showInvitesStats = showInvitesStats;
