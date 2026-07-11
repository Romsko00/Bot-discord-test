const fs = require('fs');
const path = require('path');

class SimpleDB {
  constructor() {
    this.dbPath = path.join(__dirname, '..', 'data', 'database.json');
    this.data = {};
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const rawData = fs.readFileSync(this.dbPath, 'utf8');
        this.data = JSON.parse(rawData);
      }
    } catch (error) {
      console.error('Error loading database:', error);
      this.data = {};
    }
  }

  save() {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }

  get(key) {
    return this.data[key] || null;
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
    return value;
  }

  add(key, value) {
    const current = this.get(key) || 0;
    return this.set(key, current + value);
  }

  subtract(key, value) {
    const current = this.get(key) || 0;
    return this.set(key, Math.max(0, current - value));
  }

  delete(key) {
    delete this.data[key];
    this.save();
    return true;
  }

  has(key) {
    return key in this.data;
  }

  all() {
    return Object.keys(this.data).map((key) => ({
      ID: key,
      data: this.data[key]
    }));
  }
}

module.exports = new SimpleDB();
