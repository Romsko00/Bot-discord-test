const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const Cards = require('../../utils/cards');
const db = require('../../utils/simpledb');
const config = require('../../config.json');

const STATE_KEY = (userId) => `casino_bj_${userId}`;
const BJ = { COOLDOWN_MS: 15000, MIN_BET: config.CASINO?.SLOTS?.MIN_BET || 10, MAX_BET: config.CASINO?.SLOTS?.MAX_BET || 1000 };

const saveState = (userId, state) => db.set(STATE_KEY(userId), state);
const loadState = (userId) => db.get(STATE_KEY(userId));
const clearState = (userId) => db.delete(STATE_KEY(userId));

function handValue(hand) { return Cards.handValue(hand); }
function formatHand(hand, hideFirst = false) { return Cards.toText(hand, hideFirst); }
function outcome(pv, dv) { if (pv > 21) return 'bust'; if (dv > 21) return 'dealer_bust'; if (pv > dv) return 'win'; if (pv < dv) return 'lose'; return 'push'; }

const resultInfo = (res) => ({ win: { emoji: '✅', label: 'Victoire !', win: true }, dealer_bust: { emoji: '✅', label: 'Croupier bust !', win: true }, push: { emoji: '🤝', label: 'Égalité', win: false }, lose: { emoji: '❌', label: 'Défaite', win: false }, bust: { emoji: '❌', label: 'Bust !', win: false } }[res] || { emoji: '❌', label: 'Défaite', win: false });

module.exports = {
  name: 'cblackjack',
  aliases: ['cbj', 'blackjack', '21'],
  description: 'Jouer au blackjack contre le croupier',
  usage: '+cblackjack <mise>',
  category: 'casino',
  run: async (client, message, args) => {
    const userId = message.author.id;
    if (loadState(userId)) return reply(message, errorContainer('Terminez votre partie actuelle avant d\'en commencer une nouvelle.'));
    const rem = Casino.getCooldownRemaining(userId, 'blackjack');
    if (rem > 0) return reply(message, errorContainer(`Attends encore ${Casino.formatMs(rem)}.`));
    let bet = parseInt(args[0], 10);
    if (isNaN(bet)) bet = BJ.MIN_BET;
    bet = Math.max(BJ.MIN_BET, Math.min(BJ.MAX_BET, bet));
    if (!Casino.hasEnoughCasino(userId, bet)) return reply(message, errorContainer(`Fonds insuffisants. Solde: ${Casino.getCasinoBalance(userId)} JTN`));
    Casino.deductCasinoCredits(userId, bet);
    const deck = Cards.newDeck();
    const player = [Cards.draw(deck), Cards.draw(deck)];
    const dealer = [Cards.draw(deck), Cards.draw(deck)];
    saveState(userId, { bet, player, dealer, deck, userId });
    const pv = handValue(player), dv = handValue(dealer);
    if (pv === 21) {
      clearState(userId);
      const payout = dv === 21 ? bet : Math.floor(bet * 2.5);
      Casino.addCasinoCredits(userId, payout);
      Casino.setCooldown(userId, 'blackjack', BJ.COOLDOWN_MS);
      try { Casino.grantGameXp(userId, { game: 'blackjack', bet, win: true, payout }); } catch {}
      try { Casino.addHistory(userId, 'blackjack', { bet, payout, win: true }); } catch {}
      return reply(message, container(txt(`## 🎴 Blackjack — ${dv === 21 ? '🤝 Égalité !' : '🎉 BLACKJACK !'}`), sep(), txt([`**Vos cartes :** ${formatHand(player)} (${pv})`, `**Croupier :** ${formatHand(dealer)} (${dv})`, `**Gain :** +${payout} JTN | **Solde :** ${Casino.getCasinoBalance(userId)} JTN`].join('\n'))));
    }
    const buildContainer = (state, dealerHidden = true) => {
      const s = loadState(userId) || state;
      return container(txt('## 🎴 Blackjack'), sep(), txt([`**Vos cartes :** ${formatHand(s.player)} → **${handValue(s.player)}**`, `**Croupier :** ${formatHand(s.dealer, dealerHidden)} → **${dealerHidden ? '?' : handValue(s.dealer)}**`, `**Mise :** ${s.bet} JTN`].join('\n')));
    };
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bj_hit').setLabel('🎴 Tirer').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('bj_stand').setLabel('✋ Rester').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('bj_double').setLabel('💎 Doubler').setStyle(ButtonStyle.Danger).setDisabled(!Casino.hasEnoughCasino(userId, bet))
    );
    const msg = await message.reply({ components: [buildContainer({ player, dealer, deck, bet }, true), row], flags: FLAGS });
    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 60000 });
    const endGame = async (interaction, finalPlayer, finalDealer, finalBet) => {
      const res = outcome(handValue(finalPlayer), handValue(finalDealer));
      const info = resultInfo(res);
      const payout = ['win', 'dealer_bust'].includes(res) ? finalBet * 2 : res === 'push' ? finalBet : 0;
      Casino.addCasinoCredits(userId, payout);
      clearState(userId);
      Casino.setCooldown(userId, 'blackjack', BJ.COOLDOWN_MS);
      try { Casino.grantGameXp(userId, { game: 'blackjack', bet: finalBet, win: info.win, payout }); } catch {}
      try { Casino.addHistory(userId, 'blackjack', { bet: finalBet, payout, win: info.win }); } catch {}
      const finalBal = Casino.getCasinoBalance(userId);
      const result = container(txt(`## 🎴 Blackjack — ${info.emoji} ${info.label}`), sep(), txt([`**Vos cartes :** ${formatHand(finalPlayer)} (${handValue(finalPlayer)})`, `**Croupier :** ${formatHand(finalDealer)} (${handValue(finalDealer)})`, `**Mise :** ${finalBet} | **Gain :** ${payout} | **Solde :** ${finalBal} JTN`].join('\n')));
      await interaction.update({ components: [result], flags: FLAGS });
      collector.stop();
    };
    collector.on('collect', async interaction => {
      await interaction.deferUpdate().catch(() => {});
      const s = loadState(userId);
      if (!s) { collector.stop(); return; }
      let { player, dealer, deck, bet: currentBet } = s;
      if (interaction.customId === 'bj_hit') {
        player.push(Cards.draw(deck));
        const pv = handValue(player);
        if (pv > 21) { await endGame(interaction, player, dealer, currentBet); return; }
        saveState(userId, { bet: currentBet, player, dealer, deck, userId });
        await interaction.editReply({ components: [buildContainer({ player, dealer, deck, bet: currentBet }, true), row], flags: FLAGS });
      } else if (interaction.customId === 'bj_stand') {
        let dv = handValue(dealer);
        while (dv < 17) { dealer.push(Cards.draw(deck)); dv = handValue(dealer); }
        await endGame(interaction, player, dealer, currentBet);
      } else if (interaction.customId === 'bj_double') {
        if (!Casino.hasEnoughCasino(userId, currentBet)) { await interaction.editReply({ components: [errorContainer('Fonds insuffisants pour doubler.')], flags: FLAGS }); collector.stop(); return; }
        Casino.deductCasinoCredits(userId, currentBet);
        currentBet *= 2;
        player.push(Cards.draw(deck));
        const pv = handValue(player);
        if (pv > 21) { await endGame(interaction, player, dealer, currentBet); return; }
        let dv = handValue(dealer);
        while (dv < 17) { dealer.push(Cards.draw(deck)); dv = handValue(dealer); }
        await endGame(interaction, player, dealer, currentBet);
      }
    });
    collector.on('end', (_, reason) => { if (reason === 'time') { clearState(userId); msg.edit({ components: [errorContainer('Temps écoulé — partie annulée.')], flags: FLAGS }).catch(() => {}); } });
  }
};
