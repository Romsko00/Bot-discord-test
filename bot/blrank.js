const { container, txt, sep, row, btn, reply, errorContainer, FLAGS, ButtonStyle } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'blacklistrank',
  aliases: ['blrank'],
  description: 'Gère la blacklist du classement',
  category: 'bot',
  level: 7,
  run: async (client, message, args) => {
    const isOwner = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!isOwner) return reply(message, errorContainer('**Permission insuffisante.**'));
    const sub = (args[0] || '').toLowerCase();

    const resolveUser = async (arg) => {
      if (message.mentions.users.first()) return message.mentions.users.first();
      if (!arg) return null;
      return client.users.cache.get(arg) || await client.users.fetch(arg).catch(() => null);
    };

    if (sub === 'add') {
      const user = await resolveUser(args[1]);
      if (!user) return reply(message, errorContainer(`Aucun membre trouvé pour \`${args[1] || ''}\``));
      const key = `blrankmd_${client.user.id}_${user.id}`;
      if (db.get(key) === true) return reply(message, errorContainer(`**${user.username}** est déjà dans la Blacklist Rank.`));
      db.set(key, true);
      return reply(message, container(txt('## ✅ Blacklist Rank'), sep(), txt(`**${user.username}** ajouté à la Blacklist Rank.`)));
    }

    if (sub === 'remove') {
      const user = await resolveUser(args[1]);
      if (!user) return reply(message, errorContainer(`Aucun membre trouvé.`));
      const key = `blrankmd_${client.user.id}_${user.id}`;
      if (db.get(key) !== true) return reply(message, errorContainer(`**${user.username}** n'est pas dans la Blacklist Rank.`));
      db.delete(key);
      return reply(message, container(txt('## ✅ Blacklist Rank'), sep(), txt(`**${user.username}** retiré de la Blacklist Rank.`)));
    }

    if (sub === 'clear') {
      const all = db.all().filter(d => d.ID.startsWith(`blrankmd_${client.user.id}`));
      all.forEach(r => db.delete(r.ID));
      return reply(message, container(txt('## ✅ Blacklist Rank Vidée'), sep(), txt(`**${all.length}** entrée(s) supprimée(s).`)));
    }

    if (sub === 'list') {
      const list = db.all().filter(d => d.ID.startsWith(`blrankmd_${client.user.id}`));
      const ids = list.map(x => x.ID.split('_')[2]).filter(Boolean);
      const totalPages = Math.max(1, Math.ceil(ids.length / 15));
      let page = 1;

      const buildPage = (p) => {
        const slice = ids.slice((p - 1) * 15, p * 15);
        const lines = slice.map((id, i) => {
          const u = client.users.cache.get(id);
          return `${(p - 1) * 15 + i + 1}. <@${id}>${u ? ` (${u.tag})` : ''}`;
        }).join('\n');
        return container(
          txt('## 🚫 Blacklist Rank'),
          sep(),
          txt(lines || 'Aucune entrée.'),
          sep(),
          txt(`Page ${p}/${totalPages}`),
          ...(totalPages > 1 ? [row(btn('blr_prev', '‹', ButtonStyle.Primary, null, p === 1), btn('blr_page', `${p}/${totalPages}`, ButtonStyle.Secondary, null, true), btn('blr_next', '›', ButtonStyle.Primary, null, p === totalPages))] : [])
        );
      };

      const sent = await reply(message, buildPage(1));
      if (totalPages <= 1) return;
      const collector = sent.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300000 });
      collector.on('collect', async i => {
        if (i.customId === 'blr_prev') page = Math.max(1, page - 1);
        else if (i.customId === 'blr_next') page = Math.min(totalPages, page + 1);
        await i.update({ components: [buildPage(page)], flags: FLAGS });
      });
      collector.on('end', () => sent.edit({ components: [] }).catch(() => {}));
      return;
    }

    return reply(message, errorContainer('**Usage :** `!blrank add|remove|clear|list [@user]`'));
  }
};
