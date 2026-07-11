const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const admin = require('../../utils/casinoAdmin');
const db = require('../../utils/simpledb');
const config = require('../../config.json');

const QUESTIONS = {
  culture: [
    { q: 'Qui a peint La Joconde ?', opts: ['Van Gogh', 'Da Vinci', 'Picasso', 'Rembrandt'], i: 1 },
    { q: 'Capitale de l\'Australie ?', opts: ['Sydney', 'Canberra', 'Melbourne', 'Perth'], i: 1 }
  ],
  maths: [
    { q: '2^5 = ?', opts: ['16', '32', '64', '128'], i: 1 },
    { q: 'La dérivée de x^2 ?', opts: ['x', '2x', 'x^2', '2'], i: 1 }
  ],
  crypto: [
    { q: 'Créateur de Bitcoin (pseudo) ?', opts: ['Vitalik Buterin', 'Satoshi Nakamoto', 'Hal Finney', 'Nick Szabo'], i: 1 },
    { q: 'Ticker de Ethereum ?', opts: ['ETH', 'ETC', 'ETN', 'EHT'], i: 0 }
  ]
};

module.exports = {
  name: 'cquizbet',
  aliases: ['quizbet'],
  description: 'Quiz à mise — réponds vite et juste pour gagner',
  usage: '+cquizbet <mise> <catégorie: culture|maths|crypto>',
  category: 'casino',
  run: async (client, message, args) => {
    if (!message.guild) return;
    const userId = message.author.id;
    const guildId = message.guild.id;
    if (admin.isSuspended(guildId, userId)) return reply(message, errorContainer('Accès casino suspendu.'));
    const allowedCatId = db.get(`casino_category_${guildId}`);
    if (allowedCatId && (!message.channel.parentId || message.channel.parentId !== allowedCatId)) return reply(message, errorContainer('Jeux limités à la catégorie configurée.'));
    const settings = config.CASINO?.QUIZBET || { MIN_BET: 10, MAX_BET: 1000, COOLDOWN_MS: 4000 };
    const rem = Casino.getCooldownRemaining(userId, 'quizbet');
    if (rem > 0) return reply(message, errorContainer(`Attends encore ${Casino.formatMs(rem)}.`));
    let bet = parseInt(args[0], 10);
    if (isNaN(bet)) bet = settings.MIN_BET;
    bet = Math.max(settings.MIN_BET, Math.min(settings.MAX_BET, bet));
    const cat = (args[1] || '').toLowerCase();
    if (!Object.keys(QUESTIONS).includes(cat)) return reply(message, errorContainer('Catégorie invalide. Utilise: `culture`, `maths`, `crypto`'));
    if (!Casino.hasEnoughCasino(userId, bet)) return reply(message, errorContainer(`Fonds insuffisants. Solde: ${Casino.getCasinoBalance(userId)} JTN`));
    Casino.deductCasinoCredits(userId, bet);
    const pool = QUESTIONS[cat];
    const q = pool[Math.floor(Math.random() * pool.length)];
    const row = new ActionRowBuilder().addComponents(
      q.opts.map((opt, idx) => new ButtonBuilder().setCustomId(`qb_${idx}_${message.id}`).setLabel(opt).setStyle(ButtonStyle.Primary))
    );
    const msg = await message.channel.send({ components: [container(txt(`## 🧠 Quiz — ${cat}`), sep(), txt(`**${q.q}**\n\nMise: ${bet} JTN • 15s pour répondre`)), row], flags: FLAGS });
    let answered = false;
    const collector = msg.createMessageComponentCollector({ time: 15000, filter: i => i.user.id === userId });
    const finish = async (pick, interaction = null) => {
      if (answered) return;
      answered = true;
      const multMap = { culture: 1.2, maths: 1.5, crypto: 1.8 };
      const correct = pick === q.i;
      const gain = correct ? Math.floor(bet * (multMap[cat] || 1.2)) : 0;
      if (gain > 0) Casino.addCasinoCredits(userId, gain);
      Casino.setCooldown(userId, 'quizbet', settings.COOLDOWN_MS || 4000);
      try { Casino.grantGameXp(userId, { game: 'quiz', bet, win: correct, payout: gain }); } catch {}
      try { Casino.addHistory(userId, 'quizbet', { bet, payout: gain, win: correct, cat, q: q.q }); } catch {}
      const finalBal = Casino.getCasinoBalance(userId);
      const result = container(
        txt(`## 🧠 Quiz — ${correct ? '✅ Correct !' : '❌ Raté !'}`),
        sep(),
        txt([`**${q.q}**`, `Bonne réponse: **${q.opts[q.i]}**`, pick !== null ? `Ta réponse: **${q.opts[pick]}**` : 'Temps écoulé !', `Mise: ${bet} | Gain: ${gain} | Solde: ${finalBal} JTN`].join('\n'))
      );
      if (interaction) await interaction.update({ components: [result], flags: FLAGS });
      else await msg.edit({ components: [result], flags: FLAGS }).catch(() => {});
    };
    collector.on('collect', async i => { const pick = parseInt(i.customId.split('_')[1], 10); await finish(pick, i); });
    collector.on('end', async () => { if (!answered) await finish(null); });
  }
};
