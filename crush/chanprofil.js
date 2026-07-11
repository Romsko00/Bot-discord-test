const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

const VALID_TYPES = ['homme', 'femme', 'autre'];

module.exports = {
  name: 'chanprofil',
  aliases: ['channelprofil', 'setchanprofil'],
  description: 'Définit le salon des profils (homme/femme/autre)',
  category: 'crush',
  usage: '+chanprofil <homme|femme|autre>',
  run: async (client, message, args, prefix) => {
    if (!hasPermissionLevel(client, message, 6)) return reply(message, errorContainer('Permission insuffisante (niveau 6 requis).'));
    const type = (args[0] || '').toLowerCase();
    if (!VALID_TYPES.includes(type)) return reply(message, errorContainer(`**Usage :** \`${prefix}chanprofil <homme|femme|autre>\``));
    db.set(`crush_chan_${type}_${message.guild.id}`, message.channel.id);
    return reply(message, container(txt('## ✅ Salon Configuré'), sep(), txt(`Salon **${message.channel.name}** défini pour les profils **${type}**.`)));
  }
};
