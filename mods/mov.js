const { PermissionFlagsBits } = require('discord.js');
const { hasPermissionLevel, hasTempPermission } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

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
  name: 'mov',
  aliases: ['move', 'vmove'],
  description: 'Déplace un membre vers votre salon vocal ou un salon spécifié',
  usage: '<@membre> [#salon]',

  run: async (client, message, args, prefix) => {
    try {
      if (!(hasTempPermission(message, 'mov') || hasPermissionLevel(client, message, 4)))
        return reply(message, errorContainer('**Permission refusée** — Niveau 4 requis.'));
      if (!message.guild.members.me.permissions.has(PermissionFlagsBits.MoveMembers))
        return reply(message, errorContainer('Je n\'ai pas la permission `MoveMembers`.'));

      const target = message.mentions.members.first() || (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);
      if (!target) return reply(message, errorContainer(`**Usage :** \`${prefix}mov @membre [#salon]\``));
      if (isProtected(client, target.id, message.guild)) return reply(message, errorContainer('Cet utilisateur est protégé.'));
      if (!target.voice?.channel) return reply(message, errorContainer('Le membre ciblé n\'est pas en vocal.'));

      let destChannel;
      if (args[1]) {
        destChannel = resolveVoice(message, args[1]);
        if (!destChannel) return reply(message, errorContainer('Salon cible invalide ou non vocal.'));
      } else {
        destChannel = message.member.voice.channel;
        if (!destChannel) return reply(message, errorContainer('Vous devez être en vocal pour utiliser cette commande sans salon cible.'));
      }

      const perms = destChannel.permissionsFor(message.guild.members.me);
      if (!perms?.has([PermissionFlagsBits.Connect, PermissionFlagsBits.MoveMembers]))
        return reply(message, errorContainer('Permissions insuffisantes dans le salon cible.'));

      await target.voice.setChannel(destChannel, `Déplacé par ${message.author.tag}`);

      return reply(message, container(
        txt('## 🔊 Membre Déplacé'),
        sep(),
        txt(`${target} a été déplacé vers ${destChannel}.`)
      ));
    } catch (err) {
      console.error('[mov]', err);
      reply(message, errorContainer('Une erreur est survenue lors du déplacement.'));
    }
  }
};
