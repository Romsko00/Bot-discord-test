const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'wipe',
  aliases: ['nukeall'],
  description: 'Supprime TOUS les salons et catégories du serveur',
  category: 'gestion',

  run: async (client, message) => {
    const isBotOwner = client.config.owners?.includes(message.author.id);
    if (message.author.id !== message.guild.ownerId && !isBotOwner)
      return reply(message, errorContainer('**Permission Refusée** — Seul le propriétaire du serveur peut utiliser cette commande.'));

    const code = Math.floor(1000 + Math.random() * 9000);
    await reply(message, container(
      txt('## ☢️ DANGER — WIPE SERVEUR'),
      sep(),
      txt(`Vous êtes sur le point de supprimer **TOUS** les salons et catégories du serveur.\nCette action est **IRRÉVERSIBLE**.\n\nPour confirmer, tapez le code : \`${code}\`\n\n**Vous avez 20 secondes.**`)
    ));

    const collector = message.channel.createMessageCollector({ filter: m => m.author.id === message.author.id, time: 20000, max: 1 });

    collector.on('collect', async m => {
      if (m.content !== String(code)) return m.reply({ components: [errorContainer('Code incorrect. Wipe annulé.')], flags: FLAGS });
      try {
        await m.reply({ components: [container(txt('## 🔴 Suppression en cours...'), sep(), txt('Tous les salons vont être supprimés.'))], flags: FLAGS });
        const channels = message.guild.channels.cache;
        let count = 0;
        channels.forEach(async ch => { if (ch.id !== message.channel.id) { try { await ch.delete(); count++; } catch {} } });
        setTimeout(async () => {
          try { await message.channel.delete(); } catch {}
          try {
            const newCh = await message.guild.channels.create({ name: 'wiped', type: 0 });
            await newCh.send({ components: [container(txt('## ✅ Wipe Effectué'), sep(), txt(`${count} salons supprimés.`))], flags: FLAGS });
          } catch {}
        }, 5000);
      } catch (e) { console.error('[wipe]', e); }
    });

    collector.on('end', collected => {
      if (collected.size === 0) message.channel.send({ components: [container(txt('⏱️ Temps écoulé — Wipe annulé.'))], flags: FLAGS }).catch(() => {});
    });
  }
};
