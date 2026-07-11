const Casino = require('../../utils/casino');
const admin = require('../../utils/casinoAdmin');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'cslots',
  aliases: ['slot'],
  description: 'Machine à sous — tentez votre chance !',
  usage: '<mise>',
  category: 'casino',
  run: async (client, message, args) => {
    if (!message.guild) return;
    const userId = message.author.id;
    const guildId = message.guild.id;

    if (admin.isSuspended(guildId, userId))
      return reply(message, errorContainer('⛔ Votre accès au casino est temporairement suspendu.'));

    const rem = Casino.getCooldownRemaining(userId, 'slots');
    if (rem > 0) return reply(message, errorContainer(`⏱️ Attends encore **${Casino.formatMs(rem)}**.`));

    const MIN_BET = 20, MAX_BET = 5000;
    let bet = Math.max(MIN_BET, Math.min(MAX_BET, parseInt(args[0], 10) || MIN_BET));

    if (!Casino.hasEnoughCasino(userId, bet)) {
      const bal = Casino.getCasinoBalance(userId);
      return reply(message, errorContainer(`**Fonds insuffisants.** Solde : **${bal} JTN**\nUtilisez \`!cclaim\` pour récupérer des jetons.`));
    }

    Casino.deductCasinoCredits(userId, bet);

    const loadingMsg = await message.channel.send({
      components: [container(
        txt(`## 🎰 Machine à Sous — Mise : ${bet} JTN`),
        sep(),
        txt('🎰 **En cours...**\n`🔄 | 🔄 | 🔄`\n← SPIN →')
      )],
      flags: FLAGS
    });

    await new Promise(r => setTimeout(r, 1500));

    const grid = Casino.spinGrid();
    const result = Casino.evaluateLines(grid, bet);
    let totalWin = result.total;

    const jackpotWon = Casino.tryWinJackpot?.() || 0;
    if (jackpotWon > 0) totalWin += jackpotWon;

    if (totalWin > 0) Casino.addCasinoCredits(userId, totalWin);

    Casino.setCooldown(userId, 'slots', 5000);

    const win = totalWin > 0;
    const xpRes = Casino.grantGameXp(userId, { game: 'slots', bet, win, payout: totalWin });
    Casino.checkAndGrantAchievements?.(userId, { game: 'slots', bet, win, payout: totalWin });
    Casino.addHistory(userId, 'slots', { bet, payout: totalWin, win });
    Casino.updateDetailedStats?.(userId, { game: 'slots', bet, win, payout: totalWin });
    Casino.updateSessionStats?.(userId, { bet, payout: totalWin });

    if (win) Casino.increaseBonusStreak?.(userId);
    else Casino.resetBonusStreak?.(userId);

    const finalBal = Casino.getCasinoBalance(userId);
    const gridLines = grid.map(row => row.join(' │ ')).join('\n');

    let resultLabel, gainLabel;
    if (jackpotWon > 0) {
      resultLabel = `👑 JACKPOT ! (+${totalWin} JTN)`;
    } else if (totalWin > bet) {
      resultLabel = `✅ Récompense gagnée ! (+${totalWin - bet} JTN net)`;
    } else if (totalWin > 0) {
      resultLabel = `ℹ️ Remboursement partiel (+${totalWin} JTN)`;
    } else {
      resultLabel = `❌ Perdu (-${bet} JTN)`;
    }

    const xpNote = xpRes?.xpEarned > 0 ? `\n🆙 **+${xpRes.xpEarned} XP** ${xpRes.levelUp ? `• Niveau ${xpRes.level} atteint !` : ''}` : '';
    const streak = Casino.getBonusStreak?.(userId) || 0;

    const replayRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`slots_replay_${message.id}`).setLabel(`🔄 Rejouer (${bet} JTN)`).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`slots_close_${message.id}`).setLabel('Fermer').setStyle(ButtonStyle.Secondary)
    );

    const resultContainer = container(
      txt(`## 🎰 Machine à Sous — Mise : ${bet} JTN`),
      sep(),
      txt(`\`\`\`\n${gridLines}\n\`\`\`\n← SPIN →`),
      sep(),
      txt([
        `**${resultLabel}**${xpNote}`,
        `**Solde :** ${finalBal} JTN • **Streak :** ${streak}`
      ].join('\n'))
    );

    await loadingMsg.edit({ components: [resultContainer, replayRow], flags: FLAGS }).catch(() => {});

    const collector = loadingMsg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 30000 });

    collector.on('collect', async (i) => {
      if (i.customId === `slots_close_${message.id}`) {
        collector.stop();
        return i.update({ components: [resultContainer], flags: FLAGS }).catch(() => {});
      }
      if (i.customId === `slots_replay_${message.id}`) {
        collector.stop();
        return i.update({ components: [resultContainer], flags: FLAGS }).catch(() => {});
      }
    });

    collector.on('end', () => {
      loadingMsg.edit({ components: [resultContainer], flags: FLAGS }).catch(() => {});
    });
  }
};
