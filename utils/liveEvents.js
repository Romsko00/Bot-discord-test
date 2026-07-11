// liveEvents.js — Système d'événements live casino
const db = require('./simpledb');

function getLiveEvent() {
  return db.get('casino_live_event') || null;
}

function startLiveEvent(event) {
  db.set('casino_live_event', event);
}

function endLiveEvent() {
  db.delete('casino_live_event');
}

module.exports = {
  getLiveEvent,
  startLiveEvent,
  endLiveEvent
};
