const { PermissionFlagsBits } = require('discord.js');
const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

function hasModPermission(client, message) {
  if (client.config.superadmin?.includes(message.author.id)) return true;
  if (client.config.owners?.includes(message.author.id)) return true;
  for (const r of message.member.roles.cache.values()) {
    if (db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`) || db.get(`modsp_${message.guild.id}_${r.id}`)) return true;
  }
  return false;
}

function isProtected(client, userId, guild) {
  if (guild.ownerId === userId) return true;
  if (client.config.superadmin?.includes(userId)) return true;
  if (client.config.owners?.includes(userId)) return true;
  if (db.get(`wlmd_${guild.id}_${userId}`) === true) return true;
  if (db.get(`ownermd_${client.user.id}_${userId}`) === true) return true;
  return false;
}

function resolveVoice(message, arg) {
  if (!arg) return null;
  const mention = message.mentions.channels.first();
  if (mention?.isVoiceBased()) return mention;
  const byId = message.guild.channels.cache.get(arg);
  if (byId?.isVoiceBased()) return byId;
  return message.guild.channels.cache.find(c => c.isVoiceBased() && c.name.toLowerCase() === arg.toLowerCase()) || null;
}

module.exports = {
  name: 'movall',
  aliases: ['moveall', 'vmoveall'],
  description: 'Déplace tous les membres de votre salon vocal vers un autre',
  usage: '<#salon_cible>',

  run: async (client, message, args, prefix) => {
    try {
      if (!hasModPermission(client, message)) return reply(message, errorContainer('**Permission refusée.**'));
      if (!message.guild.members.me.permissions.has(PermissionFlagsBits.MoveMembers)) return reply(message, errorContainer('Je n\'ai pas la permission `MoveMembers`.'));

      const source = message.member.voice.channel;
      if (!source) return reply(message, errorContainer('Vous devez être connecté à un salon vocal.'));
      if (!args[0]) return reply(message, errorContainer(`**Usage :** \`${prefix}movall #salon\``));

      const target = resolveVoice(message, args[0]);
      if (!target) return reply(message, errorContainer('Salon cible invalide ou non vocal.'));

      const perms = target.permissionsFor(message.guild.members.me);
      if (!perms?.has([PermissionFlagsBits.Connect, PermissionFlagsBits.MoveMembers]))
        return reply(message, errorContainer('Permissions insuffisantes dans le salon cible.'));

      const members = Array.from(source.members.values());
      if (!members.length) return reply(message, errorContainer('Aucun membre à déplacer.'));

      let moved = 0;
      for (const m of members) {
        if (isProtected(client, m.id, message.guild)) continue;
        if (!m.voice?.channel) continue;
        try { await m.voice.setChannel(target, `Déplacé en masse par ${message.author.tag}`); moved++; } catch (_) {}
      }

      return reply(message, container(
        txt('## 🔁 Déplacement Terminé'),
        sep(),
        txt(`**${moved}** membre(s) déplacé(s) vers ${target}.`)
      ));
    } catch (err) {
      console.error('[movall]', err);
      reply(message, errorContainer('Une erreur est survenue.'));
    }
  }
};
