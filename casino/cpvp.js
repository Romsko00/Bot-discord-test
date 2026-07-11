const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const { v4: uuidv4 } = require('uuid');

const pvpDuels = {};

module.exports = {
  name: 'cpvp',
  aliases: ['pvp', 'duel'],
  description: 'Défie un joueur au casino (coinflip)',
  usage: '+cpvp <@adversaire> <mise>',
  category: 'casino',
  run: async (client, message, args) => {
    const opponent = message.mentions.users.first();
    if (!opponent) return reply(message, errorContainer('Mentionne un adversaire.'));
    const bet = parseInt(args[1], 10);
    if (isNaN(bet) || bet <= 0) return reply(message, errorContainer('Mise invalide.'));
    const userId = message.author.id;
    const oppId = opponent.id;
    if (!Casino.hasEnoughCasino(userId, bet)) return reply(message, errorContainer('Fonds insuffisants.'));
    if (!Casino.hasEnoughCasino(oppId, bet)) return reply(message, errorContainer(`${opponent} n'a pas assez de fonds.`));
    Casino.deductCasinoCredits(userId, bet);
    Casino.deductCasinoCredits(oppId, bet);
    const duelId = uuidv4();
    pvpDuels[duelId] = { userId, oppId, bet, started: false };
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`pvp_flip_${duelId}`).setLabel('Lancer la pièce').setStyle(ButtonStyle.Primary)
    );
    const sent = await message.channel.send({
      components: [container(txt('## ⚔️ Duel Casino — Coinflip'), sep(), txt([`Mise commune : **${bet * 2} JTN**`, `${message.author} vs ${opponent}`].join('\n'))), row],
      flags: FLAGS
    });
    const collector = sent.createMessageComponentCollector({ time: 30000 });
    collector.on('collect', async i => {
      const duel = pvpDuels[duelId];
      if (![duel.userId, duel.oppId].includes(i.user.id)) return i.reply({ content: 'Ce duel ne te concerne pas.', ephemeral: true });
      if (duel.started) return i.reply({ content: 'Déjà lancé.', ephemeral: true });
      duel.started = true;
      const winner = Math.random() < 0.5 ? duel.userId : duel.oppId;
      Casino.addCasinoCredits(winner, duel.bet * 2);
      await i.update({ components: [container(txt('## 🏆 Résultat du Duel'), sep(), txt([`Gagnant : <@${winner}>`, `Gain : **${duel.bet * 2} JTN**`].join('\n')))], flags: FLAGS });
      delete pvpDuels[duelId];
    });
  }
};
