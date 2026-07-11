const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db     = require('../../utils/simpledb');
const EMOJIS = require('../../utils/emojis');
const { container, txt, sep, reply, FLAGS } = require('../../utils/v2');

function toE(str) {
  if (!str) return null;
  const m = str.match(/^<(a?):([^:]+):(\d+)>$/);
  if (m) return { animated: !!m[1], name: m[2], id: m[3] };
  return str;
}

const CATEGORIES = [
  { id: 'messages', label: 'Messages', getEmoji: () => EMOJIS.NOTIF, desc: 'Membres les plus actifs en messages', getData: (guild) => db.all().filter(e => e.ID.startsWith(`msg_${guild.id}_`)).map(e => ({ userId: e.ID.replace(`msg_${guild.id}_`, ''), value: e.data || 0 })).sort((a, b) => b.value - a.value).slice(0, 10), format: (v) => `${v.toLocaleString('fr-FR')} messages` },
  { id: 'credits',  label: 'Casino',   getEmoji: () => EMOJIS.COIN,  desc: 'Membres les plus riches au casino', getData: (guild) => guild.members.cache.filter(m => !m.user.bot).map(m => m.id).map(id => ({ userId: id, value: db.get(`casino_balance_${id}`) || 0 })).filter(e => e.value > 0).sort((a, b) => b.value - a.value).slice(0, 10), format: (v) => `${v.toLocaleString('fr-FR')} crédits` },
  { id: 'xp',       label: 'XP',       getEmoji: () => EMOJIS.LEVEL, desc: "Membres avec le plus d'XP", getData: (guild) => db.all().filter(e => e.ID.startsWith(`guild_${guild.id}_xp_`)).map(e => ({ userId: e.ID.replace(`guild_${guild.id}_xp_`, ''), value: e.data || 0 })).sort((a, b) => b.value - a.value).slice(0, 10), format: (v) => `${v.toLocaleString('fr-FR')} XP` },
  { id: 'invites',  label: 'Invitations', getEmoji: () => EMOJIS.USER, desc: 'Membres ayant invité le plus', getData: (guild) => db.all().filter(e => e.ID.startsWith(`invites_${guild.id}_`)).map(e => ({ userId: e.ID.replace(`invites_${guild.id}_`, ''), value: e.data || 0 })).filter(e => e.value > 0).sort((a, b) => b.value - a.value).slice(0, 10), format: (v) => `${v} invitation${v > 1 ? 's' : ''}` },
  { id: 'vocal',    label: 'Vocal',    getEmoji: () => EMOJIS.STREAMING, desc: 'Membres avec le plus de temps vocal', getData: (guild) => db.all().filter(e => e.ID.startsWith(`vocal_time_${guild.id}_`)).map(e => ({ userId: e.ID.replace(`vocal_time_${guild.id}_`, ''), value: e.data || 0 })).filter(e => e.value > 0).sort((a, b) => b.value - a.value).slice(0, 10), format: (v) => { const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m}m`; } },
];

const MEDALS = ['🥇', '🥈', '🥉'];

function buildContainer(guild, cat, entries) {
  const lines = entries.length
    ? entries.map((e, i) => { const member = guild.members.cache.get(e.userId); const name = member?.displayName || `<@${e.userId}>`; const medal = MEDALS[i] || `\`#${i + 1}\``; return `${medal} **${name}** — ${cat.format(e.value)}`; })
    : [`${EMOJIS.INFO || 'ℹ️'} Aucun membre dans cette catégorie.`];
  return container(
    txt(`## ${cat.getEmoji()} Tableau d'honneur — ${cat.label}`),
    sep(),
    txt(cat.desc),
    sep(),
    txt(lines.join('\n'))
  );
}

function buildNavRow(currentId) {
  const row = new ActionRowBuilder();
  CATEGORIES.forEach(cat => { row.addComponents(new ButtonBuilder().setCustomId(`honor_${cat.id}`).setLabel(cat.label).setEmoji(toE(cat.getEmoji())).setStyle(cat.id === currentId ? ButtonStyle.Primary : ButtonStyle.Secondary)); });
  return row;
}

module.exports = {
  name: 'honor', aliases: ['tableau', 'classement', 'hof'],
  description: "Tableau d'honneur multi-catégories",
  run: async (client, message, args) => {
    const argId = args[0]?.toLowerCase();
    let activeCat = CATEGORIES.find(c => c.id === argId) || CATEGORIES[0];
    await message.guild.members.fetch().catch(() => {});

    const msg = await message.reply({ components: [buildContainer(message.guild, activeCat, activeCat.getData(message.guild)), buildNavRow(activeCat.id)], flags: FLAGS, allowedMentions: { repliedUser: false } });
    const col = msg.createMessageComponentCollector({ time: 300_000, filter: i => i.user.id === message.author.id });
    col.on('collect', async i => { activeCat = CATEGORIES.find(c => c.id === i.customId.replace('honor_', '')) || activeCat; await i.deferUpdate(); await msg.edit({ components: [buildContainer(message.guild, activeCat, activeCat.getData(message.guild)), buildNavRow(activeCat.id)], flags: FLAGS }).catch(() => {}); });
    col.on('end', () => msg.edit({ components: [] }).catch(() => {}));
  }
};
