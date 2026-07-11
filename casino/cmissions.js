const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');
const Casino = require('../../utils/casino');

function todayKey() { const d = new Date(); return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`; }
function ensureMissions(guildId) {
  const key = `casino_missions_${guildId}_${todayKey()}`;
  let defs = db.get(key);
  if (!defs) {
    defs = [
      { id: 'play_roulette_3', title: 'Joue 3 fois à la roulette (cwheel)', type: 'plays', game: 'wheel', need: 3, reward: { chips: 500, xp: 100 } },
      { id: 'win_1000_any', title: 'Gagne un gain ≥ 1000 sur un jeu', type: 'bigwin', amount: 1000, reward: { chips: 800, ticket: 1 } },
      { id: 'play_5_any', title: 'Joue 5 parties (n\'importe quel jeu)', type: 'plays_any', need: 5, reward: { xp: 200 } }
    ];
    db.set(key, defs);
  }
  return { key, defs };
}
function getUserClaimsKey(userId) { return `casino_missions_claims_${userId}_${todayKey()}`; }
function progressFromHistory(userId) {
  const games = ['wheel', 'plinko', 'slotsplus', 'poker', 'quizbet', 'mines', 'doors'];
  let playsAny = 0, playsWheel = 0, hasBigWin = false;
  for (const g of games) {
    const list = Casino.getHistory(userId, g, 20) || [];
    playsAny += list.length;
    if (g === 'wheel') playsWheel += list.length;
    if (!hasBigWin) hasBigWin = list.some(e => Number(e.payout || 0) >= 1000);
  }
  return { playsAny, playsWheel, hasBigWin };
}

module.exports = {
  name: 'cmissions',
  aliases: ['missions', 'casino-missions'],
  description: 'Missions quotidiennes — consulte et récupère tes récompenses',
  usage: '+cmissions',
  category: 'casino',
  run: async (client, message) => {
    if (!message.guild) return;
    const guildId = message.guild.id, userId = message.author.id;
    const { key, defs } = ensureMissions(guildId);
    const claimsKey = getUserClaimsKey(userId);
    const claimed = db.get(claimsKey) || {};
    const prog = progressFromHistory(userId);

    const isReady = def => (def.type === 'plays' && prog.playsWheel >= def.need) || (def.type === 'plays_any' && prog.playsAny >= def.need) || (def.type === 'bigwin' && prog.hasBigWin);

    const missionLines = defs.map(def => {
      const done = isReady(def), claimedAlready = !!claimed[def.id];
      const status = claimedAlready ? '✅ Réclamé' : done ? '🟡 Prêt' : '⏳ En cours';
      const rew = [def.reward.chips && `${def.reward.chips} jetons`, def.reward.xp && `${def.reward.xp} XP`, def.reward.ticket && `${def.reward.ticket} ticket`].filter(Boolean).join(', ');
      return `• **${def.title}** — ${status}\n  Récompense: ${rew}`;
    }).join('\n\n');

    const buttons = defs.map(def => {
      const ready = isReady(def), already = !!claimed[def.id];
      return new ButtonBuilder().setCustomId(`ms_${def.id}_${message.id}`).setLabel(already ? 'Réclamé' : 'Réclamer').setStyle(already ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(!ready || already);
    });

    const row = new ActionRowBuilder().addComponents(buttons);
    const msg = await message.channel.send({ components: [container(txt('## 🎯 Missions du Jour'), sep(), txt(`${missionLines}\n\n*Date: ${todayKey()}*`)), row], flags: FLAGS });

    const collector = msg.createMessageComponentCollector({ time: 30000 });
    collector.on('collect', async i => {
      if (i.user.id !== userId) return i.reply({ content: 'Cette interface est réservée au joueur.', ephemeral: true });
      try {
        if (!i.customId.endsWith(`_${message.id}`)) return i.deferUpdate().catch(() => {});
        const defId = i.customId.split('_')[1];
        const freshClaimed = db.get(claimsKey) || {};
        if (freshClaimed[defId]) return i.deferUpdate().catch(() => {});
        const prog2 = progressFromHistory(userId);
        const def = defs.find(d => d.id === defId);
        const can = isReady(def);
        if (!can) return i.deferUpdate().catch(() => {});
        const r = def.reward || {};
        if (r.chips) Casino.addCasinoCredits(userId, r.chips);
        if (r.xp) Casino.addXp(userId, r.xp);
        if (r.ticket) db.add(`casino_loot_${userId}`, r.ticket);
        freshClaimed[defId] = true;
        db.set(claimsKey, freshClaimed);
        await i.update({ components: [container(txt('## 🎯 Missions du Jour'), sep(), txt('✅ Récompense réclamée ! Relance la commande pour voir l\'état mis à jour.'))], flags: FLAGS });
      } catch { try { await i.deferUpdate(); } catch {} }
    });
    collector.on('end', () => msg.edit({ components: [container(txt('## 🎯 Missions du Jour'), sep(), txt(missionLines))], flags: FLAGS }).catch(() => {}));
  }
};
