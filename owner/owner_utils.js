const { container, txt, sep, row, btn, reply, errorContainer, FLAGS, ButtonStyle } = require('../../utils/v2');
const { isBotOwner } = require('../../utils/permissionUtils');

module.exports = {
  name: 'owner_utils',
  aliases: ['leave', 'dm', 'serverlist', 'set'],
  category: 'owner',
  level: 7,
  run: async (client, message, args) => {
    if (!isBotOwner(client, message)) return reply(message, errorContainer('**Permission insuffisante** — Bot Owner requis.'));
    const commandName = message.content.split(' ')[0].slice((client.config.prefix?.length) || 1).toLowerCase();

    if (commandName === 'leave') {
      const guildId = args[0] || message.guild.id;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return reply(message, errorContainer('**Serveur introuvable.**'));
      await guild.leave();
      return reply(message, container(txt('## ✅ Serveur Quitté'), sep(), txt(`J'ai quitté le serveur **${guild.name}** (${guildId}).`)));
    }

    if (commandName === 'dm') {
      const user = message.mentions.users.first() || client.users.cache.get(args[0]);
      const msg = args.slice(message.mentions.users.size > 0 ? 1 : 2).join(' ');
      if (!user || !msg) return reply(message, errorContainer('**Usage :** `!dm <@user|id> <message>`'));
      try {
        await user.send(msg);
        return reply(message, container(txt('## ✅ Message Envoyé'), sep(), txt(`Message envoyé à **${user.tag}**.`)));
      } catch (e) {
        return reply(message, errorContainer(`Impossible d'envoyer le message : ${e.message}`));
      }
    }

    if (commandName === 'serverlist') {
      const guilds = client.guilds.cache;
      const list = guilds.map(g => `• **${g.name}** — ${g.memberCount} membres (${g.id})`).join('\n');
      const pages = [];
      const lines = list.split('\n');
      for (let i = 0; i < lines.length; i += 20) pages.push(lines.slice(i, i + 20).join('\n'));
      return reply(message, container(
        txt(`## 🌐 Liste des Serveurs (${guilds.size})`),
        sep(),
        txt(pages[0] || 'Aucun serveur.')
      ));
    }

    if (commandName === 'set') {
      const type = args[0], val = args.slice(1).join(' ');
      if (!type || !val) return reply(message, errorContainer('**Usage :** `!set <name|avatar> <valeur>`'));
      try {
        if (type === 'name') await client.user.setUsername(val);
        else if (type === 'avatar') await client.user.setAvatar(val);
        else return reply(message, errorContainer('**Types :** `name`, `avatar`'));
        return reply(message, container(txt(`## ✅ ${type} Mis à Jour`), sep(), txt(`**Valeur :** ${val}`)));
      } catch (e) {
        return reply(message, errorContainer(`Erreur : ${e.message}`));
      }
    }
  }
};
