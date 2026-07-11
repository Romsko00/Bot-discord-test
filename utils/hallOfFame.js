// hallOfFame.js — Hall of Fame casino
const db = require('./simpledb');

function getRecords() {
  return db.get('casino_hall_of_fame') || [];
}

function addRecord(record) {
  const records = getRecords();
  records.push(record);
  db.set('casino_hall_of_fame', records);
}

module.exports = {
  getRecords,
  addRecord
};
