const { container, txt, sep, reply } = require('../../utils/v2');

module.exports = {
  name: 'guess',
  aliases: ['devine'],
  description: 'Jeu de devinette',
  run: async (client, message) => {
    const target = Math.floor(Math.random() * 100) + 1;
    await reply(message, container(txt('## 🔢 Devine le Nombre (1-100)'), sep(), txt('Envoie ta proposition dans le chat. Tu as 60s !')));
    const filter = m => m.author.id === message.author.id && /^\d+$/.test(m.content);
    const collector = message.channel.createMessageCollector({ filter, time: 60_000 });
    collector.on('collect', m => {
      const n = parseInt(m.content, 10);
      if (n === target) { collector.stop('win'); }
      else if (n < target) m.reply('📈 Plus grand !').catch(() => {});
      else m.reply('📉 Plus petit !').catch(() => {});
    });
    collector.on('end', async (_, reason) => {
      if (reason === 'win') return reply(message, container(txt('## 🎉 Bravo !'), sep(), txt(`Le nombre était **${target}**. Bien joué !`)));
      return reply(message, container(txt('## ⏱️ Temps Écoulé'), sep(), txt(`Le nombre était **${target}**.`)));
    });
  }
};
