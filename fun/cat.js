const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, media, reply, errorContainer, FLAGS } = require('../../utils/v2');
const axios = require('axios');

async function fetchCat() {
  const { data } = await axios.get('https://api.thecatapi.com/v1/images/search', { timeout: 8000 });
  return data?.[0]?.url || null;
}

function buildRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cat_refresh').setLabel('🔄 Autre image').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('cat_close').setLabel('Fermer').setStyle(ButtonStyle.Secondary)
  );
}

module.exports = {
  name: 'cat',
  aliases: ['chat'],
  description: 'Affiche une image de chat aléatoire',
  run: async (client, message) => {
    try {
      const url = await fetchCat();
      if (!url) return reply(message, errorContainer('Pas trouvé de chat, réessaie.'));

      const row = buildRow();
      const panelMsg = await message.reply({
        components: [container(txt('## 🐱 Chat Aléatoire'), sep(), media(url)), row],
        flags: FLAGS
      });

      const timeout = setTimeout(() => panelMsg.edit({ components: [] }).catch(() => {}), 300_000);

      const collector = panelMsg.createMessageComponentCollector({
        filter: i => i.user.id === message.author.id,
        time: 300_000
      });

      collector.on('collect', async interaction => {
        if (interaction.customId === 'cat_close') {
          clearTimeout(timeout);
          collector.stop();
          return interaction.update({ components: [] });
        }
        if (interaction.customId === 'cat_refresh') {
          await interaction.deferUpdate();
          try {
            const newUrl = await fetchCat();
            if (!newUrl) return;
            await panelMsg.edit({ components: [container(txt('## 🐱 Chat Aléatoire'), sep(), media(newUrl)), row], flags: FLAGS });
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
