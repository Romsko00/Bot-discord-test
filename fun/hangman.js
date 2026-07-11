const { container, txt, sep, reply, FLAGS } = require('../../utils/v2');

const words = ["discord","bot","javascript","programmation","serveur","moderation","fun","jeu","ordinateur","internet"];

module.exports = {
  name: 'hangman',
  aliases: ['pendu'],
  description: 'Joue au pendu.',
  category: 'fun',
  run: async (client, message, args) => {
    const word = words[Math.floor(Math.random() * words.length)].toUpperCase();
    let guessed = [], lives = 6, display = Array(word.length).fill('_');

    const buildMsg = (status = '') => container(
      txt('## 🪢 Pendu'),
      sep(),
      txt([`Mot : \`${display.join(' ')}\``, `Vies : ${lives}/6 ${'❤️'.repeat(lives)}`, guessed.length ? `Lettres : ${guessed.join(', ')}` : '', status].filter(Boolean).join('\n'))
    );

    const msg = await message.channel.send({ components: [buildMsg()], flags: FLAGS });
    const filter = m => m.author.id === message.author.id && m.content.length === 1 && /^[a-zA-Z]$/.test(m.content);
    const collector = message.channel.createMessageCollector({ filter, time: 60000 });

    collector.on('collect', async m => {
      m.delete().catch(() => {});
      const letter = m.content.toUpperCase();
      if (guessed.includes(letter)) return;
      guessed.push(letter);
      if (word.includes(letter)) for (let i = 0; i < word.length; i++) if (word[i] === letter) display[i] = letter;
      else lives--;
      if (!display.includes('_')) { await msg.edit({ components: [buildMsg('🏆 Gagné !')], flags: FLAGS }); return collector.stop(); }
      if (lives <= 0) { display = word.split(''); await msg.edit({ components: [buildMsg('💀 Perdu !')], flags: FLAGS }); return collector.stop(); }
      await msg.edit({ components: [buildMsg()], flags: FLAGS }).catch(() => {});
    });
  }
};
