const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'clearwarns',
  aliases: ['clearsanctions', 'resetwarns'],
  description: 'Supprime toutes les sanctions d\'un membre',
  usage: '<@membre>',

  run: async (client, message, args) => {
    try {
      if (!hasPermissionLevel(client, message, 4))
        return reply(message, errorContainer('**Permission refusée** — Niveau 4 requis.'));
      const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
      if (!member) return reply(message, errorContainer('**Membre introuvable.**'));
      const key = `sanctions_${message.guild.id}_${member.id}`;
      const sanctions = db.get(key);
      if (!sanctions || sanctions.length === 0) return reply(message, errorContainer(`**${member.user.tag}** n'a aucune sanction enregistrée.`));
      db.delete(key);
      db.delete(`warns_${message.guild.id}_${member.id}`);
      return reply(message, container(
        txt('## 🗑️ Sanctions Supprimées'),
        sep(),
        txt(`Toutes les sanctions de **${member.user.tag}** ont été supprimées.`)
      ));
    } catch (err) {
      console.error('[clearwarns]', err);
      reply(message, errorContainer('Erreur lors de la suppression des sanctions.'));
    }
  }
};
