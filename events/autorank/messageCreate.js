const db = require('../../utils/simpledb');
const { getConfig, inc, resetWindowIfNeeded, evaluateUserForAutorank, passesRequiredMessage } = require('../../utils/autorank');
const Casino = require('../../utils/casino');
const CasinoConfig = require('../../utils/casinoConfig');

module.exports = async (client, message) => {
  if (!message.guild || message.author.bot) return;
  if (!client.isCommandHandler) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  const config = getConfig(guildId);
  if (!config.enabled) return;


  const prefix = client.config.DISCORD?.PREFIX || client.config.prefix || '+';
  if (message.content.startsWith(prefix)) return;


  if (Array.isArray(config.allowedChannels) && config.allowedChannels.length > 0) {
    if (!config.allowedChannels.includes(message.channel.id)) return;
  }

  resetWindowIfNeeded(guildId, userId, config.timeWindowDays || 7);

  const content = message.content || '';
  const words = content.trim().length ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;
  const attachments = message.attachments?.size || 0;
  const links = (content.match(/https?:\/\/\S+/gi) || []).length;
  const mentions = (message.mentions?.users?.size || 0) + (message.mentions?.roles?.size || 0) + (message.mentions?.channels?.size || 0);

  let specialMessages = 0;
  if (passesRequiredMessage(config, message)) specialMessages = 1;

  inc(guildId, userId, { messages: 1, words, chars, attachments, links, mentions, specialMessages });

  try {
    await evaluateUserForAutorank(client, message.guild, message.member);
  } catch (_) {}

  try {
    const cfg = CasinoConfig.getGuildConfig(guildId);
    const chCfg = cfg.autoGains && cfg.autoGains.text ? cfg.autoGains.text[message.channel.id] : null;
    if (chCfg && chCfg.amount && chCfg.amount > 0) {
      const amount = Number(chCfg.amount) || 0;
      const cdMs = Number(chCfg.cooldownMs || 0);
      const maxPerHour = Number(chCfg.maxPerHour || 0);

      const baseKey = `casino_autogain_text_${guildId}_${userId}_${message.channel.id}`;
      if (cdMs > 0) {
        const nextAt = db.get(baseKey + '_next') || 0;
        if (Date.now() < nextAt) return;
      }

      if (maxPerHour > 0) {
        const hourData = db.get(baseKey + '_hour') || { since: Date.now(), total: 0 };
        if (Date.now() - hourData.since >= 60 * 60 * 1000) {
          hourData.since = Date.now();
          hourData.total = 0;
        }
        if (hourData.total >= maxPerHour) return;
        hourData.total += amount;
        db.set(baseKey + '_hour', hourData);
      }

      Casino.addCasinoCredits(userId, amount);
      if (cdMs > 0) {
        db.set(baseKey + '_next', Date.now() + cdMs);
      }
    }
  } catch (_) {}
};
