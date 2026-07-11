const { hasPermissionLevel, AccessLevels } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

const KEY_LIST = (g) => `banip_list_${g}`;
const KEY_ENTRY = (g, ip) => `banip_${g}_${ip.replace(/\./g, '_').replace(/:/g, '_')}`;

module.exports = {
  name: 'baniplist',
  aliases: ['ipbanlist', 'listbanip'],
  description: 'Affiche la liste des IPs bannies sur ce serveur',

  run: async (client, message, args) => {
    try {
      if (!hasPermissionLevel(client, message, AccessLevels?.PERM6 || 6))
        return reply(message, errorContainer('**Permission refusée** — Niveau 6 requis.'));

      const list = db.get(KEY_LIST(message.guild.id)) || [];
      if (!list.length) return reply(message, container(txt('## 🚫 Ban IP — Liste Noire'), sep(), txt('Aucune IP bannie sur ce serveur.')));

      const page = Math.max(1, parseInt(args[0]) || 1);
      const PER_PAGE = 10;
      const totalPages = Math.ceil(list.length / PER_PAGE);
      const slice = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);

      const lines = slice.map((ip, i) => {
        const entry = db.get(KEY_ENTRY(message.guild.id, ip));
        if (!entry) return `**${(page - 1) * PER_PAGE + i + 1}.** \`${ip}\` — données manquantes`;
        return `**${(page - 1) * PER_PAGE + i + 1}.** \`${ip}\` — ${entry.username} — ${entry.reason}`;
      }).join('\n');

      return reply(message, container(
        txt(`## 🚫 Ban IP — ${list.length} entrée(s) — Page ${page}/${totalPages}`),
        sep(),
        txt(lines)
      ));
    } catch (err) {
      console.error('[baniplist]', err);
      reply(message, errorContainer('Une erreur est survenue.'));
    }
  }
};
