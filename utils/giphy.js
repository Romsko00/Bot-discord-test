const axios = require('axios');
const config = require('../config.json');

async function searchGif(query, opts = {}) {
  const apiKey = config.GIPHY_API_KEY || process.env.GIPHY_API_KEY;
  const limit = opts.limit || 25;
  const rating = opts.rating || 'pg-13';
  const lang = opts.lang || 'en';
  if (!apiKey) return null;
  try {
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=${limit}&rating=${rating}&lang=${lang}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    if (data && Array.isArray(data.data) && data.data.length > 0) {
      const item = data.data[Math.floor(Math.random() * data.data.length)];
      return item?.images?.original?.url || item?.url || null;
    }
  } catch (_) {
    return null;
  }
  return null;
}

module.exports = { searchGif };
