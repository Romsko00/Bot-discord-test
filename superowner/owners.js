const { container, txt, sep, row, btn, reply, errorContainer, FLAGS, ButtonStyle } = require('../../utils/v2');
const { isBotOwner, isBuyer } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'owner',
  description: 'Commandes réservées aux propriétaires du bot',
  category: 'superowner',
  usage: '<add|remove|clear|list> [@user]',
  level: 7,
  run: async (client, message, args) => {
    if (!isBotOwner(client, message)) return reply(message, errorContainer('**Permission insuffisante** — Bot Owner requis.'));
    const prefix = client.config?.prefix || '+';
    if (!args[0]) return reply(message, errorContainer(`**Usage :** \`${prefix}owner <add|remove|clear|list> [@user]\``));
    const resolveUser = () => message.mentions.users.first() || client.users.cache.get(args[1]);

    if (args[0] === 'add') {
      if (!isBuyer(client, message)) return reply(message, errorContainer('Seuls le superadmin ou le buyer peuvent ajouter un owner.'));
      const member = resolveUser();
      if (!member) return reply(message, errorContainer('**Utilisateur introuvable.**'));
      if (db.get(`ownermd_${client.user.id}_${member.id}`)) return reply(message, errorContainer(`**${member.username}** est déjà owner.`));
      db.set(`ownermd_${client.user.id}_${member.id}`, true);
      return reply(message, container(txt('## ✅ Owner Ajouté'), sep(), txt(`**${member.username}** a été ajouté comme owner.`)));
    }

    if (args[0] === 'remove') {
      if (!isBuyer(client, message)) return reply(message, errorContainer('Seuls le superadmin ou le buyer peuvent retirer un owner.'));
      const member = resolveUser();
      if (!member) return reply(message, errorContainer('**Utilisateur introuvable.**'));
      if (!db.get(`ownermd_${client.user.id}_${member.id}`)) return reply(message, errorContainer(`**${member.username}** n'est pas owner.`));
      db.delete(`ownermd_${client.user.id}_${member.id}`);
      return reply(message, container(txt('## ✅ Owner Retiré'), sep(), txt(`**${member.username}** retiré des owners.`)));
    }

    if (args[0] === 'clear') {
      if (!isBuyer(client, message)) return reply(message, errorContainer('Seul le superadmin ou le buyer peut vider la liste.'));
      const all = db.all().filter(d => d.ID.startsWith(`ownermd_${client.user.id}`));
      all.forEach(e => db.delete(e.ID));
      return reply(message, container(txt('## ✅ Owners Vidés'), sep(), txt(`**${all.length}** owner(s) supprimés.`)));
    }

    if (args[0] === 'list') {
      const all = db.all().filter(d => d.ID.startsWith(`ownermd_${client.user.id}`));
      const totalPages = Math.max(1, Math.ceil(all.length / 10));
      let page = 1;

      const buildPage = (p) => {
        const slice = all.slice((p - 1) * 10, p * 10);
        const lines = slice.length ? slice.map((e, i) => {
          const userId = e.ID.split('_')[2], user = client.users.cache.get(userId);
          return `${(p - 1) * 10 + i + 1}. **${user ? user.tag : 'Inconnu'}** (\`${userId}\`)`;
        }).join('\n') : 'Aucun owner configuré.';
        return container(
          txt('## 📋 Liste des Owners'),
          sep(),
          txt(lines),
          sep(),
          txt(`Page ${p}/${totalPages}`),
          ...(totalPages > 1 ? [row(btn('own_prev', '‹', ButtonStyle.Primary, null, p === 1), btn('own_page', `${p}/${totalPages}`, ButtonStyle.Secondary, null, true), btn('own_next', '›', ButtonStyle.Primary, null, p === totalPages))] : [])
        );
      };

      const sent = await reply(message, buildPage(1));
      if (totalPages <= 1) return;
      const collector = sent.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300000 });
      collector.on('collect', async i => {
        if (i.customId === 'own_prev') page = Math.max(1, page - 1);
        else if (i.customId === 'own_next') page = Math.min(totalPages, page + 1);
        await i.update({ components: [buildPage(page)], flags: FLAGS });
      });
      collector.on('end', () => sent.edit({ components: [] }).catch(() => {}));
    }
  }
};
