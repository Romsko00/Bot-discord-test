const axios = require('axios');
const config = require('../config');

class IntelXAPI {
  constructor() {
    this.apiKey = config.APIS.INTEL_X.API_KEY;
    this.baseURL = config.APIS.INTEL_X.BASE_URL;
    this.headers = {
      'x-key': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  validRequestId(requestId) {
    return requestId && requestId.length === 36;
  }

  async searchById(requestId) {
    try {
      const response = await axios.get(`${this.baseURL}/file/read`, {
        params: {
          type: 0,
          id: requestId,
          format: 0
        },
        headers: this.headers
      });
      return response.data;
    } catch (error) {
      throw new Error(`Erreur Intel-X: ${error.response?.data?.message || error.message}`);
    }
  }

  async search(term) {
    try {
      const searchData = {
        term: term,
        buckets: [],
        lookuplevel: 0,
        maxresults: 100,
        timeout: 5,
        datefrom: "",
        dateto: "",
        sort: 4,
        media: 0,
        terminate: []
      };

      const response = await axios.post(`${this.baseURL}/intelligent/search`, searchData, {
        headers: this.headers
      });

      return response.data;
    } catch (error) {
      throw new Error(`Erreur recherche Intel-X: ${error.response?.data?.message || error.message}`);
    }
  }

  async phonebooksearch(term) {
    try {
      const response = await axios.get(`${this.baseURL}/phonebook/search`, {
        params: {
          k: this.apiKey,
          term: term
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Erreur phonebook Intel-X: ${error.response?.data?.message || error.message}`);
    }
  }

  async GET_CAPABILITIES() {
    try {
      const response = await axios.get(`${this.baseURL}/file/capabilities`, {
        headers: this.headers
      });
      return response.data;
    } catch (error) {
      throw new Error(`Erreur capabilities Intel-X: ${error.response?.data?.message || error.message}`);
    }
  }

  parseResults(data) {
    if (!data || typeof data !== 'string') {
      return ['Aucune donnée trouvée'];
    }

    const lines = data.split('\n').filter((line) => line.trim());
    const results = [];

    for (const line of lines) {
      if (line.includes(':') && line.length > 10) {
        results.push(line.trim());
      }
    }

    return results.length > 0 ? results : ['Aucun résultat trouvé'];
  }
}

module.exports = { IntelXAPI };
