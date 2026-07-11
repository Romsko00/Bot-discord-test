const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'prefix',
  aliases: ['setprefix'],
  description: 'Change le préfixe du bot sur le serveur',
  category: 'bot',
  level: 6,
  run: async (client, message, args) => {
    const isAuth = (client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true);
    if (!isAuth) return reply(message, errorContainer('**Permission insuffisante.**'));
    const currentPrefix = db.get(`prefix_${message.guild.id}`) || client.config.prefix || '+';
    const newPrefix = args[0];
    if (!newPrefix) return reply(message, container(txt('## ⚙️ Préfixe'), sep(), txt(`**Préfixe actuel :** \`${currentPrefix}\`\nPour changer : \`${currentPrefix}prefix <nouveau>\``)));
    if (newPrefix.length > 5) return reply(message, errorContainer('Le préfixe ne peut pas dépasser **5 caractères**.'));
    if (args.length > 1) return reply(message, errorContainer('Le préfixe ne peut pas contenir d\'espaces.'));
    if (currentPrefix === newPrefix) return reply(message, errorContainer(`Le préfixe est déjà \`${newPrefix}\`.`));
    db.set(`prefix_${message.guild.id}`, newPrefix);
    return reply(message, container(
      txt('## ✅ Préfixe modifié'),
      sep(),
      txt([
        `**Ancien préfixe :** \`${currentPrefix}\``,
        `**Nouveau préfixe :** \`${newPrefix}\``,
        `**Serveur :** ${message.guild.name}`
      ].join('\n'))
    ));
  }
};
