const db = require('../../utils/simpledb');
const { EmbedBuilder } = require('discord.js');

// ── Per-guild config helpers ──────────────────────────────────────────────────
function getXpGain(guildId) {
  const min = db.get(`levels_xp_min_${guildId}`) ?? 5;
  const max = db.get(`levels_xp_max_${guildId}`) ?? 10;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getXpRequired(guildId, level) {
  const preset = db.get(`levels_formula_${guildId}`) || 'quadratic';
  switch (preset) {
    case 'linear':       return level * 100;
    case 'progressive':  return level * 50 + level * level * 5;
    case 'hard':         return level * level * level;
    case 'quadratic':
    default:             return level * level * 10;
  }
}

function assignRewards(member, guildId, newLevel) {
  const rewards = db.get(`level_rewards_${guildId}`) || [];
  for (const { level, roleId } of rewards) {
    if (newLevel >= level && !member.roles.cache.has(roleId)) {
      member.roles.add(roleId).catch(() => {});
    }
  }
}

function buildNotifText(guildId, member, newLevel) {
  const tmpl = db.get(`levelmsg_${guildId}`);
  if (!tmpl) return null;
  return tmpl
    .replaceAll('{user}', member.user.toString())
    .replaceAll('{user.name}', member.user.username)
    .replaceAll('{user.tag}', member.user.tag || member.user.username)
    .replaceAll('{user.id}', member.user.id)
    .replaceAll('{level}', String(newLevel))
    .replaceAll('{xp}', String(db.get(`guild_${guildId}_xp_${member.user.id}`) || 0))
    .replaceAll('{guild:name}', member.guild.name)
    .replaceAll('{guild:member}', String(member.guild.memberCount));
}

module.exports = async (client, message) => {
  if (!message.guild || message.author.bot) return;
  if (!client.isCommandHandler) return;
  if (db.get(`levels_enabled_${message.guild.id}`) === false) return;

  const guildId = message.guild.id;
  const userId = message.author.id;

  const cooldown = client.config?.LEVELS?.COOLDOWN_MESSAGE ?? 60_000;
  const lastXP = db.get(`xp_cooldown_${guildId}_${userId}`) || 0;
  if (Date.now() - lastXP < cooldown) return;
  if (message.content.startsWith(client.config?.DISCORD?.PREFIX ?? '+')) return;

  const xp = getXpGain(guildId);
  db.add(`guild_${guildId}_xp_${userId}`, xp);
  db.add(`msg_${guildId}_${userId}`, 1);
  const dateStr = new Date().toISOString().slice(0, 10);
  db.add(`msg_day_${guildId}_${userId}_${dateStr}`, 1);
  db.set(`xp_cooldown_${guildId}_${userId}`, Date.now());

  const currentLevel = db.get(`guild_${guildId}_level_${userId}`) || 1;
  const currentXP = db.get(`guild_${guildId}_xp_${userId}`) || 0;
  const xpNeeded = getXpRequired(guildId, currentLevel);

  if (currentXP >= xpNeeded) {
    const newLevel = currentLevel + 1;
    db.set(`guild_${guildId}_level_${userId}`, newLevel);
    db.subtract(`guild_${guildId}_xp_${userId}`, xpNeeded);

    const reduction = Math.min(newLevel * 0.04, 1.0);
    db.set(`guild_${guildId}_reduction_${userId}`, reduction);

    assignRewards(message.member, guildId, newLevel);

    const chanId = db.get(`levelchannel_${guildId}`);
    const levelChannel = (chanId && client.channels.cache.get(chanId)) || message.channel;
    const style = db.get(`levelstyle_${guildId}`) || 'embed';
    const embedData = db.get(`levelmessageembed_${guildId}`);

    if (style === 'embed' && embedData) {
      try {
        const ed = JSON.parse(JSON.stringify(embedData));
        if (ed.description) ed.description = (buildNotifText(guildId, message.member, newLevel) ?? ed.description);
        levelChannel.send({ embeds: [new EmbedBuilder(ed)] }).catch(() => {});
      } catch { levelChannel.send({ embeds: [buildDefaultEmbed(client, message.author, newLevel, reduction)] }).catch(() => {}); }
    } else {
      const text = buildNotifText(guildId, message.member, newLevel);
      if (text) {
        levelChannel.send(text).catch(() => {});
      } else {
        levelChannel.send({ embeds: [buildDefaultEmbed(client, message.author, newLevel, reduction)] }).catch(() => {});
      }
    }
  }
};

function buildDefaultEmbed(client, author, newLevel, reduction) {
  return new EmbedBuilder()
    .setTitle('🎉 Niveau Supérieur !')
    .setDescription(`Félicitations ${author} ! Tu viens de passer au niveau **${newLevel}** !`)
    .setColor(client.config?.SETTINGS?.EMBED_COLOR ?? 0x5b58e2)
    .addFields(
      { name: '📊 Nouveau niveau', value: `${newLevel}`, inline: true },
      { name: '💰 Crédits bonus', value: `+${newLevel * 2} crédits`, inline: true },
      { name: '🎯 Réduction P1', value: `${Math.round(reduction * 100)}%`, inline: true }
    )
    .setThumbnail(author.displayAvatarURL({ dynamic: true }));
}
