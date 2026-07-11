const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { reloadConfigFromDisk } = require('../../utils/reloadConfig');

module.exports = {
  name: 'reloadconfig',
  aliases: ['configreload', 'reloadcfg'],
  description: 'Recharge config.json depuis le disque',
  category: 'admin',
  level: 9,
  run: async (client, message) => {
    if (!client.config.superadmin || !client.config.superadmin.includes(message.author.id)) {
      return reply(message, errorContainer('**Permission insuffisante** — Superadmin requis.'));
    }

    const result = reloadConfigFromDisk();
    if (!result.success) {
      return reply(message, errorContainer(`**Erreur lors du rechargement :** ${result.error}`));
    }

    const cfg = client.config || {};
    const tokens = Array.isArray(cfg.DISCORD?.TOKEN)
      ? cfg.DISCORD.TOKEN
      : (cfg.DISCORD?.TOKEN ? [cfg.DISCORD.TOKEN] : []);
    const tokenCount = tokens.filter(Boolean).length;
    const superAdminCount = Array.isArray(cfg.superadmin) ? cfg.superadmin.length : 0;

    return reply(message, container(
      txt('## 🔄 Configuration rechargée'),
      sep(),
      txt([
        `**Fichier :** \`config.json\``,
        `**Statut :** ✅ Chargé avec succès`,
        `**Tokens actifs :** ${tokenCount}`,
        `**SuperAdmins :** ${superAdminCount}`
      ].join('\n'))
    ));
  }
};
