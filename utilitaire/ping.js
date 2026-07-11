const { container, txt, sep, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'ping',
  aliases: ['speed'],
  level: 5,
  description: 'Affiche la latence du bot (réservé aux propriétaires)',

  run: async (client, message) => {
    const isOwner = (client.config.superadmin && client.config.superadmin.includes(message.author.id))
      || (client.config.owners && client.config.owners.includes(message.author.id))
      || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;

    if (!isOwner) return;

    const loadingMsg = await message.channel.send({
      components: [container(txt('## 🏓 Ping'), sep(), txt('Calcul en cours…'))],
      flags: FLAGS
    });

    const ping = loadingMsg.createdTimestamp - message.createdTimestamp;
    const wsPing = client.ws.ping;

    const bar = (ms) => {
      const level = ms < 100 ? '🟢' : ms < 250 ? '🟡' : '🔴';
      return `${level} **${ms}ms**`;
    };

    return loadingMsg.edit({
      components: [container(
        txt('## 🏓 Ping'),
        sep(),
        txt([
          `**Ping :** ${bar(ping)}`,
          `**WebSocket :** ${bar(wsPing)}`,
          `**Uptime :** ${Math.floor(process.uptime() / 60)}m ${Math.floor(process.uptime() % 60)}s`
        ].join('\n'))
      )],
      flags: FLAGS
    });
  }
};
