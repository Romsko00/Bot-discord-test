const axios = require('axios');
const { EmbedBuilder } = require('discord.js');
const config = require('../config');

class SnusbaseAPI {
  constructor() {
    this.apiKey = config.APIS.SNUSBASE.API_KEY;
    this.baseURL = config.APIS.SNUSBASE.BASE_URL;
    this.headers = {
      'Auth': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  async searchAll(query) {
    try {
      const response = await axios.post(`${this.baseURL}/data/search`, {
        terms: [query],
        types: ["email", "username", "lastip", "hash", "password", "name"],
        wildcard: false
      }, {
        headers: this.headers
      });

      return response.data;
    } catch (error) {
      throw new Error(`Erreur Snusbase: ${error.response?.data?.message || error.message}`);
    }
  }

  async searchEmail(email) {
    try {
      const response = await axios.post(`${this.baseURL}/data/search`, {
        terms: [email],
        types: ["email"],
        wildcard: false
      }, {
        headers: this.headers
      });

      return response.data;
    } catch (error) {
      throw new Error(`Erreur recherche email: ${error.response?.data?.message || error.message}`);
    }
  }

  async searchUsername(username) {
    try {
      const response = await axios.post(`${this.baseURL}/data/search`, {
        terms: [username],
        types: ["username"],
        wildcard: false
      }, {
        headers: this.headers
      });

      return response.data;
    } catch (error) {
      throw new Error(`Erreur recherche username: ${error.response?.data?.message || error.message}`);
    }
  }

  async searchIP(ip) {
    try {
      const response = await axios.post(`${this.baseURL}/data/search`, {
        terms: [ip],
        types: ["lastip"],
        wildcard: false
      }, {
        headers: this.headers
      });

      return response.data;
    } catch (error) {
      throw new Error(`Erreur recherche IP: ${error.response?.data?.message || error.message}`);
    }
  }

  async searchHash(hash) {
    try {
      const response = await axios.post(`${this.baseURL}/data/search`, {
        terms: [hash],
        types: ["hash"],
        wildcard: false
      }, {
        headers: this.headers
      });

      return response.data;
    } catch (error) {
      throw new Error(`Erreur recherche hash: ${error.response?.data?.message || error.message}`);
    }
  }

  createPaginatedResults(data, userId) {
    if (!data || !data.results || data.results.length === 0) {
      const embed = new EmbedBuilder().
      setTitle('🔍 Résultats Snusbase').
      setDescription('Aucun résultat trouvé.').
      setColor(0xff0000);

      return { embed };
    }

    const results = data.results;
    const totalResults = results.length;
    const resultsPerPage = 10;
    const totalPages = Math.ceil(totalResults / resultsPerPage);


    const firstPageResults = results.slice(0, resultsPerPage);

    const embed = new EmbedBuilder().
    setTitle(`🔍 Résultats Snusbase (${totalResults} trouvés)`).
    setColor(config.SETTINGS.EMBED_COLOR).
    setFooter({ text: `Page 1/${totalPages}` });

    let description = '';
    firstPageResults.forEach((result, index) => {
      description += `**${index + 1}.** ${result.username || 'N/A'}\n`;
      description += `📧 Email: ${result.email || 'N/A'}\n`;
      description += `🔐 Hash: ${result.hash ? result.hash.substring(0, 20) + '...' : 'N/A'}\n`;
      description += `🌐 IP: ${result.lastip || 'N/A'}\n`;
      description += `📊 Source: ${result.database || 'N/A'}\n\n`;
    });

    embed.setDescription(description);

    if (totalPages > 1) {


    }

    return { embed };
  }
}

module.exports = { SnusbaseAPI };
