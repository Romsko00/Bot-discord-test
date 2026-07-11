const { container, txt, sep, row, btn, reply, errorContainer, FLAGS, ButtonStyle } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const logger = require('../../utils/logger');

module.exports = {
  name: 'dmall',
  aliases: ['mpall', 'dmserver'],
  description: 'Envoie un message privé à tous les membres du serveur',
  usage: '<message>',
  category: 'admin',
  level: 6,
  run: async (client, message, args) => {
    if (!hasPermissionLevel(client, message, 5)) {
      return reply(message, errorContainer('**Permission insuffisante** — Niveau 5 (Manager) requis.'));
    }

    const msg = args.join(' ');
    if (!msg || msg.length < 3) {
      return reply(message, errorContainer('**Usage :** `!dmall <message>`'));
    }

    let membersCollection;
    try { membersCollection = await message.guild.members.fetch({ withPresences: false, force: true }); }
    catch (_) { membersCollection = await message.guild.members.fetch(); }

    const targets = membersCollection.filter(m => !m.user.bot);
    const total = targets.size;
    const preview = msg.length > 60 ? msg.slice(0, 60) + '…' : msg;

    const confirmMsg = await reply(message, container(
      txt('## ⚠️ Envoi MP en masse'),
      sep(),
      txt(
        `Vous allez envoyer un MP à **${total.toLocaleString('fr-FR')} membres**.\n` +
        `Message : *"${preview}"*\n` +
        `Cette action est **irréversible**.`
      ),
      sep(),
      row(
        btn('dmall_confirm', 'Confirmer l\'envoi', ButtonStyle.Success),
        btn('dmall_cancel', 'Annuler', ButtonStyle.Secondary)
      )
    ));

    const collector = confirmMsg.createMessageComponentCollector({
      filter: i => i.user.id === message.author.id,
      time: 30000,
      max: 1
    });

    collector.on('collect', async i => {
      if (i.customId === 'dmall_cancel') {
        return i.update({
          components: [container(txt('## ❌ Annulé'), sep(), txt('Envoi de MP annulé.'))],
          flags: FLAGS
        });
      }

      await i.update({
        components: [container(
          txt('## 📨 Envoi en cours...'),
          sep(),
          txt(`Envoi des messages privés à **${total.toLocaleString('fr-FR')} membres**...`)
        )],
        flags: FLAGS
      });

      let success = 0, failed = 0;
      const BATCH_SIZE = 50, BATCH_DELAY = 12000, MIN_DELAY = 700, MAX_DELAY = 1800;
      const membersArray = Array.from(targets.values());
      const startTime = Date.now();

      for (let idx = 0; idx < membersArray.length; idx += BATCH_SIZE) {
        const batch = membersArray.slice(idx, idx + BATCH_SIZE);
        await Promise.all(batch.map(async (member) => {
          try {
            const dmChannel = await member.createDM().catch(() => null);
            if (!dmChannel) { failed++; return; }
            await dmChannel.send(msg).then(() => success++).catch((error) => {
              if (error.code === 50007) failed++;
              else if (error.code === 20028) return new Promise(res => setTimeout(res, 60000));
              else { logger.error(`Erreur DM ${member.user.tag}:`, error); failed++; }
            });
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY));
          } catch { failed++; }
        }));

        if (idx + BATCH_SIZE < membersArray.length) await new Promise(res => setTimeout(res, BATCH_DELAY));

        const done = success + failed;
        try {
          await confirmMsg.edit({
            components: [container(
              txt('## 📨 Envoi en cours...'),
              sep(),
              txt(
                `**Progression :** ${done.toLocaleString('fr-FR')}/${total.toLocaleString('fr-FR')}\n` +
                `**Réussis :** ${success} ✓\n` +
                `**Échecs :** ${failed} ✗`
              )
            )],
            flags: FLAGS
          });
        } catch {}
      }

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      await confirmMsg.edit({
        components: [container(
          txt('## ✅ Envoi terminé'),
          sep(),
          txt([
            `**Envoyés :** ${success.toLocaleString('fr-FR')} / ${total.toLocaleString('fr-FR')}`,
            `**Échecs (DMs fermés) :** ${failed}`,
            `**Durée :** ${elapsed} secondes`,
            `**Effectué par :** ${message.author}`
          ].join('\n'))
        )],
        flags: FLAGS
      });
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        confirmMsg.edit({
          components: [container(
            txt('## ⏱️ Délai expiré'),
            sep(),
            txt('La confirmation a expiré — envoi annulé.')
          )],
          flags: FLAGS
        }).catch(() => {});
      }
    });
  }
};
