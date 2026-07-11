const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, media, reply, errorContainer, FLAGS } = require('../../utils/v2');
const axios = require('axios');

async function fetchDog() {
  const { data } = await axios.get('https://dog.ceo/api/breeds/image/random', { timeout: 8000 });
  return data?.message || null;
}

function buildRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dog_refresh').setLabel('🔄 Autre image').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('dog_close').setLabel('Fermer').setStyle(ButtonStyle.Secondary)
  );
}

module.exports = {
  name: 'dog',
  aliases: ['chien'],
  description: 'Affiche une image de chien aléatoire',
  run: async (client, message) => {
    try {
      const url = await fetchDog();
      if (!url) return reply(message, errorContainer('Pas trouvé de chien, réessaie.'));

      const row = buildRow();
      const panelMsg = await message.reply({
        components: [container(txt('## 🐶 Chien Aléatoire'), sep(), media(url)), row],
        flags: FLAGS
      });

      const timeout = setTimeout(() => panelMsg.edit({ components: [] }).catch(() => {}), 300_000);

      const collector = panelMsg.createMessageComponentCollector({
        filter: i => i.user.id === message.author.id,
        time: 300_000
      });

      collector.on('collect', async interaction => {
        if (interaction.customId === 'dog_close') {
          clearTimeout(timeout);
          collector.stop();
          return interaction.update({ components: [] });
        }
        if (interaction.customId === 'dog_refresh') {
          await interaction.deferUpdate();
          try {
            const newUrl = await fetchDog();
            if (!newUrl) return;
            await panelMsg.edit({ components: [container(txt('## 🐶 Chien Aléatoire'), sep(), media(newUrl)), row], flags: FLAGS });
          } catch {}
        }
      });

      collector.on('end', () => {
        clearTimeout(timeout);
        panelMsg.edit({ components: [] }).catch(() => {});
      });

    } catch {
      return reply(message, errorContainer('Erreur lors de la récupération de l\'image.'));
    }
  }
};
