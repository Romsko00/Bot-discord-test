// market.js — Système de marché entre joueurs casino
const db = require('./simpledb');

function getOffers() {
  return db.get('casino_market_offers') || [];
}

function addOffer(offer) {
  const offers = getOffers();
  offers.push(offer);
  db.set('casino_market_offers', offers);
}

function buyOffer(buyerId, offerId) {
  const offers = getOffers();
  const offer = offers.find(o => o.id === offerId);
  if (!offer) return false;
  // Vérification fonds
  // ...
  // Transfert
  // ...
  offer.sold = true;
  db.set('casino_market_offers', offers);
  return true;
}

module.exports = {
  getOffers,
  addOffer,
  buyOffer
};
