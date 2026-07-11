const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { searchGif } = require('../../utils/giphy');

module.exports = {
  name: 'gif',
  aliases: [],
  description: 'Recherche un gif',
  run: async (client, message, args) => {
    const query = args?.join(' ');
    if (!query) return reply(message, errorContainer('**Usage :** `!gif <mot clé>`'));
    const gif = await searchGif(query).catch(() => null);
    if (!gif) return reply(message, errorContainer('Aucun GIF trouvé ou clé GIPHY manquante.'));
    return reply(message, container(
      txt(`## 🎞️ GIF — ${query.slice(0, 100)}`),
      sep(),
      txt(gif)
    ));
  }
};
