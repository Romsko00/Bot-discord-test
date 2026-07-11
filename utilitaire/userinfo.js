const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'userinfo',
  aliases: ['ui', 'user', 'whois'],
  description: 'Affiche les informations détaillées d\'un membre',
  usage: '[membre]',
  level: 0,

  run: async (client, message, args) => {
    try {
      const member = message.mentions.members.first()
        || message.guild.members.cache.get(args[0])
        || message.member;
      const user = member.user;

      const joinedAt = member.joinedTimestamp;
      const createdAt = user.createdTimestamp;
      const joinAge = Math.floor((Date.now() - joinedAt) / 86400000);
      const accountAge = Math.floor((Date.now() - createdAt) / 86400000);

      const roles = member.roles.cache
        .filter(r => r.id !== message.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(r => r.toString())
        .slice(0, 10);

      const level = db.get(`guild_${message.guild.id}_level_${user.id}`) || 1;
      const xp = db.get(`guild_${message.guild.id}_xp_${user.id}`) || 0;
      const messages = db.get(`msg_${message.guild.id}_${user.id}`) || 0;
      const invites = db.get(`invites_${message.guild.id}_${user.id}`) || 0;

      const statusEmoji = { online: '🟢', idle: '🟡', dnd: '🔴', offline: '⚫' }[member.presence?.status || 'offline'];
      const statusText = { online: 'En ligne', idle: 'Absent', dnd: 'Ne pas déranger', offline: 'Hors ligne' }[member.presence?.status || 'offline'];

      const keyPerms = member.permissions.toArray()
        .filter(p => ['Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels', 'BanMembers', 'KickMembers'].includes(p))
        .map(p => ({ Administrator: 'Administrateur', ManageGuild: 'Gérer le serveur', ManageRoles: 'Gérer les rôles', ManageChannels: 'Gérer les salons', BanMembers: 'Bannir', KickMembers: 'Expulser' }[p]));

      const comps = [
        txt(`## 👤 ${user.username}${user.bot ? ' 🤖' : ''}`),
        sep(),
        txt([
          `**ID :** \`${user.id}\``,
          `**Mention :** ${user}`,
          `**Statut :** ${statusEmoji} ${statusText}`,
          `**Type :** ${user.bot ? 'Bot' : 'Utilisateur'}`
        ].join('\n')),
        sep(),
        txt([
          `**Création du compte :** <t:${Math.floor(createdAt / 1000)}:R> (${accountAge} jours)`,
          `**Arrivée sur le serveur :** <t:${Math.floor(joinedAt / 1000)}:R> (${joinAge} jours)`
        ].join('\n')),
        sep(),
        txt([
          `**Niveau :** ${level} • **XP :** ${xp}`,
          `**Messages :** ${messages} • **Invitations :** ${invites}`
        ].join('\n'))
      ];

      if (roles.length) {
        comps.push(sep());
        comps.push(txt(`**Rôles (${roles.length}) :** ${roles.join(' ')}${member.roles.cache.size > 11 ? ' *et plus...*' : ''}`));
      }

      if (keyPerms.length) {
        comps.push(sep());
        comps.push(txt(`**Permissions :** ${keyPerms.join(', ')}`));
      }

      if (member.premiumSince) {
        const boostAge = Math.floor((Date.now() - member.premiumSinceTimestamp) / 86400000);
        comps.push(sep());
        comps.push(txt(`💎 **Boost :** depuis ${boostAge} jours (<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>)`));
      }

      return reply(message, container(...comps));
    } catch (err) {
      console.error('[userinfo]', err);
      return reply(message, errorContainer('Impossible de récupérer les informations du membre.'));
    }
  }
};
