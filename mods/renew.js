const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'renew',
  aliases: ['nuke', 'purge'],
  description: 'Renouvelle un salon (supprime et recrée)',
  usage: '[#salon] | all',

  run: async (client, message, args) => {
    try {
      const isSuperOwner = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
      let hasMod = isSuperOwner;
      if (!hasMod) message.member.roles.cache.forEach(r => { if (db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`)) hasMod = true; });

      if (args[0] === 'all') {
        if (!isSuperOwner) return reply(message, errorContainer('**Permission refusée** — Owner/Superadmin uniquement.'));
        const channels = message.guild.channels.cache.filter(ch => ch.type !== 4);
        let done = 0, failed = 0;
        for (const [, ch] of channels) {
          try {
            await ch.clone({ name: ch.name, type: ch.type, topic: ch.topic, nsfw: ch.nsfw, bitrate: ch.bitrate, userLimit: ch.userLimit, rateLimitPerUser: ch.rateLimitPerUser, position: ch.rawPosition, reason: `Renew all par ${message.author.tag}` });
            await ch.delete().catch(() => {});
            done++;
          } catch { failed++; }
        }
        return;
      }

      if (!hasMod) return reply(message, errorContainer('**Permission refusée.**'));

      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]) || message.channel;
      const isCurrent = channel.id === message.channel.id;

      try {
        const cloned = await channel.clone({ name: channel.name, type: channel.type, topic: channel.topic, nsfw: channel.nsfw, bitrate: channel.bitrate, userLimit: channel.userLimit, rateLimitPerUser: channel.rateLimitPerUser, position: channel.rawPosition, reason: `Renew par ${message.author.tag}` });
        await channel.delete().catch(() => {});
        cloned.send({ components: [container(txt('## ✅ Salon Recréé'), sep(), txt(`${message.author} — salon renouvelé avec succès.`))], flags: FLAGS }).catch(() => {});
        if (!isCurrent) {
          message.channel.send({ components: [container(txt('## ✅ Salon Recréé'), sep(), txt(`**${channel.name}** a été recréé : <#${cloned.id}>`.replace(`<#${channel.id}>`, `<#${cloned.id}>`)))], flags: FLAGS }).catch(() => {});
        }
      } catch (err) {
        console.error('[renew]', err);
        if (!isCurrent) reply(message, errorContainer(`Échec : ${err.message.slice(0, 200)}`));
      }
    } catch (err) {
      console.error('[renew]', err);
      reply(message, errorContainer('Une erreur est survenue.'));
    }
  }
};
