const { container, txt, sep, row, btn, reply, errorContainer, FLAGS, ButtonStyle } = require('../../utils/v2');
const { isBotOwner } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'noperm',
  description: 'Configure le message ou le délai pour les refus de permission',
  category: 'permissions',
  level: 7,
  run: async (client, message) => {
    try {
      if (!isBotOwner(client, message)) return reply(message, errorContainer('**Permission insuffisante** — Bot Owner requis.'));

      const c = container(
        txt('## ⛔ Configuration — Refus de Permission'),
        sep(),
        txt('Choisissez ce que vous voulez configurer :'),
        row(
          btn('noperm_msg', '💬 Message', ButtonStyle.Primary),
          btn('noperm_delay', '⏱️ Délai suppression', ButtonStyle.Secondary)
        )
      );

      const sent = await reply(message, c);

      const collector = sent.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60000 });
      collector.on('collect', async i => {
        try {
          await i.deferUpdate();
          if (i.customId === 'noperm_msg') {
            await sent.edit({ components: [container(txt('✍️ Entrez le nouveau message de refus (Variables : `{user}`, `{perm}`).'))], flags: FLAGS });
            const collected = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 60000 }).catch(() => null);
            if (collected?.first()) {
              db.set(`noperm_msg_${message.guild.id}`, collected.first().content);
              collected.first().delete().catch(() => {});
              await sent.edit({ components: [container(txt('## ✅ Message Mis à Jour'), sep(), txt(`**Nouveau message :** ${collected.first().content}`))], flags: FLAGS });
            }
          } else if (i.customId === 'noperm_delay') {
            await sent.edit({ components: [container(txt('⏱️ Entrez le délai en secondes (0 pour désactiver).'))], flags: FLAGS });
            const collected = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 60000 }).catch(() => null);
            if (collected?.first()) {
              const delay = parseInt(collected.first().content);
              if (!isNaN(delay)) {
                db.set(`noperm_delay_${message.guild.id}`, delay * 1000);
                collected.first().delete().catch(() => {});
                await sent.edit({ components: [container(txt('## ✅ Délai Mis à Jour'), sep(), txt(`**Délai :** ${delay}s`))], flags: FLAGS });
              }
            }
          }
          collector.stop();
        } catch (err) { console.error('[noperm]', err); }
      });
      collector.on('end', () => sent.edit({ components: [] }).catch(() => {}));
    } catch (error) {
      console.error('[noperm]', error);
      return reply(message, errorContainer('Erreur lors de l\'exécution.'));
    }
  }
};
