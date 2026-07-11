const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { isBotOwner } = require('../../utils/permissionUtils');

const statuses = { online: 'online', idle: 'idle', dnd: 'dnd', invisible: 'invisible' };
const activities = {
  stream: { type: 1, label: 'Streaming' },
  watch: { type: 3, label: 'Watching' },
  listen: { type: 2, label: 'Listening' },
  playto: { type: 0, label: 'Playing' },
  compet: { type: 5, label: 'Competing' },
  customstatus: { type: 4, label: 'Custom' }
};

module.exports = {
  name: 'status_manager',
  aliases: ['online', 'idle', 'dnd', 'invisible', 'stream', 'watch', 'listen', 'playto', 'compet', 'customstatus', 'clearactivity'],
  category: 'owner',
  level: 7,
  run: async (client, message, args) => {
    if (!isBotOwner(client, message)) return reply(message, errorContainer('**Permission insuffisante** — Bot Owner requis.'));
    const commandName = message.content.split(' ')[0].slice((client.config.prefix?.length) || 1).toLowerCase();

    if (statuses[commandName]) {
      client.user.setPresence({ status: statuses[commandName] });
      return reply(message, container(txt('## ✅ Statut Mis à Jour'), sep(), txt(`**Nouveau statut :** \`${statuses[commandName]}\``)));
    }
    if (commandName === 'clearactivity') {
      client.user.setActivity(null);
      return reply(message, container(txt('## ✅ Activité Supprimée')));
    }
    const actInfo = activities[commandName];
    if (actInfo) {
      const text = args.join(' ');
      if (!text) return reply(message, errorContainer(`**Usage :** \`!${commandName} <texte>\``));
      const options = { type: actInfo.type };
      if (commandName === 'stream') options.url = 'https://twitch.tv/monstercat';
      client.user.setActivity(text, options);
      return reply(message, container(txt('## ✅ Activité Mise à Jour'), sep(), txt(`**Type :** ${actInfo.label}\n**Texte :** ${text}`)));
    }
  }
};
