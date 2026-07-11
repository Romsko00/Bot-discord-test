const Casino = require('../../utils/casino');
const admin = require('../../utils/casinoAdmin');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'cmines',
  aliases: ['mines', 'cmine'],
  description: 'Mines — évite les bombes et encaisse quand tu veux',
  usage: '<mise> <mines 1-10>',
  category: 'casino',
  run: async (client, message, args) => {
    if (!message.guild) return;
    const userId = message.author.id;
    const guildId = message.guild.id;

    if (admin.isSuspended(guildId, userId))
      return reply(message, errorContainer('⛔ Votre accès au casino est temporairement suspendu.'));

    const rem = Casino.getCooldownRemaining(userId, 'mines');
    if (rem > 0) return reply(message, errorContainer(`⏱️ Attends encore **${Casino.formatMs(rem)}**.`));

    const MIN_BET = 20, MAX_BET = 3000;
    let bet = Math.max(MIN_BET, Math.min(MAX_BET, parseInt(args[0], 10) || MIN_BET));
    let mines = parseInt(args[1], 10);
    if (isNaN(mines) || mines < 1 || mines > 10)
      return reply(message, errorContainer('**Mines invalides.** Choisissez entre 1 et 10 bombes.'));

    if (!Casino.hasEnoughCasino(userId, bet)) {
      const bal = Casino.getCasinoBalance(userId);
      return reply(message, errorContainer(`**Fonds insuffisants.** Solde : **${bal} JTN**\nUtilisez \`!cclaim\` pour récupérer des jetons.`));
    }

    Casino.deductCasinoCredits(userId, bet);

    const ROWS = 5, COLS = 5, TOTAL = ROWS * COLS;
    const mineSet = new Set();
    while (mineSet.size < mines) mineSet.add(Math.floor(Math.random() * (TOTAL - 1)));

    const picked = [];
    let finished = false;

    const potentialMult = () => {
      const safePicked = picked.length;
      const growth = 0.08 + mines * 0.02;
      return Math.max(1, Math.min(50, Math.pow(1 + growth, safePicked)));
    };

    const buildGrid = (revealAll = false, disableAll = false) => {
      const rows = [];
      for (let r = 0; r < ROWS; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < COLS; c++) {
          const idx = r * COLS + c;
          if (idx === TOTAL - 1) {
            row.addComponents(new ButtonBuilder()
              .setCustomId(`mn_cash_${message.id}`)
              .setLabel('💰 Encaisser')
              .setStyle(ButtonStyle.Success)
              .setDisabled(disableAll || revealAll || picked.length === 0));
            continue;
          }
          const isPickd = picked.includes(idx);
          const isMine = mineSet.has(idx);
          const btn = new ButtonBuilder().setCustomId(`mn_${idx}_${message.id}`);

          if (revealAll) {
            if (isMine) btn.setEmoji('💣').setStyle(ButtonStyle.Danger).setLabel('\u200b');
            else if (isPickd) btn.setEmoji('💎').setStyle(ButtonStyle.Success).setLabel('\u200b');
            else btn.setLabel('⬜').setStyle(ButtonStyle.Secondary);
            btn.setDisabled(true);
          } else {
            if (isPickd) btn.setEmoji('💎').setStyle(ButtonStyle.Success).setLabel('\u200b').setDisabled(true);
            else btn.setLabel('⬜').setStyle(ButtonStyle.Secondary).setDisabled(disableAll);
          }
          row.addComponents(btn);
        }
        rows.push(row);
      }
      return rows;
    };

    const buildInfoContainer = (phase = 'play', gain = 0) => {
      const mult = potentialMult();
      const potentialGain = Math.floor(bet * mult);
      if (phase === 'play') {
        return container(
          txt(`## 💎 Mines — Mise : ${bet} JTN • ${mines} bombe${mines > 1 ? 's' : ''}`),
          sep(),
          txt([
            `**Gems trouvées :** ${picked.length}/24 • **Mult :** ×${mult.toFixed(2)}`,
            `**Gain potentiel :** +${potentialGain} JTN`
          ].join('\n'))
        );
      }
      if (phase === 'win') {
        return container(
          txt('## 💰 Mines — Encaissé !'),
          sep(),
          txt([
            `**Gems trouvées :** ${picked.length}/24 • **Mult :** ×${mult.toFixed(2)}`,
            `**Gain :** +${gain} JTN`,
            `**Solde :** ${Casino.getCasinoBalance(userId)} JTN`
          ].join('\n'))
        );
      }
      return container(
        txt('## 💥 Mines — BOOM !'),
        sep(),
        txt([
          `**Gems trouvées :** ${picked.length}/24`,
          `**Perdu :** ${bet} JTN`,
          `**Solde :** ${Casino.getCasinoBalance(userId)} JTN`
        ].join('\n'))
      );
    };

    const infoMsg = buildInfoContainer('play');
    const sent = await message.channel.send({ components: [infoMsg, ...buildGrid()], flags: FLAGS });

    const endGame = async (win, gain, interaction = null) => {
      finished = true;
      if (gain > 0) Casino.addCasinoCredits(userId, gain);
      Casino.setCooldown(userId, 'mines', 3000);
      Casino.grantGameXp(userId, { game: 'mines', bet, win, payout: gain });
      Casino.addHistory(userId, 'mines', { bet, payout: gain, win, mines });

      const phase = win ? 'win' : 'lose';
      const upd = { components: [buildInfoContainer(phase, gain), ...buildGrid(true, true)], flags: FLAGS };
      if (interaction) return interaction.update(upd).catch(() => {});
      return sent.edit(upd).catch(() => {});
    };

    const collector = sent.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 60000 });

    collector.on('collect', async (i) => {
      if (finished) return i.deferUpdate().catch(() => {});

      if (i.customId === `mn_cash_${message.id}`) {
        const mult = potentialMult();
        const gain = Math.floor(bet * mult);
        return endGame(true, gain, i);
      }

      if (i.customId.startsWith(`mn_`) && i.customId.endsWith(`_${message.id}`)) {
        const idx = parseInt(i.customId.split('_')[1], 10);
        if (picked.includes(idx)) return i.deferUpdate().catch(() => {});
        if (mineSet.has(idx)) {
          picked.push(idx);
          return endGame(false, 0, i);
        }
        picked.push(idx);
        return i.update({ components: [buildInfoContainer('play'), ...buildGrid()], flags: FLAGS }).catch(() => {});
      }
    });

    collector.on('end', async (_, reason) => {
      if (!finished && reason === 'time') {
        const gain = picked.length > 0 ? Math.floor(bet * potentialMult()) : 0;
        if (gain > 0) Casino.addCasinoCredits(userId, gain);
        sent.edit({ components: [buildInfoContainer(gain > 0 ? 'win' : 'lose', gain), ...buildGrid(true, true)], flags: FLAGS }).catch(() => {});
      }
    });
  }
};
