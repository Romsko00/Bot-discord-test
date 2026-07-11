const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'setreport',
  aliases: ['setreportcrush', 'crushreport'],
  description: 'Définit le salon où les signalements de profils arrivent',
  category: 'crush',
  usage: '+setreport',
  run: async (client, message, args, prefix) => {
    if (!hasPermissionLevel(client, message, 6)) return reply(message, errorContainer('Permission insuffisante (niveau 6 requis).'));
    db.set(`crush_report_${message.guild.id}`, message.channel.id);
    return reply(message, container(txt('## ✅ Salon Signalements Configuré'), sep(), txt(`Salon **${message.channel.name}** défini pour les signalements de profils.`)));
  }
};
