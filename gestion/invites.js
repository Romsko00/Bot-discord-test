const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');

module.exports = {
  name: 'invites',
  aliases: ['inv'],
  description: "Affiche le nombre d'invitations d'un membre",
  usage: '[membre]',
  level: 1,
  category: 'gestion',
  run: async (client, message, args) => {
    try {
      const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member;
      const userId = target.user.id, guildId = message.guild.id;
      const inviteCount = db.get(`invites_${guildId}_${userId}`) || 0;
      const invitedBy = db.get(`inviter_${guildId}_${userId}`);
      let inviterMember = null;
      if (invitedBy) inviterMember = await message.guild.members.fetch(invitedBy).catch(()=>null);

      const allInvites = db.all().filter(d => d.ID.startsWith(`invites_${guildId}_`)).map(d => ({ userId: d.ID.split('_')[2], count: d.data })).sort((a,b) => b.count - a.count);
      const rank = allInvites.findIndex(u => u.userId === userId) + 1;

      const rewards = db.all().filter(d => d.ID.startsWith(`inviterole_${guildId}_`)).map(d => { const p=d.ID.split('_'); return { roleId: p[2], required: parseInt(p[3]) }; }).sort((a,b) => a.required - b.required);
      const unlocked = rewards.filter(r => inviteCount >= r.required);
      const next = rewards.find(r => inviteCount < r.required);

      if (target.user.bot) return reply(message, container(txt(`## 📨 Invitations — ${target.user.username}`), sep(), txt('Les bots ne peuvent pas inviter de membres.')));

      const lines = [
        `**Invitations:** ${inviteCount.toLocaleString('fr-FR')}`,
        `**Classement:** #${rank} sur ${allInvites.length}`,
        `**Invité par:** ${invitedBy ? (inviterMember || 'Membre parti') : 'Lien direct/Découverte'}`
      ];
      if (unlocked.length) { lines.push('', `**Récompenses débloquées (${unlocked.length}):**`); unlocked.slice(-3).forEach(r => { const _rr = message.guild.roles.cache.get(r.roleId); lines.push(`• ${_rr ? `${_rr.name} (\`${r.roleId}\`)` : `~~${r.roleId}~~`} (${r.required} inv.)`); }); }
      if (next) { const _nr = message.guild.roles.cache.get(next.roleId); lines.push('', `**Prochaine récompense:**`, `• ${_nr ? `${_nr.name} (\`${next.roleId}\`)` : `~~${next.roleId}~~`} (${next.required} inv.) — encore **${next.required - inviteCount}** invitations`); }

      return reply(message, container(txt(`## 📨 Invitations — ${target.user.username}`), sep(), txt(lines.join('\n'))));
    } catch (e) { console.error('Erreur invites:', e); return reply(message, errorContainer('Impossible de récupérer les invitations.')); }
  }
};
