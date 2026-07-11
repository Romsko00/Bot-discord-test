const { container, txt, sep, reply, errorContainer, formatNumber, formatDuration } = require('../../utils/v2');

module.exports = {
  name: 'stats',
  aliases: ['statistics', 'botstats'],
  description: 'Affiche les statistiques du bot',
  usage: '',
  level: 0,
  run: async (client, message) => {
    try {
      const uptime = process.uptime() * 1000;
      const totalGuilds = client.guilds.cache.size;
      const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
      const totalChannels = client.channels.cache.size;
      const memUsage = process.memoryUsage();
      const memUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(1);
      const memTotal = (memUsage.heapTotal / 1024 / 1024).toFixed(1);
      const memPct = ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1);
      const ping = Math.round(client.ws.ping);
      const commandCount = client.commands ? client.commands.size : 0;
      const clientCount = globalThis.allClients?.length || 1;
      const clientIdx = (client.clientIndex !== undefined ? client.clientIndex + 1 : 1);

      return reply(message, container(
        txt(`## 📊 Statistiques — ${client.user.username}`),
        sep(),
        txt([
          `**⏱️ Uptime :** ${formatDuration(uptime)}`,
          `**🖥️ Mémoire :** ${memUsed}/${memTotal} MB (${memPct}%)`,
          `**⚡ Ping WS :** ${ping}ms`,
          `**📝 Commandes :** ${commandCount}`,
          `**🤖 Client :** ${clientIdx}/${clientCount}`
        ].join('\n')),
        sep(),
        txt([
          `**🌐 Serveurs :** ${formatNumber(totalGuilds)}`,
          `**👥 Membres :** ${formatNumber(totalMembers)}`,
          `**💬 Salons :** ${formatNumber(totalChannels)}`,
          `**📈 Moy/serveur :** ${totalGuilds > 0 ? Math.floor(totalMembers / totalGuilds) : 0} membres`
        ].join('\n'))
      ));
    } catch (error) {
      console.error('Erreur stats:', error);
      return reply(message, errorContainer('Impossible de récupérer les statistiques.'));
    }
  }
};
