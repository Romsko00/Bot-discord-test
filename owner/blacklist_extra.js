const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { isBotOwner } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

const types = {
  'blpic': { name: 'Blacklist Images', dbKey: 'blpic' },
  'blreport': { name: 'Blacklist Reports', dbKey: 'blreport' },
  'blsticker': { name: 'Blacklist Stickers', dbKey: 'blsticker' }
};

module.exports = {
  name: 'blacklist_extra',
  aliases: ['blpic', 'blreport', 'blsticker'],
  category: 'owner',
  level: 7,
  run: async (client, message, args) => {
    if (!isBotOwner(client, message)) return reply(message, errorContainer('**Permission insuffisante** — Bot Owner requis.'));
    const commandName = message.content.split(' ')[0].slice((client.config.prefix?.length) || 1).toLowerCase();
    const typeInfo = types[commandName];
    if (!typeInfo) return;
    const sub = args[0];
    if (!['add', 'remove', 'clear'].includes(sub)) {
      return reply(message, errorContainer(`**Usage :** \`!${commandName} <add|remove|clear> [@user/ID]\``));
    }
    if (sub === 'clear') {
      const keys = db.all().filter(d => d.ID.startsWith(`${typeInfo.dbKey}_${client.user.id}_`));
      keys.forEach(k => db.delete(k.ID));
      return reply(message, container(txt(`## ✅ ${typeInfo.name} Vidée`), sep(), txt('Toutes les entrées ont été supprimées.')));
    }
    const target = message.mentions.users.first() || client.users.cache.get(args[1]);
    if (!target) return reply(message, errorContainer('**Cible introuvable.**'));
    const key = `${typeInfo.dbKey}_${client.user.id}_${target.id}`;
    if (sub === 'add') {
      if (db.get(key)) return reply(message, errorContainer(`**${target.tag}** est déjà dans la ${typeInfo.name}.`));
      db.set(key, true);
      return reply(message, container(txt(`## ✅ ${typeInfo.name}`), sep(), txt(`**${target.tag}** ajouté.`)));
    } else {
      if (!db.get(key)) return reply(message, errorContainer(`**${target.tag}** n'est pas dans la ${typeInfo.name}.`));
      db.delete(key);
      return reply(message, container(txt(`## ✅ ${typeInfo.name}`), sep(), txt(`**${target.tag}** retiré.`)));
    }
  }
};
