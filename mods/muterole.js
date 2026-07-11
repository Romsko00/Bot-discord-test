const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

async function getMuteRole(guild) {
  const id = db.get(`mRole_${guild.id}`);
  if (id) { const r = guild.roles.cache.get(id); if (r) return r; }
  return guild.roles.cache.find(r => ['muet', 'muted', 'mute'].includes(r.name.toLowerCase())) || null;
}

async function updateMuteRolePermissions(guild, muteRole) {
  const mutePerms = { SendMessages: false, Speak: false, AddReactions: false, SendMessagesInThreads: false, CreatePublicThreads: false, CreatePrivateThreads: false, Connect: false, SendVoiceMessages: false };
  let success = 0, failed = 0;
  for (const [, ch] of guild.channels.cache) {
    if (ch.type === 4) continue;
    try { await ch.permissionOverwrites.edit(muteRole, mutePerms, { reason: 'Config mute bot' }); success++; }
    catch { failed++; }
  }
  return { successCount: success, failedCount: failed };
}

module.exports = {
  name: 'muterole',
  aliases: ['setupmute', 'muteconfig'],
  description: 'Configuration du rôle muet',
  usage: '',

  run: async (client, message, args) => {
    try {
      const isSuperOwner = (client.config.superadmin?.includes(message.author.id)) || (client.config.owners?.includes(message.author.id)) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
      let hasPermission = isSuperOwner;
      if (!hasPermission) {
        for (const r of message.member.roles.cache.values()) {
          if (db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`)) { hasPermission = true; break; }
        }
      }
      if (!hasPermission) return reply(message, errorContainer('**Permission refusée.**'));

      let muteRole = await getMuteRole(message.guild);

      if (muteRole) {
        const status = await reply(message, container(
          txt('## 🔇 Rôle Muet Existant'),
          sep(),
          txt(`Le rôle ${muteRole} existe déjà.\nMise à jour des permissions en cours...`)
        ));

        const result = await updateMuteRolePermissions(message.guild, muteRole);

        await status.edit({
          components: [container(
            txt('## ✅ Permissions Mises à Jour'),
            sep(),
            txt([`**Rôle :** ${muteRole}`, `**Salons configurés :** ${result.successCount}`, result.failedCount > 0 ? `**Échecs :** ${result.failedCount}` : null].filter(Boolean).join('\n'))
          )],
          flags: require('../../utils/v2').FLAGS
        }).catch(() => {});
      } else {
        const status = await reply(message, container(
          txt('## ⏳ Création du Rôle Muet'),
          sep(),
          txt('Création du rôle et configuration des permissions...')
        ));

        try {
          muteRole = await message.guild.roles.create({ name: 'muet', color: '#808080', permissions: [], reason: `Création rôle mute par ${message.author.tag}` });
          const result = await updateMuteRolePermissions(message.guild, muteRole);
          db.set(`mRole_${message.guild.id}`, muteRole.id);

          await status.edit({
            components: [container(
              txt('## ✅ Rôle Muet Créé'),
              sep(),
              txt([`**Rôle :** ${muteRole} (\`${muteRole.id}\`)`, `**Salons configurés :** ${result.successCount}`, result.failedCount > 0 ? `**Échecs :** ${result.failedCount}` : null].filter(Boolean).join('\n'))
            )],
            flags: require('../../utils/v2').FLAGS
          }).catch(() => {});
        } catch (e) {
          await status.edit({
            components: [errorContainer(`Erreur lors de la création du rôle : ${e.message.slice(0, 200)}`)],
            flags: require('../../utils/v2').FLAGS
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[muterole]', err);
      reply(message, errorContainer('Une erreur critique est survenue.'));
    }
  }
};
