const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const { v4: uuidv4 } = require('uuid');

const crashGames = {};

module.exports = {
  name: 'crash',
  aliases: ['crashgame'],
  description: 'Jeu Crash : cash out avant le crash pour multiplier ta mise !',
  usage: '+crash <mise>',
  category: 'casino',
  run: async (client, message, args) => {
    const userId = message.author.id;
    let bet = parseInt(args[0], 10);
    if (isNaN(bet) || bet <= 0) return reply(message, errorContainer('Mise invalide.'));
    if (!Casino.hasEnoughCasino(userId, bet)) return reply(message, errorContainer(`Fonds insuffisants. Solde: ${Casino.getCasinoBalance(userId)} JTN`));
    Casino.deductCasinoCredits(userId, bet);
    const gameId = uuidv4();
    crashGames[gameId] = { userId, bet, multiplier: 1.0, crashed: false, cashedOut: false, start: Date.now() };
    const game = crashGames[gameId];
    let interval;
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`crash_cashout_${gameId}`).setLabel('💸 Cash Out').setStyle(ButtonStyle.Success));
    const buildMsg = () => container(txt(`## 🔥 Crash en cours !`), sep(), txt([`**Multiplicateur :** x${game.multiplier.toFixed(2)}`, `**Mise :** ${bet} JTN | Cash out avant le crash !`].join('\n')));
    const sent = await message.channel.send({ components: [buildMsg(), row], flags: FLAGS });
    const collector = sent.createMessageComponentCollector({ time: 20000 });
    collector.on('collect', async i => {
      if (i.user.id !== game.userId) return i.reply({ content: 'Ce n\'est pas ta partie !', ephemeral: true });
      if (game.cashedOut || game.crashed) return i.reply({ content: 'Partie terminée.', ephemeral: true });
      game.cashedOut = true;
      clearInterval(interval);
      const gain = Math.floor(game.bet * game.multiplier);
      Casino.addCasinoCredits(game.userId, gain);
      await i.update({ components: [container(txt('## 💸 Cash Out !'), sep(), txt([`Tu as encaissé à **x${game.multiplier.toFixed(2)}**`, `**Gain :** ${gain} JTN`].join('\n')))], flags: FLAGS });
      delete crashGames[gameId];
    });
    interval = setInterval(async () => {
      if (game.cashedOut || game.crashed) { clearInterval(interval); return; }
      game.multiplier += Math.random() * 0.2 + 0.05;
      const crashChance = Math.min(0.01 + (game.multiplier - 1) * 0.08, 0.5);
      if (Math.random() < crashChance) {
        game.crashed = true;
        await sent.edit({ components: [container(txt('## 💥 Crash !'), sep(), txt([`Le multiplicateur a explosé à **x${game.multiplier.toFixed(2)}**`, `Tu as perdu **${game.bet} JTN**`].join('\n')))], flags: FLAGS }).catch(() => {});
        clearInterval(interval);
        delete crashGames[gameId];
        return;
      }
      await sent.edit({ components: [buildMsg(), row], flags: FLAGS }).catch(() => {});
    }, 1200);
  }
};
