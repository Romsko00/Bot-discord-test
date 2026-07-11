const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');

function similarity(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  if (b.includes(a) || a.includes(b)) return 0.95;
  function trigrams(str) {
    const set = new Set(), p = `  ${str}  `;
    for (let i = 0; i < p.length - 2; i++) set.add(p.slice(i, i + 3));
    return set;
  }
  const ta = trigrams(a), tb = trigrams(b);
  let intersect = 0;
  for (const t of ta) if (tb.has(t)) intersect++;
  return (2.0 * intersect) / (ta.size + tb.size);
}

function scoreCommand(cmd, query) {
  const q = query.toLowerCase();
  if (cmd.name === q) return 1;
  const scores = [similarity(q, cmd.name)];
  if (Array.isArray(cmd.aliases)) cmd.aliases.forEach(a => scores.push(similarity(q, a) * 0.9));
  if (cmd.description) {
    cmd.description.toLowerCase().split(/\s+/).forEach(w => { if (w.length >= 3) scores.push(similarity(q, w) * 0.7); });
    scores.push(similarity(q, cmd.description.toLowerCase()) * 0.6);
  }
  return Math.max(...scores);
}

module.exports = {
  name: 'search',
  aliases: ['find', 'searchcmd', 'recherche'],
  description: 'Rechercher une commande par mot-clé',
  usage: '<mot-clé>',
  category: 'general',
  level: 0,
  run: async (client, message, args, prefix) => {
    const query = args.join(' ').trim();
    if (!query) return reply(message, errorContainer(`**Usage :** \`${prefix || '!'}search <mot-clé>\``));

    const seen = new Set(), commands = [];
    for (const cmd of client.commands.values()) {
      if (seen.has(cmd.name)) continue;
      seen.add(cmd.name); commands.push(cmd);
    }

    const THRESHOLD = 0.4;
    const results = commands
      .map(cmd => ({ cmd, score: scoreCommand(cmd, query) }))
      .filter(r => r.score >= THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (!results.length) return reply(message, container(txt('## 🔍 Recherche'), sep(), txt(`Aucune commande trouvée pour **"${query}"**.`)));

    const p = prefix || '!';
    const lines = results.map(({ cmd, score }, idx) => {
      const pct = Math.round(score * 100);
      const aliasStr = Array.isArray(cmd.aliases) && cmd.aliases.length ? `\`${cmd.aliases.join('`, `')}\`` : null;
      const parts = [`**${idx + 1}.** **\`${p}${cmd.name}\`** *(${pct}% de similarité)*`];
      if (aliasStr) parts.push(`↳ Alias: ${aliasStr}`);
      if (cmd.description) parts.push(`↳ ${cmd.description}`);
      return parts.join('\n');
    }).join('\n\n');

    return reply(message, container(
      txt(`## 🔍 Résultats pour "${query}"`),
      sep(),
      txt(lines)
    ));
  }
};
