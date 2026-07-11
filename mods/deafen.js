const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');

module.exports = {
  name: 'deafen',
  aliases: ['vdeafen'],
  description: 'Rend sourd un membre en vocal',
  usage: '<@membre> [raison]',

  run: async (client, message, args) => {
    try {
      if (!hasPermissionLevel(client, message, 3))
        return reply(message, errorContainer('**Permission refusée** — Niveau 3 requis.'));
      const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
      if (!member) return reply(message, errorContainer('**Membre introuvable.**'));
      if (!member.voice.channel) return reply(message, errorContainer('Ce membre n\'est pas dans un salon vocal.'));
      const reason = args.slice(1).join(' ') || 'Aucune raison';
      await member.voice.setDeaf(true, reason);
      const sent = await reply(message, container(
        txt('## 🔕 Deafen Appliqué'),
        sep(),
        txt(`**Membre :** ${member.user.tag}\n**Raison :** ${reason}`)
      ));
      setTimeout(() => sent?.delete?.().catch(() => {}), 6000);
    } catch (err) {
      console.error('[deafen]', err);
      reply(message, errorContainer('Impossible de deafen ce membre.'));
    }
  }
};
