const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'captcha',
  aliases: ['verifysetup'],
  description: 'Système de captcha pour la vérification',
  usage: '[enable|disable|role|channel]',

  run: async (client, message, args) => {
    const isOwner = message.guild.ownerId === message.author.id;
    const isBotOwner = client.config.owners?.includes(message.author.id);
    const isSuperadmin = client.config.superadmin?.includes(message.author.id);
    if (!isOwner && !isBotOwner && !isSuperadmin && !hasPermissionLevel(client, message, 6))
      return reply(message, errorContainer('Tu dois être administrateur.'));

    const g = message.guild.id;
    const sub = (args[0] || 'info').toLowerCase();

    if (sub === 'enable') { db.set(`captcha_enabled_${g}`, true); return reply(message, container(txt('## ✅ Captcha Activé'), sep(), txt('Le système de captcha est maintenant **activé**.'))); }
    if (sub === 'disable') { db.set(`captcha_enabled_${g}`, false); return reply(message, container(txt('## ❌ Captcha Désactivé'), sep(), txt('Le système de captcha est maintenant **désactivé**.'))); }

    if (sub === 'role') {
      const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
      if (!role) return reply(message, errorContainer('**Usage :** `!captcha role <@rôle|ID>`'));
      db.set(`captcha_role_${g}`, role.id);
      return reply(message, container(txt('## ✅ Rôle Captcha Défini'), sep(), txt(`Rôle de vérification : ${role}`)));
    }

    if (sub === 'channel') {
      const ch = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
      if (!ch) return reply(message, errorContainer('**Usage :** `!captcha channel <#salon|ID>`'));
      db.set(`captcha_channel_${g}`, ch.id);
      return reply(message, container(txt('## ✅ Salon Captcha Défini'), sep(), txt(`Salon de vérification : ${ch}`)));
    }

    const enabled = db.get(`captcha_enabled_${g}`) === true;
    const roleId = db.get(`captcha_role_${g}`);
    const channelId = db.get(`captcha_channel_${g}`);

    return reply(message, container(
      txt('## 🔐 Configuration Captcha'),
      sep(),
      txt([
        `**Activé :** ${enabled ? '✅ Oui' : '❌ Non'}`,
        `**Rôle :** ${roleId ? (() => { const _cr = message.guild.roles.cache.get(roleId); return _cr ? `${_cr.name} (\`${roleId}\`)` : `~~${roleId}~~`; })() : 'Non défini'}`,
        `**Salon :** ${channelId ? `<#${channelId}>` : 'Non défini'}`,
        '',
        '`!captcha enable` / `!captcha disable`',
        '`!captcha role @rôle` / `!captcha channel #salon`'
      ].join('\n'))
    ));
  }
};
