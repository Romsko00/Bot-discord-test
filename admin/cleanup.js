const fs = require('fs');
const path = require('path');
const { container, txt, sep, row, btn, reply, errorContainer, FLAGS, ButtonStyle } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');

module.exports = {
  name: 'cleanup',
  aliases: ['clean'],
  description: 'Nettoie les fichiers temporaires du bot',
  category: 'admin',
  level: 5,
  run: async (client, message) => {
    if (!hasPermissionLevel(client, message, 4)) {
      return reply(message, errorContainer('**Permission insuffisante** — Niveau 4 requis.'));
    }

    const tempDir = path.join(__dirname, '../../temp');

    if (!fs.existsSync(tempDir)) {
      return reply(message, container(
        txt('## 🧹 Nettoyage'),
        sep(),
        txt('Le dossier `temp/` est inexistant ou déjà vide.')
      ));
    }

    let files = [];
    let totalSize = 0;
    try {
      files = fs.readdirSync(tempDir);
      for (const file of files) {
        try {
          const stat = fs.statSync(path.join(tempDir, file));
          totalSize += stat.size;
        } catch {}
      }
    } catch {
      return reply(message, errorContainer('**Erreur** lors de la lecture du dossier `temp/`.'));
    }

    if (files.length === 0) {
      return reply(message, container(
        txt('## 🧹 Nettoyage'),
        sep(),
        txt('Le dossier `temp/` est déjà vide, rien à supprimer.')
      ));
    }

    const sizeMo = (totalSize / (1024 * 1024)).toFixed(1);

    const confirmMsg = await reply(message, container(
      txt('## ⚠️ Confirmation requise'),
      sep(),
      txt(
        `Vous allez supprimer tous les fichiers du dossier \`temp/\`.\n` +
        `**Fichiers :** **${files.length}** fichier${files.length > 1 ? 's' : ''}, **${sizeMo} Mo**\n` +
        `Cette action est **irréversible**.`
      ),
      sep(),
      row(
        btn('cleanup_confirm', 'Confirmer', ButtonStyle.Danger),
        btn('cleanup_cancel', 'Annuler', ButtonStyle.Secondary)
      )
    ));

    const collector = confirmMsg.createMessageComponentCollector({
      filter: i => i.user.id === message.author.id,
      time: 30000,
      max: 1
    });

    collector.on('collect', async i => {
      if (i.customId === 'cleanup_cancel') {
        return i.update({
          components: [container(txt('## ❌ Annulé'), sep(), txt('Nettoyage annulé.'))],
          flags: FLAGS
        });
      }

      await i.deferUpdate();
      let deletedCount = 0;
      for (const file of files) {
        try { fs.unlinkSync(path.join(tempDir, file)); deletedCount++; } catch {}
      }

      await confirmMsg.edit({
        components: [container(
          txt('## ✅ Nettoyage effectué'),
          sep(),
          txt([
            `**Fichiers supprimés :** ${deletedCount}`,
            `**Espace libéré :** ${sizeMo} Mo`,
            `**Dossier :** \`temp/\``,
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
            txt('La confirmation a expiré — nettoyage annulé.')
          )],
          flags: FLAGS
        }).catch(() => {});
      }
    });
  }
};
