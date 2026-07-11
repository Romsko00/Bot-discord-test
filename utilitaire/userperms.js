const db = require('../../utils/simpledb');
const { getLevelFor } = require('../../utils/commandLevels');
const { container, txt, sep, reply, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'userperms', aliases: ['usrprms'],
  category: 'info',
  description: "Affiche les permissions et le niveau d'un utilisateur",
  run: async (client, message, args) => {
    let memberId = args[0];
    if (!memberId || !memberId.match(/\d{17,19}/)) memberId = message.author.id;
    else memberId = memberId.match(/\d{17,19}/)[0];
    const member = await message.guild.members.fetch(memberId).catch(() => null);
    if (!member) return message.channel.send('Utilisateur introuvable.');

    const userLevel = (() => {
      if ((Array.isArray(client.config.superadmin) && client.config.superadmin.includes(member.id)) || (Array.isArray(client.config.owners) && client.config.owners.includes(member.id)) || db.get(`ownermd_${client.user.id}_${member.id}`) === true) return '$';
      let highest = 0;
      for (const role of member.roles.cache.values()) { const lvl = db.get(`permlevel_${message.guild.id}_${role.id}`); if (typeof lvl === 'number' && lvl > highest) highest = lvl; }
      const uLvl = db.get(`userlevel_${message.guild.id}_${member.id}`);
      if (typeof uLvl === 'number' && uLvl > highest) highest = uLvl;
      return highest;
    })();

    let cmdInfoText = '';
    const cmdArg = args[1] ? String(args[1]).toLowerCase() : null;
    if (cmdArg) {
      const mapped = getLevelFor(cmdArg);
      let requiredLevel = mapped;
      if (requiredLevel === undefined) { const cat = { admin: 6, mods: 4 }; const cmdObj = client.commands.get(cmdArg) || client.aliases.get(cmdArg); if (cmdObj && cat[cmdObj.category]) requiredLevel = cat[cmdObj.category]; }
      cmdInfoText = `\n**Niveau requis pour \`${cmdArg}\`:** ${requiredLevel !== undefined ? requiredLevel : 'non défini'}`;
    }

    const sp = member.permissions.serialize();
    const cp = message.channel.permissionsFor(member).serialize();
    const permLines = Object.keys(sp).map(perm => {
      const sv = sp[perm] ? '✅' : '❌', ch = cp[perm] ? '✅' : '❌';
      const name = perm.split('_').map(x => x[0] + x.slice(1).toLowerCase()).join(' ');
      return `${sv} ${ch} ${name}`;
    }).join('\n');

    await reply(message, container(
      txt(`## 🔐 ${member.displayName} — Permissions`),
      sep(),
      txt(`**Niveau :** ${userLevel === '$' ? '$ (Propriétaire)' : userLevel}${cmdInfoText}\n\n📊 Serveur | # Salon\n\`\`\`${permLines.slice(0, 3800)}\`\`\``)
    ));
  }
};
