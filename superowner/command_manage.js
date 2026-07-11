const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'command_manage',
  aliases: ['autorise', 'desac', 'desaclist', 'onlyfor', 'resetonlyfor'],
  category: 'superowner',
  level: 9,
  run: async (client, message, args) => {
    const commandName = message.content.split(' ')[0].slice((client.config.prefix?.length) || 1).toLowerCase();

    if (commandName === 'desac') {
      const cmd = args[0], target = message.mentions.users.first() || client.users.cache.get(args[1]);
      if (!cmd || !target) return reply(message, errorContainer('**Usage :** `!desac <cmd> <@user>`'));
      db.set(`deny_${message.guild.id}_${cmd}_${target.id}`, true);
      return reply(message, container(txt('## ✅ Commande Désactivée'), sep(), txt([`**Commande :** \`${cmd}\``, `**Pour :** ${target.tag}`].join('\n'))));
    }

    if (commandName === 'autorise') {
      const cmd = args[0], target = message.mentions.users.first() || client.users.cache.get(args[1]);
      if (!cmd || !target) return reply(message, errorContainer('**Usage :** `!autorise <cmd|all> <@user>`'));
      if (cmd === 'all') {
        const keys = db.all().filter(d => d.ID.startsWith(`deny_${message.guild.id}_`) && d.ID.endsWith(`_${target.id}`));
        keys.forEach(k => db.delete(k.ID));
        return reply(message, container(txt('## ✅ Tout Autorisé'), sep(), txt(`Toutes les commandes réautorisées pour **${target.tag}**.`)));
      }
      db.delete(`deny_${message.guild.id}_${cmd}_${target.id}`);
      return reply(message, container(txt('## ✅ Commande Autorisée'), sep(), txt([`**Commande :** \`${cmd}\``, `**Pour :** ${target.tag}`].join('\n'))));
    }

    if (commandName === 'onlyfor') {
      const type = args[0], cmd = args[1];
      if (!type || !['dev', 'owner', 'buyer', 'all', 'list'].includes(type) || (type !== 'list' && !cmd)) return reply(message, errorContainer('**Usage :** `!onlyfor <dev|owner|buyer|all|list> [cmd]`'));
      if (type === 'list') {
        const keys = db.all().filter(d => d.ID.startsWith(`onlyfor_${message.guild.id}_`));
        const lines = keys.map(k => `\`${k.ID.split('_')[2]}\` → **${k.data}**`).join('\n');
        return reply(message, container(txt('## 📋 Restrictions OnlyFor'), sep(), txt(lines || 'Aucune restriction configurée.')));
      }
      db.set(`onlyfor_${message.guild.id}_${cmd}`, type);
      return reply(message, container(txt('## ✅ Restriction Définie'), sep(), txt([`**Commande :** \`${cmd}\``, `**Réservée aux :** ${type}`].join('\n'))));
    }

    if (commandName === 'resetonlyfor') {
      const type = args[0];
      if (type === 'all') {
        const keys = db.all().filter(d => d.ID.startsWith(`onlyfor_${message.guild.id}_`));
        keys.forEach(k => db.delete(k.ID));
        return reply(message, container(txt('## ✅ Restrictions Supprimées'), sep(), txt(`**${keys.length}** restrictions supprimées.`)));
      }
      return reply(message, errorContainer('Utilisez `!resetonlyfor all`.'));
    }

    if (commandName === 'desaclist') {
      const userId = args[0];
      const keys = db.all().filter(d => d.ID.startsWith(`deny_${message.guild.id}_`) && (!userId || d.ID.endsWith(`_${userId}`)));
      const lines = keys.map(k => { const parts = k.ID.split('_'); return `\`${parts[2]}\` → <@${parts[3]}>`; }).join('\n');
      return reply(message, container(txt('## 📋 Commandes Désactivées'), sep(), txt(lines || 'Aucune restriction active.')));
    }
    return reply(message, errorContainer('Commande non reconnue.'));
  }
};
