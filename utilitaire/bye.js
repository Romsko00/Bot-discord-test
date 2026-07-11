const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'bye', aliases: ['leaveguild'],
  description: "Fait quitter le bot d'un serveur",
  run: async (client, message, args) => {
    const isOwner = client.config.owners?.includes(message.author.id) || client.config.superadmin?.includes(message.author.id);
    if (!isOwner) return message.reply({ content: 'Cette commande est strictement réservée au créateur du bot.', allowedMentions: { repliedUser: false } });
    let targetGuild = args[0] ? client.guilds.cache.get(args[0]) : message.guild;
    if (!targetGuild) return reply(message, errorContainer('Impossible de trouver un serveur avec cet ID.'));
    const confirmMsg = await message.reply({ components: [container(txt('## ⚠️ Confirmation de départ'), sep(), txt(`Êtes-vous sûr de vouloir quitter **${targetGuild.name}** (\`${targetGuild.id}\`) ?\n\nRépondez par \`oui\` pour confirmer ou \`non\` pour annuler.`))], flags: FLAGS });
    try {
      const col = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id && ['oui', 'non'].includes(m.content.toLowerCase()), max: 1, time: 30000, errors: ['time'] });
      if (col.first().content.toLowerCase() === 'oui') {
        if (targetGuild.id === message.guild.id) { await message.reply('✅ Je quitte ce serveur. Au revoir !'); await targetGuild.leave(); }
        else { await targetGuild.leave(); await message.reply(`✅ J'ai quitté **${targetGuild.name}** avec succès.`); }
      } else { await message.reply('Opération annulée.'); }
    } catch { await message.reply('Temps écoulé. Opération annulée.'); }
  }
};
