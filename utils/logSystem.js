const { PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const db = require('./simpledb');

const LOG_TYPES = {
  MESSAGE: {
    key: 'logs_message_',
    name: '》logs-messages',
    description: 'Messages supprimés et modifiés',
    permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
  },
  MODERATION: {
    key: 'logs_moderation_',
    name: '》logs-modération',
    description: 'Actions de modération (ban, kick, mute, etc)',
    permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
  },
  BOOST: {
    key: 'logs_boost_',
    name: '》logs-boost',
    description: 'Boosts et pertes de boost',
    permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
  },
  CHANNEL: {
    key: 'logs_channel_',
    name: '》logs-salons',
    description: 'Modifications de salons',
    permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
  },
  VOICE: {
    key: 'logs_voice_',
    name: '》logs-vocal',
    description: 'Activité vocale (join/leave/mute)',
    permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
  },
  FLUX: {
    key: 'logs_flux_',
    name: '》logs-flux',
    description: 'Arrivées et départs du serveur',
    permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
  },
  RAID: {
    key: 'logs_raid_',
    name: '》logs-sécurité',
    description: 'Sécurité et anti-raid',
    permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
  }
};

function ts() {
  return new Date().toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function footer(extra = '') {
  return { text: `Zoom Bot • Logs${extra ? ' • ' + extra : ''}` };
}

function userField(user, label = 'Utilisateur') {
  if (!user) return null;
  return { name: label, value: `${user} **${user.username || user.tag || user.id}**\n\`${user.id}\``, inline: true };
}

function channelField(channel, label = 'Salon') {
  if (!channel) return null;
  return { name: label, value: `${channel} \`#${channel.name || channel}\``, inline: true };
}

function buildEmbed(color, title, fields = [], description = null) {
  const e = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setTimestamp()
    .setFooter(footer());
  if (description) e.setDescription(description);
  const validFields = fields.filter(Boolean).slice(0, 25);
  if (validFields.length) e.addFields(validFields);
  return e;
}

class LogSystem {
  constructor(client) {
    this.client = client;
  }

  // ─── Instance helpers ──────────────────────────────────────────────────────

  async _send(guild, logType, embed) {
    return LogSystem.sendEventLog(guild, logType, embed);
  }

  // ─── Message logs ──────────────────────────────────────────────────────────

  async logMessage(guild, type, data) {
    try {
      if (type === 'delete') {
        const embed = buildEmbed(0xED4245, 'Message Supprimé', [
          userField(data.author, 'Auteur'),
          data.channel ? channelField({ toString: () => data.channel, name: data.channel }, 'Salon') : null,
          data.content ? { name: 'Contenu', value: `\`\`\`${String(data.content).slice(0, 950)}\`\`\``, inline: false } : { name: 'Contenu', value: '*Contenu indisponible*', inline: false },
        ]);
        if (data.author?.displayAvatarURL) embed.setThumbnail(data.author.displayAvatarURL({ dynamic: true }));
        await this._send(guild, 'MESSAGE', embed);

      } else if (type === 'edit') {
        const embed = buildEmbed(0xFEE75C, 'Message Modifié', [
          userField(data.author, 'Auteur'),
          data.channel ? { name: 'Salon', value: data.channel, inline: true } : null,
          { name: 'Avant', value: `\`\`\`${String(data.oldContent || '*vide*').slice(0, 450)}\`\`\``, inline: false },
          { name: 'Après', value: `\`\`\`${String(data.newContent || '*vide*').slice(0, 450)}\`\`\``, inline: false },
        ]);
        if (data.url) embed.setDescription(`[Aller au message](${data.url})`);
        if (data.author?.displayAvatarURL) embed.setThumbnail(data.author.displayAvatarURL({ dynamic: true }));
        await this._send(guild, 'MESSAGE', embed);

      } else if (type === 'bulk_delete') {
        const embed = buildEmbed(0xED4245, 'Messages Supprimés en masse', [
          data.channel ? { name: 'Salon', value: data.channel, inline: true } : null,
          { name: 'Quantité', value: `**${data.count || '?'}** messages`, inline: true },
          data.executor ? userField(data.executor, 'Modérateur') : null,
        ]);
        await this._send(guild, 'MESSAGE', embed);
      }
    } catch (e) { console.error('[LogSystem.logMessage]', e); }
  }

  // ─── Modération logs ───────────────────────────────────────────────────────

  async logModeration(guild, action, moderator, target, reason, options = {}) {
    try {
      const actionConfig = {
        'ban':        { color: 0xC0392B, title: 'Membre Banni' },
        'Ban':        { color: 0xC0392B, title: 'Membre Banni' },
        'unban':      { color: 0x57F287, title: 'Membre Débanni' },
        'Unban':      { color: 0x57F287, title: 'Membre Débanni' },
        'kick':       { color: 0xE67E22, title: 'Membre Expulsé' },
        'Kick':       { color: 0xE67E22, title: 'Membre Expulsé' },
        'mute':       { color: 0xF39C12, title: 'Membre Muté' },
        'Mute':       { color: 0xF39C12, title: 'Membre Muté' },
        'unmute':     { color: 0x57F287, title: 'Membre Dé-muté' },
        'Unmute':     { color: 0x57F287, title: 'Membre Dé-muté' },
        'timeout':    { color: 0xF39C12, title: 'Timeout Appliqué' },
        'warn':       { color: 0xFEE75C, title: 'Avertissement' },
        'Avertissement': { color: 0xFEE75C, title: 'Avertissement' },
        'jail':       { color: 0x7F8C8D, title: 'Membre Emprisonné' },
        'unjail':     { color: 0x57F287, title: 'Membre Libéré' },
        'softban':    { color: 0xE74C3C, title: 'Softban Appliqué' },
        'tempban':    { color: 0xC0392B, title: 'Ban Temporaire' },
        'Ban Temporaire': { color: 0xC0392B, title: 'Ban Temporaire' },
      };
      const cfg = actionConfig[action] || { color: 0x99AAB5, title: String(action) };

      const fields = [
        userField(target, 'Cible'),
        userField(moderator, 'Modérateur'),
        { name: 'Raison', value: String(reason || 'Aucune raison').slice(0, 512), inline: false },
      ];
      if (options.duration) fields.push({ name: 'Durée', value: String(options.duration), inline: true });
      if (options.caseId)   fields.push({ name: 'Case ID', value: `\`${options.caseId}\``, inline: true });

      const embed = buildEmbed(cfg.color, cfg.title, fields);
      if (target?.displayAvatarURL) embed.setThumbnail(target.displayAvatarURL({ dynamic: true }));
      await this._send(guild, 'MODERATION', embed);
    } catch (e) { console.error('[LogSystem.logModeration]', e); }
  }

  // ─── Membre join/leave logs ────────────────────────────────────────────────

  async logMember(guild, type, member, extra = {}) {
    try {
      const user = member.user || member;
      const createdAt = user.createdAt ? `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>` : 'Inconnue';

      if (type === 'join') {
        const joinedAt = `<t:${Math.floor(Date.now() / 1000)}:F>`;
        const embed = buildEmbed(0x57F287, 'Membre Arrivé', [
          userField(user, 'Membre'),
          { name: 'Compte créé', value: createdAt, inline: true },
          { name: 'Membres', value: `**${guild.memberCount}**`, inline: true },
          extra.invite ? { name: 'Invitation', value: String(extra.invite), inline: true } : null,
        ]);
        embed.setThumbnail(user.displayAvatarURL?.({ dynamic: true }) || null);
        await this._send(guild, 'FLUX', embed);

      } else if (type === 'leave') {
        const embed = buildEmbed(0xED4245, 'Membre Parti', [
          userField(user, 'Membre'),
          { name: 'Compte créé', value: createdAt, inline: true },
          { name: 'Membres restants', value: `**${guild.memberCount}**`, inline: true },
          member.roles?.cache ? { name: 'Rôles', value: member.roles.cache.filter(r => r.id !== guild.roles.everyone.id).map(r => `<@&${r.id}>`).join(' ') || 'Aucun', inline: false } : null,
        ]);
        embed.setThumbnail(user.displayAvatarURL?.({ dynamic: true }) || null);
        await this._send(guild, 'FLUX', embed);
      }
    } catch (e) { console.error('[LogSystem.logMember]', e); }
  }

  // ─── Salon logs ────────────────────────────────────────────────────────────

  async logChannel(guild, type, channel, executor, changes = {}) {
    try {
      const typeConfig = {
        'create': { color: 0x57F287, title: 'Salon Créé' },
        'delete': { color: 0xED4245, title: 'Salon Supprimé' },
        'update': { color: 0xFEE75C, title: 'Salon Modifié' },
      };
      const cfg = typeConfig[type] || { color: 0x99AAB5, title: type };

      const chanTypeLabel = channel.type === 0 ? 'Textuel' : channel.type === 2 ? 'Vocal' : channel.type === 4 ? 'Catégorie' : 'Autre';

      const fields = [
        { name: 'Salon', value: `**#${channel.name}**\n\`${channel.id}\``, inline: true },
        { name: 'Type', value: chanTypeLabel, inline: true },
        executor ? userField(executor, 'Par') : null,
      ];

      if (Object.keys(changes).length > 0) {
        const changeLines = Object.entries(changes).map(([k, v]) => `**${k} :** ${v}`).join('\n');
        fields.push({ name: 'Modifications', value: changeLines.slice(0, 900), inline: false });
      }

      const embed = buildEmbed(cfg.color, cfg.title, fields);
      await this._send(guild, 'CHANNEL', embed);
    } catch (e) { console.error('[LogSystem.logChannel]', e); }
  }

  // ─── Vocal logs ────────────────────────────────────────────────────────────
  // Signature: logVoice(guild, type, member, channel, extra = {})
  // channel is the channel object directly (not wrapped in {})

  async logVoice(guild, type, member, channel, extra = {}) {
    try {
      const typeConfig = {
        'join':     { color: 0x57F287, title: 'Rejoint le Vocal' },
        'leave':    { color: 0xED4245, title: 'Quitté le Vocal' },
        'move':     { color: 0x5865F2, title: 'Déplacé en Vocal' },
        'mute':     { color: 0xF39C12, title: 'Muté en Vocal' },
        'unmute':   { color: 0x57F287, title: 'Démuté en Vocal' },
        'deaf':     { color: 0xF39C12, title: 'Sourd en Vocal' },
        'undeaf':   { color: 0x57F287, title: 'Plus sourd en Vocal' },
        'stream':   { color: 0x5865F2, title: 'Stream démarré' },
      };
      const cfg = typeConfig[type] || { color: 0x99AAB5, title: String(type) };
      const user = member.user || member;

      const chanName = channel?.name ? `**#${channel.name}**` : (channel ? String(channel) : null);

      const fields = [
        userField(user, 'Membre'),
        chanName ? { name: 'Salon vocal', value: chanName, inline: true } : null,
        extra.mute !== undefined ? { name: 'Mute serveur', value: extra.mute ? 'Oui' : 'Non', inline: true } : null,
        extra.deaf !== undefined ? { name: 'Sourd serveur', value: extra.deaf ? 'Oui' : 'Non', inline: true } : null,
      ];

      const embed = buildEmbed(cfg.color, cfg.title, fields);
      if (user.displayAvatarURL) embed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
      await this._send(guild, 'VOICE', embed);
    } catch (e) { console.error('[LogSystem.logVoice]', e); }
  }

  // ─── Boost logs ────────────────────────────────────────────────────────────
  // Signature: logBoost(guild, type, member)
  // type = 'boost' | 'unboost'

  async logBoost(guild, type, member) {
    try {
      const isBoost = type === 'boost';
      const user = member?.user || member;
      const embed = buildEmbed(
        isBoost ? 0xFF73FA : 0x99AAB5,
        isBoost ? 'Nouveau Boost' : 'Boost Perdu',
        [
          userField(user, 'Membre'),
          { name: 'Boosts totaux', value: `**${guild.premiumSubscriptionCount || 0}**`, inline: true },
          { name: 'Niveau serveur', value: `Niveau **${guild.premiumTier || 0}**`, inline: true },
        ]
      );
      if (user?.displayAvatarURL) embed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
      await this._send(guild, 'BOOST', embed);
    } catch (e) { console.error('[LogSystem.logBoost]', e); }
  }

  // ─── Static methods ────────────────────────────────────────────────────────

  static logTimestamp() {
    return ts();
  }

  static async setupLogsCategory(guild) {
    try {
      let category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('logs')
      );

      if (!category) {
        category = await guild.channels.create({
          name: '→ Logs',
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
          ]
        });
      }

      const results = {};
      for (const [type, config] of Object.entries(LOG_TYPES)) {
        let channel = guild.channels.cache.find(c => c.parentId === category.id && c.name === config.name);
        if (!channel) {
          channel = await guild.channels.create({
            name: config.name,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: config.description,
            permissionOverwrites: [
              { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: guild.members.me.id, allow: config.permissions }
            ]
          });
        }
        db.set(`${config.key}${guild.id}`, channel.id);
        results[type] = channel.id;
      }

      return { success: true, category: category.id, channels: results };
    } catch (error) {
      console.error('[LogSystem.setupLogsCategory]', error);
      return { success: false, error: error.message };
    }
  }

  static async send(guild, logType, embed) {
    try {
      const config = LOG_TYPES[logType];
      if (!config) return false;
      const channelId = db.get(`${config.key}${guild.id}`);
      if (!channelId) return false;
      const channel = guild.channels.cache.get(channelId);
      if (!channel) return false;
      await channel.send({ embeds: [embed] });
      return true;
    } catch (error) {
      console.error(`[LogSystem.send] ${logType}:`, error);
      return false;
    }
  }

  static async sendEventLog(guild, logType, embed) {
    try {
      const config = LOG_TYPES[logType];
      if (!config) return false;
      const channelId = db.get(`${config.key}${guild.id}`);
      if (!channelId) return false;
      const channel = guild.channels.cache.get(channelId);
      if (!channel) return false;

      const embedData = embed.data || embed;
      const hashStr = (embedData.title || '') + (embedData.description || '').slice(0, 80) + (embedData.fields || []).slice(0, 2).map(f => (f.value || '').slice(0, 40)).join('');
      let h = 0;
      for (let i = 0; i < hashStr.length; i++) { h = ((h << 5) - h) + hashStr.charCodeAt(i); h |= 0; }
      const recentKey = `recent_log_${guild.id}_${logType}_${Math.abs(h).toString(36)}`;
      if (db.get(recentKey)) return false;
      db.set(recentKey, 1);
      setTimeout(() => db.delete(recentKey), 20000);

      await channel.send({ embeds: [embed] });
      return true;
    } catch (error) {
      console.error(`[LogSystem.sendEventLog] ${logType}:`, error);
      return false;
    }
  }

  static getLogChannel(guild, logType) {
    const config = LOG_TYPES[logType];
    if (!config) return null;
    const channelId = db.get(`${config.key}${guild.id}`);
    if (!channelId) return null;
    return guild.channels.cache.get(channelId);
  }

  static getConfig(guildId) {
    const config = {};
    for (const [type, logConfig] of Object.entries(LOG_TYPES)) {
      config[type] = {
        channelId: db.get(`${logConfig.key}${guildId}`),
        enabled: db.get(`${logConfig.key}enabled_${guildId}`) !== false,
        name: logConfig.name,
        description: logConfig.description
      };
    }
    return config;
  }

  static toggleLog(guildId, logType, enabled) {
    const config = LOG_TYPES[logType];
    if (!config) return false;
    db.set(`${config.key}enabled_${guildId}`, enabled);
    return true;
  }

  static isEnabled(guildId, logType) {
    const config = LOG_TYPES[logType];
    if (!config) return false;
    return db.get(`${config.key}enabled_${guildId}`) !== false;
  }

  static generateEmbedHash(embed) {
    try {
      const embedData = embed.data || embed;
      let hash = (embedData.title || '') + (embedData.description || '').substring(0, 100);
      (embedData.fields || []).slice(0, 3).forEach(f => { hash += (f.name || '') + (f.value || '').substring(0, 50); });
      let h = 0;
      for (let i = 0; i < hash.length; i++) { h = ((h << 5) - h) + hash.charCodeAt(i); h |= 0; }
      return Math.abs(h).toString(36);
    } catch (e) { return Date.now().toString(36); }
  }
}

LogSystem.LOG_TYPES = LOG_TYPES;

// Rétrocompatibilité : `const LogSystem = require(...)` ET `const { LogSystem } = require(...)`
module.exports = LogSystem;
module.exports.LogSystem = LogSystem;
module.exports.LOG_TYPES = LOG_TYPES;
