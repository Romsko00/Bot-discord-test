const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { LogSystem } = require('../../utils/logSystem');

module.exports = async (client, oldChannel, newChannel) => {
  try {
    if (!newChannel.guild) return;
    const guild = newChannel.guild;

    const changes = [];
    
    if (oldChannel.name !== newChannel.name) {
      changes.push(`Nom : ${oldChannel.name} → ${newChannel.name}`);
    }
    if (oldChannel.topic !== newChannel.topic) {
      changes.push(`Sujet : ${(oldChannel.topic || 'Aucun')} → ${(newChannel.topic || 'Aucun')}`);
    }
    if (oldChannel.parentId !== newChannel.parentId) {
      const oldParent = oldChannel.parent ? oldChannel.parent.name : 'Aucune';
      const newParent = newChannel.parent ? newChannel.parent.name : 'Aucune';
      changes.push(`Catégorie : ${oldParent} → ${newParent}`);
    }
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
      changes.push(`Slowmode : ${oldChannel.rateLimitPerUser || 0}s → ${newChannel.rateLimitPerUser || 0}s`);
    }
    if (oldChannel.nsfw !== newChannel.nsfw) {
      changes.push(`NSFW : ${oldChannel.nsfw ? 'Oui' : 'Non'} → ${newChannel.nsfw ? 'Oui' : 'Non'}`);
    }
    if (oldChannel.bitrate !== newChannel.bitrate) {
      changes.push(`Bitrate : ${oldChannel.bitrate || 64} → ${newChannel.bitrate || 64}kbps`);
    }
    if (oldChannel.userLimit !== newChannel.userLimit) {
      const oldLimit = oldChannel.userLimit || 0;
      const newLimit = newChannel.userLimit || 0;
      changes.push(`Limite : ${oldLimit === 0 ? 'Illimitée' : oldLimit} → ${newLimit === 0 ? 'Illimitée' : newLimit}`);
    }

    if (changes.length === 0) return;

    let executor = null;
    try {
      const logs = await guild.fetchAuditLogs({ 
        type: AuditLogEvent.ChannelUpdate, 
        limit: 1 
      });
      const entry = logs.entries.first();
      if (entry && entry.target?.id === newChannel.id) {
        executor = entry.executor;
      }
    } catch (e) {
      console.error('Erreur fetch audit logs channel update:', e);
    }

    const by = executor ? executor.toString() : 'Inconnu';
    const desc = `**Salon modifié :** ${newChannel}\nPar : ${by}\n${changes.join('\n')}`;
    const embed = new EmbedBuilder()
      .setColor(0xf9a825)
      .setDescription(desc)
      .setFooter({ text: LogSystem.logTimestamp() });

    // Envoyer via le nouveau système de logs
    await LogSystem.sendEventLog(guild, 'CHANNEL', embed);

  } catch (e) {
    console.error('Erreur channelUpdate:', e);
  }
};
