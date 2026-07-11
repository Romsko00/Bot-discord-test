const { container, txt, sep, reply } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'perms',
  description: 'Affiche la liste des rôles et membres ayant des permissions',
  category: 'permissions',
  level: 0,
  run: async (client, message) => {
    const permissions = db.all().filter(d => d.ID.startsWith(`permlevel_${message.guild.id}_`));

    const levelNames = {
      1: '🟢 Membre',
      2: '🔵 Modérateur',
      3: '🟣 Modérateur+',
      4: '🟠 Admin',
      5: '🔴 Manager',
      6: '⭐ Owner',
    };

    if (!permissions.length) {
      return reply(message, container(
        txt(`## 📋 Permissions — ${message.guild.name}`),
        sep(),
        txt('Aucun niveau de permission configuré.\n*Utilisez `+perm set` pour configurer les accès.*')
      ));
    }

    const levels = {};
    for (const perm of permissions) {
      const entityId = perm.ID.split('_')[2];
      const role   = message.guild.roles.cache.get(entityId);
      const member = role ? null : message.guild.members.cache.get(entityId);

      let label;
      if (role) {
        label = `${role.name} \`${role.id}\``;
      } else if (member) {
        label = `${member.user.username} \`${entityId}\``;
      } else {
        label = `\`${entityId}\``;
      }

      const lvl = perm.data;
      if (!levels[lvl]) levels[lvl] = [];
      levels[lvl].push(label);
    }

    const lines = Object.entries(levels)
      .sort(([a], [b]) => parseInt(b) - parseInt(a))
      .map(([lvl, entities]) => {
        const name = levelNames[lvl] || `Niveau ${lvl}`;
        return `**Niveau ${lvl} — ${name}**\n${entities.map(e => `  › ${e}`).join('\n')}`;
      });

    const ownersArray = Array.isArray(client.config?.owners) ? client.config.owners : [];
    const ownerMdEntries = db.all().filter(d => d.ID.startsWith(`ownermd_${client.user.id}`));
    if (ownersArray.length || ownerMdEntries.length) {
      const ownerLines = ownersArray.map(id => {
        const u = client.users.cache.get(id);
        return `  › ${u ? u.username : 'Inconnu'} \`${id}\``;
      });
      if (ownerMdEntries.length) ownerLines.push(`  › +${ownerMdEntries.length} temporaire(s)`);
      lines.push(`**⭐ Bot Owners**\n${ownerLines.join('\n')}`);
    }

    const totalEntities = Object.values(levels).reduce((a, v) => a + v.length, 0);

    return reply(message, container(
      txt(`## 📋 Permissions — ${message.guild.name}`),
      sep(),
      txt(`*${totalEntities} entité(s) configurée(s) sur ${Object.keys(levels).length} niveau(x)*`),
      sep(),
      txt(lines.join('\n\n'))
    ));
  }
};
