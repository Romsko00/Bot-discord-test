const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

const choices = [
  { id: 'rock', emoji: '🪨', name: 'Pierre' },
  { id: 'paper', emoji: '📄', name: 'Feuille' },
  { id: 'scissors', emoji: '✂️', name: 'Ciseaux' }
];

function result(a, b) {
  if (a === b) return 0;
  if (a === 'rock' && b === 'scissors' || a === 'paper' && b === 'rock' || a === 'scissors' && b === 'paper') return 1;
  return -1;
}

module.exports = {
  name: 'pfc',
  aliases: ['rps'],
  description: 'Pierre Feuille Ciseaux',

  run: async (client, message) => {
    const opponent = message.mentions.users.first();
    if (!opponent) return message.reply({ components: [container(txt('**Usage :** `!pfc @adversaire`'))], flags: FLAGS });
    if (opponent.bot) return message.reply({ components: [container(txt('Tu ne peux pas défier un bot.'))], flags: FLAGS });
    if (opponent.id === message.author.id) return message.reply({ components: [container(txt('Choisis un adversaire différent de toi.'))], flags: FLAGS });

    const row = new ActionRowBuilder().addComponents(
      ...choices.map(c => new ButtonBuilder().setCustomId(`pfc_${c.id}`).setEmoji(c.emoji).setLabel(c.name).setStyle(ButtonStyle.Primary))
    );

    const msg = await message.channel.send({
      components: [container(txt('## 🪨📄✂️ Pierre-Feuille-Ciseaux'), sep(), txt(`${message.author} défie ${opponent} !\nCliquez pour choisir — **60 secondes**`)), row],
      flags: FLAGS
    });

    const picks = new Map();
    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id || i.user.id === opponent.id, time: 60000 });

    collector.on('collect', async i => {
      if (picks.has(i.user.id)) return i.reply({ content: 'Tu as déjà choisi.', ephemeral: true });
      picks.set(i.user.id, i.customId.replace('pfc_', ''));
      await i.reply({ content: `Choix enregistré : ${choices.find(c => c.id === picks.get(i.user.id)).emoji}`, ephemeral: true });
      if (picks.size === 2) collector.stop('done');
    });

    collector.on('end', async (_, reason) => {
      if (reason !== 'done') {
        return msg.edit({ components: [container(txt('## ⏱️ Temps Écoulé'), sep(), txt('Partie annulée — personne n\'a répondu à temps.'))], flags: FLAGS });
      }
      const a = picks.get(message.author.id);
      const b = picks.get(opponent.id);
      const r = result(a, b);
      const nameA = choices.find(c => c.id === a)?.emoji + ' ' + (choices.find(c => c.id === a)?.name);
      const nameB = choices.find(c => c.id === b)?.emoji + ' ' + (choices.find(c => c.id === b)?.name);
      const outcome = r === 0 ? '**Match nul !** 🤝' : r === 1 ? `**${message.author} gagne !** 🏆` : `**${opponent} gagne !** 🏆`;
      await msg.edit({ components: [container(
        txt('## 🪨📄✂️ Résultat'),
        sep(),
        txt([`${message.author} → ${nameA}`, `${opponent} → ${nameB}`, '', outcome].join('\n'))
      )], flags: FLAGS });
    });
  }
};
