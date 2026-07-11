const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const axios = require('axios');

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = {
  name: 'trivia',
  aliases: [],
  description: 'Quiz de culture générale',
  run: async (client, message) => {
    try {
      const { data } = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple', { timeout: 8000 });
      const q = data?.results?.[0];
      if (!q) return reply(message, errorContainer('Aucune question disponible.'));
      const answers = shuffle([q.correct_answer, ...q.incorrect_answers]);
      const labels = ['A', 'B', 'C', 'D'];
      const answerLines = answers.map((a, i) => `**${labels[i]}.** ${a}`).join('\n');

      const row = new ActionRowBuilder().addComponents(
        ...answers.map((_, i) => new ButtonBuilder().setCustomId(`trivia_${i}`).setLabel(labels[i]).setStyle(ButtonStyle.Primary))
      );

      const msg = await message.channel.send({
        components: [container(txt('## 🧠 Trivia'), sep(), txt(q.question), sep(), txt(answerLines)), row],
        flags: FLAGS
      });

      const filter = i => i.user.id === message.author.id;
      try {
        const interaction = await msg.awaitMessageComponent({ filter, time: 60_000 });
        const idx = parseInt(interaction.customId.replace('trivia_', ''), 10);
        const isCorrect = answers[idx] === q.correct_answer;
        await interaction.update({
          components: [container(
            txt('## 🧠 Trivia — Résultat'),
            sep(),
            txt(q.question),
            sep(),
            txt(`**Votre réponse :** ${answers[idx]}\n${isCorrect ? '✅ Bonne réponse !' : `❌ Mauvaise ! Correct : **${q.correct_answer}**`}`)
          )],
          flags: FLAGS
        });
      } catch {
        await msg.edit({ components: [container(txt('## 🧠 Trivia — Expiré'), sep(), txt('⏱️ Temps écoulé.'))], flags: FLAGS }).catch(() => {});
      }
    } catch (e) {
      return reply(message, errorContainer('Erreur lors de la récupération de la question.'));
    }
  }
};
