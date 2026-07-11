const db = require('./utils/simpledb');
const Discord = require('discord.js');
const logger = require('./utils/logger');

async function handleSop(client, message) {
  try {
    if (!message.guild) return false;
    if (message.author.bot) return false;

    const enabled = db.get(`sop_enabled_${message.guild.id}`) === true;
    const channelId = db.get(`sop_channel_${message.guild.id}`);
    if (!enabled || !channelId) return false;
    if (message.channel.id !== channelId) return false;

    // Detect images: attachments with image mime or filename, or embeds with image/url
    const imageExt = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;
    let found = false;
    let imageUrl = null;

    if (message.attachments && message.attachments.size > 0) {
      for (const att of message.attachments.values()) {
        const url = att.url || att.proxyURL || '';
        const name = att.name || '';
        if ((att.contentType && att.contentType.startsWith('image')) || imageExt.test(url) || imageExt.test(name)) {
          found = true;
          imageUrl = url;
          break;
        }
      }
    }

    if (!found && message.embeds && message.embeds.length > 0) {
      for (const e of message.embeds) {
        if (e.image?.url) { found = true; imageUrl = e.image.url; break; }
        if (e.thumbnail?.url) { found = true; imageUrl = e.thumbnail.url; break; }
        if (e.url && imageExt.test(e.url)) { found = true; imageUrl = e.url; break; }
        if (e.description) {
          const m = e.description.match(/https?:\/\/[\S]+/i);
          if (m && imageExt.test(m[0])) { found = true; imageUrl = m[0]; break; }
        }
      }
    }

    if (!found) return false;

    // Get configured reactions
    const reactions = db.get(`sop_reactions_${message.guild.id}`) || [];
    if (Array.isArray(reactions) && reactions.length > 0) {
      try {
        for (const r of reactions.slice(0, 2)) {
          if (!r) continue;
          await message.react(r).catch((e) => logger.warn(`[SOP] Could not react with ${r}: ${e.message}`));
        }
      } catch (e) {
        logger.error('[SOP] Error reacting:', e);
      }
    }

    // Create a public thread (if possible) and ensure we send the SOP message INSIDE it
    const threadNameTemplate = db.get(`sop_threadname_${message.guild.id}`) || 'Image - {user}';
    const threadName = threadNameTemplate.replace('{user}', message.author.username).replace('{channel}', message.channel.name);

    let createdThread = null;
    try {
      const me = message.guild.members.me;
      const canCreatePublic = message.channel.permissionsFor(me)?.has(Discord.PermissionsBitField.Flags.CreatePublicThreads);

      if (message.channel && message.channel.isTextBased && message.channel.isTextBased() && canCreatePublic) {
        // start a public thread from the message
        createdThread = await message.startThread({ name: threadName, autoArchiveDuration: 1440, type: Discord.ChannelType.PublicThread }).catch((e) => { logger.warn('[SOP] startThread failed: ' + (e.message || e)); return null; });
      } else if (message.channel && message.channel.isTextBased && message.channel.isTextBased()) {
        // Try anyway; maybe the channel allows threads implicitly
        createdThread = await message.startThread({ name: threadName, autoArchiveDuration: 1440 }).catch((e) => { logger.warn('[SOP] startThread fallback failed: ' + (e.message || e)); return null; });
      }

      // If still not created, try creating a public thread via channel.threads.create as a fallback
      if (!createdThread && message.channel && message.channel.isTextBased && message.channel.isTextBased()) {
        try {
          createdThread = await message.channel.threads.create({ name: threadName, autoArchiveDuration: 1440, type: Discord.ChannelType.PublicThread }).catch((e) => { logger.warn('[SOP] threads.create failed: ' + (e.message || e)); return null; });
        } catch (e) {
          logger.warn('[SOP] threads.create exception: ' + (e.message || e));
        }
      }
    } catch (e) {
      logger.warn('[SOP] Could not create thread:', e);
    }

    // Prepare the message with safer placeholders (mention the user and channel)
    const rawSop = db.get(`sop_message_${message.guild.id}`) || 'Image postée par {user}.';
    const sopMessage = String(rawSop).replace(/\{user\}/g, `<@${message.author.id}>`).replace(/\{channel\}/g, `<#${message.channel.id}>`);

    try {
      if (createdThread) {
        // Ensure the thread is unarchived and send inside it
        try {
          if (createdThread.archived) await createdThread.setArchived(false).catch(() => {});
        } catch (_) {}

        await createdThread.send({ content: sopMessage }).catch((e) => logger.warn('[SOP] send in thread failed: ' + (e.message || e)));
      } else {
        // as fallback, send in channel and log that thread creation failed
        logger.warn('[SOP] Thread not created, sending message in channel instead');
        await message.channel.send({ content: sopMessage }).catch(() => {});
      }
    } catch (e) {
      logger.error('[SOP] Error sending message:', e);
    }

    logger.info(`[SOP] Processed image by ${message.author.tag} in #${message.channel.name}`);
    return true;
  } catch (error) {
    logger.error('[SOP] Error in handler:', error);
    return false;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { handleSop };
}
