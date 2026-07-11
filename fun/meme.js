const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const axios = require('axios');

module.exports = {
  name: 'meme',
  aliases: [],
  description: 'Affiche un meme aléatoire',
  run: async (client, message) => {
    try {
      const { data } = await axios.get('https://meme-api.com/gimme', { timeout: 8000 });
      return reply(message, container(
        txt(`## 😂 ${(data.title || 'Meme Aléatoire').slice(0, 200)}`),
        sep(),
        txt(`r/${data.subreddit}`),
        ...(data.url ? [{ type: 12, items: [{ media: { url: data.url } }] }] : [])
      ));
    } catch (e) {
      return reply(message, errorContainer('Impossible de récupérer un meme pour le moment.'));
    }
  }
};
