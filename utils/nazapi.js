const axios = require('axios');
const config = require('../config');

class NazAPI {
  constructor() {
    this.apiKey = config.APIS.NAZAPI.API_KEY;
    this.baseURL = config.APIS.NAZAPI.BASE_URL;
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async search(query, type = 'all') {
    try {
      const response = await axios.post(`${this.baseURL}/search`, {
        query: query,
        type: type,
        limit: 100
      }, {
        headers: this.headers
      });

      return response.data;
    } catch (error) {
      throw new Error(`Erreur NazAPI: ${error.response?.data?.message || error.message}`);
    }
  }

  async searchEmail(email) {
    return this.search(email, 'email');
  }

  async searchUsername(username) {
    return this.search(username, 'username');
  }

  async searchPhone(phone) {
    return this.search(phone, 'phone');
  }

  parseResults(data) {
    if (!data || !data.results || data.results.length === 0) {
      return ['Aucun résultat trouvé'];
    }

    const results = [];
    data.results.forEach((result, index) => {
      results.push(`${index + 1}. ${result.email || result.username || result.phone || 'N/A'}`);
      if (result.source) results.push(`   Source: ${result.source}`);
      if (result.date) results.push(`   Date: ${result.date}`);
      results.push('');
    });

    return results;
  }
}

module.exports = { NazAPI };
