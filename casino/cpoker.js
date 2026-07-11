const Casino = require('../../utils/casino');
const admin = require('../../utils/casinoAdmin');
const Cards = require('../../utils/cards');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'cpoker',
  aliases: ['poker'],
  description: 'Poker Vidéo — choisis les cartes à garder et tire la suite',
  usage: '<mise>',
  category: 'casino',
  run: async (client, message, args) => {
    if (!message.guild) return;
    const userId = message.author.id;
    const guildId = message.guild.id;

    if (admin.isSuspended(guildId, userId))
      return reply(message, errorContainer('⛔ Accès casino suspendu pour le moment.'));

    const rem = Casino.getCooldownRemaining(userId, 'poker');
    if (rem > 0) return reply(message, errorContainer(`⏱️ Attends encore **${Casino.formatMs(rem)}**.`));

    const MIN_BET = 20, MAX_BET = 3000;
    let bet = Math.max(MIN_BET, Math.min(MAX_BET, parseInt(args[0], 10) || MIN_BET));

    if (!Casino.hasEnoughCasino(userId, bet)) {
      const bal = Casino.getCasinoBalance(userId);
      return reply(message, errorContainer(`**Fonds insuffisants.** Solde : **${bal} JTN**\nUtilisez \`!cclaim\` pour récupérer des jetons.`));
    }

    Casino.deductCasinoCredits(userId, bet);

    let deck = Cards.createDeck(1);
    let hand = Cards.draw(deck, 5);
    let holds = [false, false, false, false, false];

    const PAY_TABLE = [
      { name: 'Royal Flush', mult: 250, check: isRoyalFlush },
      { name: 'Straight Flush', mult: 50, check: isStraightFlush },
      { name: 'Carré (Four of a Kind)', mult: 25, check: isFourKind },
      { name: 'Full House', mult: 9, check: isFullHouse },
      { name: 'Couleur (Flush)', mult: 6, check: isFlush },
      { name: 'Suite (Straight)', mult: 4, check: isStraight },
      { name: 'Brelan', mult: 3, check: isThreeKind },
      { name: 'Double Paire', mult: 2, check: isTwoPair },
      { name: 'Paire de Valets+', mult: 1, check: isJacksOrBetter }
    ];

    const fmtCard = (c) => `${c.rank}${c.suit}`;
    const fmtHand = (h, holdFlags) =>
      h.map((c, i) => `${holdFlags?.[i] ? '**[✓]**' : '[  ]'} ${fmtCard(c)}`).join('  ');

    const buildHoldRow = () => new ActionRowBuilder().addComponents(
      ...holds.map((h, i) => new ButtonBuilder()
        .setCustomId(`pkr_hold_${i + 1}_${message.id}`)
        .setLabel(`${h ? '✓ ' : ''}Carte ${i + 1}`)
        .setStyle(h ? ButtonStyle.Success : ButtonStyle.Secondary))
    );
    const buildDrawRow = () => new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`pkr_draw_${message.id}`).setLabel('🔄 Tirer les cartes non conservées').setStyle(ButtonStyle.Primary)
    );

    const buildHoldContainer = () => container(
      txt(`## 🃏 Video Poker — Mise : ${bet} JTN`),
      sep(),
      txt(`**Votre main :**\n${fmtHand(hand, holds)}`),
      sep(),
      txt('Sélectionnez les cartes à conserver, puis cliquez **Tirer**.')
    );

    const sent = await message.channel.send({
      components: [buildHoldContainer(), buildHoldRow(), buildDrawRow()],
      flags: FLAGS
    });

    let finished = false;
    const collector = sent.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 30000 });

    collector.on('collect', async (i) => {
      if (finished) return i.deferUpdate().catch(() => {});

      if (i.customId.startsWith('pkr_hold_') && i.customId.endsWith(`_${message.id}`)) {
        const idx = parseInt(i.customId.split('_')[2], 10) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < 5) holds[idx] = !holds[idx];
        return i.update({ components: [buildHoldContainer(), buildHoldRow(), buildDrawRow()], flags: FLAGS }).catch(() => {});
      }

      if (i.customId === `pkr_draw_${message.id}`) {
        finished = true;
        for (let k = 0; k < 5; k++) {
          if (!holds[k]) hand[k] = Cards.draw(deck, 1)[0];
        }

        const result = evaluateHand(hand, PAY_TABLE);
        const mult = result?.mult || 0;
        const name = result?.name || 'Aucune combinaison';
        const gain = Math.floor(bet * mult);

        if (gain > 0) Casino.addCasinoCredits(userId, gain);
        const win = gain > 0;
        Casino.grantGameXp(userId, { game: 'poker', bet, win, payout: gain });
        Casino.addHistory(userId, 'poker', { bet, payout: gain, win, name });
        Casino.setCooldown(userId, 'poker', 6000);

        const finalBal = Casino.getCasinoBalance(userId);
        const resIcon = win ? '🏆' : '❌';

        return i.update({
          components: [container(
            txt(`## 🃏 Video Poker — Résultat`),
            sep(),
            txt(`**Votre main finale :**\n${fmtHand(hand)}`),
            sep(),
            txt([
              `**Combinaison :** ${name}`,
              `**Résultat :** ${resIcon} ${win ? `Gagné (×${mult})` : 'Aucune combinaison'}`,
              `**Gain :** ${gain > 0 ? `+${gain}` : '0'} JTN`,
              `**Solde :** ${finalBal} JTN`
            ].join('\n'))
          )],
          flags: FLAGS
        }).catch(() => {});
      }
    });

    collector.on('end', async () => {
      if (!finished) sent.edit({ components: [buildHoldContainer()], flags: FLAGS }).catch(() => {});
    });
  }
};

function rankVal(r) {
  switch (r) { case 'A': return 14; case 'K': return 13; case 'Q': return 12; case 'J': return 11; default: return parseInt(r, 10); }
}
function countsByRank(hand) { const m = new Map(); for (const c of hand) m.set(c.rank, (m.get(c.rank) || 0) + 1); return m; }
function isFlush(hand) { return new Set(hand.map(c => c.suit)).size === 1; }
function isStraight(hand) {
  const vals = hand.map(c => rankVal(c.rank)).sort((a, b) => a - b);
  const wheel = [2, 3, 4, 5, 14];
  return vals.join(',') === wheel.join(',') || vals.every((v, i, a) => i === 0 || v === a[i - 1] + 1);
}
function isStraightFlush(hand) { return isFlush(hand) && isStraight(hand); }
function isRoyalFlush(hand) {
  if (!isFlush(hand)) return false;
  const s = new Set(hand.map(c => c.rank));
  return ['10', 'J', 'Q', 'K', 'A'].every(r => s.has(r));
}
function isFourKind(hand) { for (const v of countsByRank(hand).values()) if (v === 4) return true; return false; }
function isFullHouse(hand) { const vals = Array.from(countsByRank(hand).values()).sort(); return vals.length === 2 && vals[0] === 2 && vals[1] === 3; }
function isThreeKind(hand) { for (const v of countsByRank(hand).values()) if (v === 3) return true; return false; }
function isTwoPair(hand) { let p = 0; for (const v of countsByRank(hand).values()) if (v === 2) p++; return p === 2; }
function isJacksOrBetter(hand) { for (const [r, c] of countsByRank(hand).entries()) if (c === 2 && rankVal(r) >= 11) return true; return false; }
function evaluateHand(hand, table) { for (const rule of table) if (rule.check(hand)) return rule; return null; }
