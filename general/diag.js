const { PermissionsBitField, GatewayIntentBits } = require('discord.js');
const { container, txt, sep, reply } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'diag',
  aliases: ['diagnostic', 'diagnostics'],
  description: 'Diagnostics et informations système',
  level: 0,
  run: async (client, message, args) => {
    try {
      const guild = message.guild;
      const channel = message.channel;
      const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
      const prefix = db.get(`prefix_${guild.id}`) ?? client.config.prefix;
      const intents = client.options.intents;
      const hasMsgContent = intents?.has?.(GatewayIntentBits.MessageContent) || false;
      const contentVisible = typeof message.content === 'string' && message.content.length > 0;
      const neededPerms = [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks, PermissionsBitField.Flags.ReadMessageHistory];
      const missing = me ? channel.permissionsFor(me).missing(neededPerms) : ['(bot member not resolved)'];
      const responsible = typeof client.isResponsibleForGuild === 'function' ? client.isResponsibleForGuild(guild.id) : true;

      return reply(message, container(
        txt('## 🔧 Diagnostic'),
        sep(),
        txt([
          `**Prefix :** \`${prefix}\``,
          `**MessageContent Intent :** ${hasMsgContent ? '✅ Activé' : '❌ Manquant'}`,
          `**Contenu visible :** ${contentVisible ? '✅ Oui' : '❌ Non'}`,
          `**Salon :** ${channel} (${channel.id})`,
          `**Permissions manquantes :** ${missing.length ? missing.map(p => `\`${p}\``).join(', ') : '✅ Aucune'}`,
          `**Client responsable :** ${responsible ? '✅ Oui' : '⚠️ Non (autre client)'}`,
          `**Client :** #${(client.clientIndex || 0) + 1}/${client.totalClients || 1} — ${client.user?.tag}`
        ].join('\n')),
        ...(args.length ? [sep(), txt(`**Echo :** ${args.join(' ').slice(0, 1000)}`)] : [])
      ));
    } catch (err) {
      try { await message.channel.send('Erreur diagnostic: ' + (err?.message || String(err))); } catch (_) {}
    }
  }
};
