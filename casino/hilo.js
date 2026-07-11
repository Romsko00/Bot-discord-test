const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const { v4: uuidv4 } = require('uuid');

const hiloGames = {};
function drawCard() { const value = Math.floor(Math.random() * 13) + 2; const suit = ['♠️', '♥️', '♦️', '♣️'][Math.floor(Math.random() * 4)]; return { value, suit }; }
function cardLabel(c) { const names = { 11: 'Valet', 12: 'Dame', 13: 'Roi', 14: 'As' }; return `${names[c.value] || c.value} ${c.suit}`; }

module.exports = {
  name: 'hilo',
  aliases: ['hilow', 'plusmoins'],
  description: 'Hi-Lo : devine si la prochaine carte est plus haute ou plus basse !',
  usage: '+hilo <mise>',
  category: 'casino',
  run: async (client, message, args) => {
    const userId = message.author.id;
    let bet = parseInt(args[0], 10);
    if (isNaN(bet) || bet <= 0) return reply(message, errorContainer('Mise invalide.'));
    if (!Casino.hasEnoughCasino(userId, bet)) return reply(message, errorContainer(`Fonds insuffisants. Solde: ${Casino.getCasinoBalance(userId)} JTN`));
    Casino.deductCasinoCredits(userId, bet);
    const gameId = uuidv4();
    hiloGames[gameId] = { userId, bet, streak: 0, multiplier: 1.0, current: drawCard(), ended: false };
    const game = hiloGames[gameId];
    const makeRow = () => new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`hilo_high_${gameId}`).setLabel('⬆️ Plus haut').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`hilo_low_${gameId}`).setLabel('⬇️ Plus bas').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`hilo_stop_${gameId}`).setLabel('🛑 Stop').setStyle(ButtonStyle.Secondary)
    );
    const buildC = (g, extra = '') => container(txt('## 🎯 Hi-Lo'), sep(), txt([`**Carte :** ${cardLabel(g.current)} | **Streak :** ${g.streak} | **x${g.multiplier.toFixed(2)}**`, `**Mise :** ${g.bet} JTN`, extra].filter(Boolean).join('\n')));
    const sent = await message.channel.send({ components: [buildC(game), makeRow()], flags: FLAGS });
    const collector = sent.createMessageComponentCollector({ time: 30000 });
    collector.on('collect', async i => {
      if (i.user.id !== game.userId) return i.reply({ content: 'Ce n\'est pas ta partie !', ephemeral: true });
      if (game.ended) return i.reply({ content: 'Partie terminée.', ephemeral: true });
      if (i.customId === `hilo_stop_${gameId}`) {
        game.ended = true;
        const gain = Math.floor(game.bet * game.multiplier);
        Casino.addCasinoCredits(game.userId, gain);
        await i.update({ components: [container(txt('## 🛑 Cash Out !'), sep(), txt([`Encaissé à **x${game.multiplier.toFixed(2)}** | **Gain : ${gain} JTN**`, `Streak final: ${game.streak}`].join('\n')))], flags: FLAGS });
        delete hiloGames[gameId]; return;
      }
      const next = drawCard();
      const guessHigh = i.customId === `hilo_high_${gameId}`;
      const win = (guessHigh && next.value > game.current.value) || (!guessHigh && next.value < game.current.value);
      if (win) {
        game.streak++;
        game.multiplier = +(game.multiplier * 1.4).toFixed(2);
        game.current = next;
        await i.update({ components: [buildC(game, `✅ Bonne pioche ! Nouvelle carte: **${cardLabel(next)}**`), makeRow()], flags: FLAGS });
      } else {
        game.ended = true;
        await i.update({ components: [container(txt('## 💀 Perdu !'), sep(), txt([`La carte était: **${cardLabel(next)}**`, `Tu as perdu ta mise. Streak final: ${game.streak}`].join('\n')))], flags: FLAGS });
        delete hiloGames[gameId];
      }
    });
    collector.on('end', () => { if (!game.ended) sent.edit({ components: [buildC(game)] }).catch(() => {}); });
  }
};
