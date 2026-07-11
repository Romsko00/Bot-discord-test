const { PermissionFlagsBits } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'textallsalon',
  description: 'Configure une permission pour tous les salons textuels',
  category: 'gestion',
  usage: '<@rôle> <permission> <true|false|null>',

  run: async (client, message, args) => {
    const isOwner = client.config.owners?.includes(message.author.id);
    const isSuperAdmin = client.config.superadmin?.includes(message.author.id);
    const isOwnerPerm = db.get(`ownerp_${message.guild.id}_${message.author.id}`);
    if (!isOwner && !isSuperAdmin && !isOwnerPerm && message.author.id !== message.guild.ownerId)
      return reply(message, errorContainer('**Permission refusée.**'));

    if (args.length < 3) return reply(message, container(
      txt('## ⚙️ TextAllSalon — Aide'),
      sep(),
      txt('**Usage :** `!textallsalon @rôle <permission> <true|false|null>`')
    ));

    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
    if (!role) return reply(message, errorContainer('**Rôle introuvable.**'));

    const permission = args[1];
    const validPerms = Object.keys(PermissionFlagsBits);
    if (!validPerms.includes(permission)) return reply(message, errorContainer(`**Permission invalide :** \`${permission}\``));

    const valueStr = args[2].toLowerCase();
    let value;
    if (valueStr === 'true' || valueStr === 'on') value = true;
    else if (valueStr === 'false' || valueStr === 'off') value = false;
    else if (valueStr === 'null' || valueStr === 'reset') value = null;
    else return reply(message, errorContainer('**Valeur invalide** — utilisez `true`, `false` ou `null`.'));

    const loading = await reply(message, container(txt('## ⏳ Configuration en cours...'), sep(), txt(`Permission **${permission}** → \`${value}\` sur tous les salons textuels...`)));
    const channels = message.guild.channels.cache.filter(c => c.isTextBased() && c.manageable);
    let count = 0, errors = 0;
    for (const [, ch] of channels) {
      try { await ch.permissionOverwrites.edit(role, { [permission]: value }); count++; }
      catch { errors++; }
    }
    await loading.edit({ components: [container(
      txt('## ✅ TextAllSalon'),
      sep(),
      txt([`**Permission :** \`${permission}\` → \`${value}\``, `**Rôle :** ${role}`, `**Salons modifiés :** ${count}`, errors > 0 ? `**Échecs :** ${errors}` : null].filter(Boolean).join('\n'))
    )], flags: FLAGS }).catch(() => {});
  }
};
