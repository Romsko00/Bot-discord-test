// events.js — Système d'événements mondiaux casino
const db = require('./simpledb');

function getCurrentEvent() {
  return db.get('casino_event_current') || null;
}

function startEvent(event) {
  db.set('casino_event_current', event);
}

function endEvent() {
  db.delete('casino_event_current');
}

module.exports = {
  getCurrentEvent,
  startEvent,
  endEvent
};
