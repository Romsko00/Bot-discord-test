const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'ping',
  aliases: ['latency', 'pong'],
  description: 'Affiche la latence du bot',
  usage: '',
  level: 0,
  run: async (client, message) => {
    try {
      const sent = await reply(message, container(txt('## 🏓 Ping...'), sep(), txt('Calcul de la latence en cours...')));
      const wsLatency = Math.round(client.ws.ping);
      const apiLatency = sent.createdTimestamp - message.createdTimestamp;

      const dbStart = Date.now();
      db.set(`_ping_probe_${message.author.id}`, 1);
      db.get(`_ping_probe_${message.author.id}`);
      db.delete(`_ping_probe_${message.author.id}`);
      const dbLatency = Date.now() - dbStart;

      const totalLatency = wsLatency + apiLatency;
      const quality = totalLatency < 100 ? '🟢 Excellente' : totalLatency < 200 ? '🟡 Bonne' : totalLatency < 400 ? '🟠 Moyenne' : '🔴 Faible';

      await sent.edit({
        components: [container(
          txt('## 🏓 Ping'),
          sep(),
          txt([
            `**Qualité :** ${quality}`,
            `**Latence API :** ${apiLatency}ms`,
            `**Latence WebSocket :** ${wsLatency}ms`,
            `**Base de données :** ${dbLatency}ms`,
            `**Latence Totale :** ${totalLatency}ms`,
          ].join('\n'))
        )],
        flags: FLAGS
      });
    } catch (error) {
      console.error('Erreur ping:', error);
      return reply(message, errorContainer('Impossible de calculer la latence.'));
    }
  }
};
