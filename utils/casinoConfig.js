const db = require('./simpledb');

const GUILD_CONFIG_KEY = (gid) => `casino_guild_config_${gid}`;

function getDefaultConfig() {
  return {
    autoGains: {
      text: {},
      voice: {}
    },
    jobs: {
      enabled: true,
      allowedJobs: []
    },
    shop: {
      enabled: true,
      featuredItems: []
    }
  };
}

function getGuildConfig(guildId) {
  if (!guildId) return getDefaultConfig();
  const cfg = db.get(GUILD_CONFIG_KEY(guildId));
  if (!cfg || typeof cfg !== 'object') return getDefaultConfig();
  const def = getDefaultConfig();
  return {
    autoGains: { ...def.autoGains, ...(cfg.autoGains || {}) },
    jobs: { ...def.jobs, ...(cfg.jobs || {}) },
    shop: { ...def.shop, ...(cfg.shop || {}) }
  };
}

function setGuildConfig(guildId, cfg) {
  if (!guildId || !cfg || typeof cfg !== 'object') return;
  db.set(GUILD_CONFIG_KEY(guildId), cfg);
}

function resetGuildConfig(guildId) {
  if (!guildId) return;
  const def = getDefaultConfig();
  db.set(GUILD_CONFIG_KEY(guildId), def);
  return def;
}

module.exports = {
  getGuildConfig,
  setGuildConfig,
  resetGuildConfig,
  getDefaultConfig
};
