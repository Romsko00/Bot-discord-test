const config = require('../config.json');

function get(game, client) {
  const fromClient = client && client.config && client.config.APIS && client.config.APIS.GIPHY && client.config.APIS.GIPHY.GIFS && client.config.APIS.GIPHY.GIFS[game];
  const fromConfig = config && config.APIS && config.APIS.GIPHY && config.APIS.GIPHY.GIFS && config.APIS.GIPHY.GIFS[game];
  return fromClient || fromConfig || null;
}

module.exports = { get };
