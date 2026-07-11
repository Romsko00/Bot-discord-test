const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { isBotOwner } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'config_manager',
  aliases: ['maincolor', 'mainprefix', 'dmlog', 'cooldown', 'settings', 'color', 'sethelp'],
  category: 'owner',
  level: 7,
  run: async (client, message, args) => {
    const commandName = message.content.split(' ')[0].slice((client.config.prefix?.length) || 1).toLowerCase();

    if (commandName === 'settings') {
      return reply(message, container(
        txt('## ⚙️ Paramètres du Serveur'),
        sep(),
        txt([
          `**Préfixe :** \`${db.get(`prefix_${message.guild.id}`) || client.config.prefix || '+'}\``,
          `**Couleur embed :** ${db.get(`color_${message.guild.id}`) || 'Défaut'}`,
          `**Style aide :** ${db.get(`help_style_${message.guild.id}`) || 'commands'}`
        ].join('\n'))
      ));
    }

    if (!isBotOwner(client, message)) return reply(message, errorContainer('**Permission insuffisante** — Bot Owner requis.'));

    if (commandName === 'cooldown') {
      const sub = args[0];
      if (!sub) return reply(message, errorContainer('**Usage :** `!cooldown <on|off|time> [durée]`'));
      if (sub === 'off') { db.set('cooldown_enabled', false); return reply(message, container(txt('## ✅ Cooldown Désactivé'))); }
      if (sub === 'on') { db.set('cooldown_enabled', true); return reply(message, container(txt('## ✅ Cooldown Activé'))); }
      if (sub === 'time') {
        const arg = args[1] || '3s';
        let time = arg.endsWith('s') ? parseInt(arg) * 1000 : arg.endsWith('m') ? parseInt(arg) * 60000 : parseInt(arg);
        db.set('cooldown_time', time);
        return reply(message, container(txt('## ✅ Cooldown Configuré'), sep(), txt(`**Durée :** \`${arg}\``)));
      }
    }
    if (commandName === 'dmlog') {
      const sub = args[0];
      if (!sub) return reply(message, errorContainer('**Usage :** `!dmlog <on|off|only>`'));
      db.set('dm_log_config', sub);
      return reply(message, container(txt('## ✅ DM Log Configuré'), sep(), txt(`**Mode :** ${sub}`)));
    }
    if (commandName === 'maincolor') {
      const color = args[0];
      if (!color) return reply(message, container(txt('## 🎨 Couleur Principale'), sep(), txt(`Actuelle : **${db.get('main_color') || 'Défaut'}**`)));
      db.set('main_color', color);
      return reply(message, container(txt('## ✅ Couleur Mise à Jour'), sep(), txt(`**Nouvelle couleur :** ${color}`)));
    }
    if (commandName === 'color') {
      const color = args[0];
      if (!color) return reply(message, container(txt('## 🎨 Couleur Serveur'), sep(), txt(`Actuelle : **${db.get(`color_${message.guild.id}`) || 'Défaut'}**`)));
      db.set(`color_${message.guild.id}`, color);
      return reply(message, container(txt('## ✅ Couleur Serveur Mise à Jour'), sep(), txt(`**Nouvelle couleur :** ${color}`)));
    }
    if (commandName === 'sethelp') {
      const style = args[0];
      if (!style) return reply(message, errorContainer('**Usage :** `!sethelp <commands|perms>`'));
      db.set(`help_style_${message.guild.id}`, style);
      return reply(message, container(txt('## ✅ Style d\'Aide Mis à Jour'), sep(), txt(`**Style :** ${style}`)));
    }
    return reply(message, errorContainer('Commande non reconnue.'));
  }
};
