const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'checkalts',
  aliases: ['alts', 'altdetect'],
  description: 'Détection des comptes alternatifs',
  usage: '[jours] [@utilisateur]',

  run: async (client, message, args) => {
    let perm = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!perm) message.member.roles.cache.forEach(r => { if (db.get(`modsp_${message.guild.id}_${r.id}`) || db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
    if (!perm) return reply(message, errorContainer('**Permission refusée.**'));

    const daysThreshold = parseInt(args[0]) || 7;
    const targetMember = message.mentions.members.first();

    if (targetMember) {
      const accountAge = Date.now() - targetMember.user.createdTimestamp;
      const daysOld = Math.floor(accountAge / 86400000);
      const daysSinceJoin = Math.floor((Date.now() - targetMember.joinedTimestamp) / 86400000);
      const suspicious = daysOld <= daysThreshold;

      return reply(message, container(
        txt(`## ${suspicious ? '🚨 Compte Suspect' : '✅ Compte Normal'} — Vérification`),
        sep(),
        txt([
          `**Membre :** ${targetMember.user.tag}`,
          `**Âge du compte :** ${daysOld} jours`,
          `**Statut :** ${suspicious ? '🚨 SUSPICIEUX' : '✅ NORMAL'}`,
          `**Rejoint il y a :** ${daysSinceJoin} jours`,
          `**Créé le :** <t:${Math.floor(targetMember.user.createdTimestamp / 1000)}:D>`,
          `**Seuil :** ${daysThreshold} jours`
        ].join('\n'))
      ));
    }

    await reply(message, container(txt('## 🔍 Scan des Comptes Récents...'), sep(), txt(`Seuil : **${daysThreshold} jours** — recherche en cours...`)));

    const members = await message.guild.members.fetch();
    const suspicious = [];
    members.forEach(m => {
      if (m.user.bot) return;
      const daysOld = Math.floor((Date.now() - m.user.createdTimestamp) / 86400000);
      if (daysOld <= daysThreshold) suspicious.push({ member: m, daysOld, joinedDays: Math.floor((Date.now() - m.joinedTimestamp) / 86400000) });
    });
    suspicious.sort((a, b) => a.daysOld - b.daysOld);

    if (!suspicious.length) return message.channel.send({ components: [container(txt('## ✅ Aucun Compte Suspect'), sep(), txt(`Aucun compte de moins de **${daysThreshold} jours** trouvé.`))], flags: require('../../utils/v2').FLAGS });

    const CHUNK = 10;
    for (let i = 0; i < suspicious.length; i += CHUNK) {
      const chunk = suspicious.slice(i, i + CHUNK);
      const page = Math.floor(i / CHUNK) + 1;
      const total = Math.ceil(suspicious.length / CHUNK);
      const lines = chunk.map(acc => `• **${acc.member.user.tag}** — ${acc.daysOld}j de compte, rejoint il y a ${acc.joinedDays}j`).join('\n');
      await message.channel.send({ components: [container(
        txt(`## 🚨 Comptes Suspects — ${suspicious.length} total (Page ${page}/${total})`),
        sep(),
        txt(lines)
      )], flags: require('../../utils/v2').FLAGS });
    }
  }
};
