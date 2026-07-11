const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/simpledb');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { container, txt, sep, media, reply, errorContainer, FLAGS } = require('../../utils/v2');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'your-api-key-here');

const IMAGE_SOURCES = [
  { name: 'Unsplash', search: searchUnsplashImage, priority: 1 },
  { name: 'Google',   search: searchGoogleImage,   priority: 2 },
  { name: 'Gemini',   search: searchWithGemini,    priority: 3 },
  { name: 'Fallback', search: searchWithPublicApi, priority: 4 },
];

function calculateEstimatedTime(ping) {
  if (ping >= 600) return 12; if (ping >= 300) return 8;
  if (ping >= 200) return 5;  if (ping >= 100) return 3;
  return 2;
}

function buildRow(url) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('image_next').setLabel('🔄 Suivant').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setURL(url).setLabel('📋 Ouvrir le lien').setStyle(ButtonStyle.Link),
    new ButtonBuilder().setCustomId('image_close').setLabel('Fermer').setStyle(ButtonStyle.Secondary),
  );
}

module.exports = {
  name: 'image', aliases: ['img', 'rechercheimage', 'searchimage'],
  level: 0, description: 'Recherche et affiche une image.',
  run: async (client, message, args) => {
    let hasPermission = false;
    for (const role of message.member.roles.cache.values()) {
      if (db.get(`modsp_${message.guild.id}_${role.id}`) || db.get(`ownerp_${message.guild.id}_${role.id}`) || db.get(`admin_${message.guild.id}_${role.id}`)) {
        hasPermission = true; break;
      }
    }
    const allowed = client.config?.owner?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) || hasPermission || db.get(`channelpublic_${message.guild.id}_${message.channel.id}`);
    if (!allowed) return reply(message, errorContainer('Permission refusée.'));
    const query = args.join(' ').trim();
    if (!query || query.length < 2) return reply(message, errorContainer("Veuillez spécifier une recherche d'au moins 2 caractères."));
    if (query.length > 100) return reply(message, errorContainer('La recherche ne peut pas dépasser 100 caractères.'));

    const totalTime = (calculateEstimatedTime(client.ws.ping) + (Math.random() * 1 + 0.5)).toFixed(0);
    const loadingMsg = await message.reply({
      content: `🔍 Recherche d'image pour "${query}"... (Temps estimé: ${totalTime}s)`,
      allowedMentions: { repliedUser: false }
    }).catch(() => null);
    if (!loadingMsg) return;

    try {
      const imageResult = await searchImageWithFallbacks(query);
      if (!imageResult?.url) {
        return loadingMsg.edit({
          content: '',
          components: [container(txt('## ❌ Aucun résultat'), sep(), txt(`Aucune image trouvée pour "${query}".`))],
          flags: FLAGS
        }).catch(() => {});
      }

      await loadingMsg.edit({
        content: '',
        components: [
          container(txt(`## 🔍 Recherche : "${query}"`), sep(), media(imageResult.url), sep(), txt(`**Source :** ${imageResult.source}`)),
          buildRow(imageResult.url)
        ],
        flags: FLAGS
      }).catch(() => {});

      const timeout = setTimeout(() => loadingMsg.edit({ components: [] }).catch(() => {}), 300_000);

      const collector = loadingMsg.createMessageComponentCollector({
        filter: i => i.user.id === message.author.id,
        time: 300_000
      });

      collector.on('collect', async interaction => {
        if (interaction.customId === 'image_close') {
          clearTimeout(timeout);
          collector.stop();
          return interaction.update({ components: [] });
        }
        if (interaction.customId === 'image_next') {
          await interaction.deferUpdate();
          try {
            const newResult = await searchImageWithFallbacks(query);
            if (!newResult?.url) return;
            await loadingMsg.edit({
              components: [
                container(txt(`## 🔍 Recherche : "${query}"`), sep(), media(newResult.url), sep(), txt(`**Source :** ${newResult.source}`)),
                buildRow(newResult.url)
              ],
              flags: FLAGS
            }).catch(() => {});
          } catch {}
        }
      });

      collector.on('end', () => {
        clearTimeout(timeout);
        loadingMsg.edit({ components: [] }).catch(() => {});
      });

    } catch (e) {
      console.error(e);
      loadingMsg.edit({
        content: '',
        components: [container(txt('## ❌ Erreur de recherche'), sep(), txt('Une erreur est survenue. Veuillez réessayer.'))],
        flags: FLAGS
      }).catch(() => {});
    }
  }
};

async function searchUnsplashImage(query) {
  try { const key = process.env.UNSPLASH_ACCESS_KEY; if (!key || key === 'your-unsplash-access-key') return null; const r = await axios.get('https://api.unsplash.com/search/photos', { params: { query, per_page: 1, orientation: 'landscape' }, headers: { 'Authorization': `Client-ID ${key}` }, timeout: 10000 }); return r.data.results?.[0] ? { url: r.data.results[0].urls.regular, source: 'Unsplash' } : null; }
  catch (e) { console.error('Unsplash:', e.message); return null; }
}
async function searchGoogleImage(query) {
  try { const key = process.env.GOOGLE_API_KEY, cx = process.env.GOOGLE_CSE_ID; if (!key || !cx || key === 'your-google-api-key') return null; const r = await axios.get('https://www.googleapis.com/customsearch/v1', { params: { q: query, key, cx, searchType: 'image', num: 1, safe: 'active' }, timeout: 10000 }); return r.data.items?.[0] ? { url: r.data.items[0].link, source: 'Google' } : null; }
  catch (e) { console.error('Google:', e.message); return null; }
}
async function searchWithGemini(query) {
  try { const key = process.env.GEMINI_API_KEY; if (!key || key === 'your-api-key-here') return null; const model = genAI.getGenerativeModel({ model: 'gemini-pro' }); const result = await model.generateContent(`Trouve une URL d'image pertinente pour: ${query}. Réponds uniquement avec l'URL directe.`); const text = (await result.response).text().trim(); return (text.startsWith('http') && /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(text)) ? { url: text, source: 'Gemini AI' } : null; }
  catch (e) { console.error('Gemini:', e.message); return null; }
}
async function searchWithPublicApi(query) {
  try { const r1 = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`, { headers: { 'Authorization': process.env.PEXELS_API_KEY || '' }, timeout: 5000 }); if (r1.data.photos?.[0]) return { url: r1.data.photos[0].src.medium, source: 'Pexels' }; const r2 = await axios.get(`https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY || ''}&q=${encodeURIComponent(query)}&per_page=1`, { timeout: 5000 }); return r2.data.hits?.[0] ? { url: r2.data.hits[0].webformatURL, source: 'Pixabay' } : null; }
  catch (e) { console.error('Fallback:', e.message); return null; }
}
async function searchImageWithFallbacks(query) { for (const src of [...IMAGE_SOURCES].sort((a, b) => a.priority - b.priority)) { try { const r = await src.search(query); if (r) return r; } catch {} } return null; }

module.exports.searchUnsplashImage = searchUnsplashImage;
module.exports.searchGoogleImage = searchGoogleImage;
module.exports.searchImageWithFallbacks = searchImageWithFallbacks;
