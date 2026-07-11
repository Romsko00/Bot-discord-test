const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const { hasPermissionLevel, AccessLevels } = require('../../utils/permissionUtils');

const GHOST_DURATION_MS = 1600;

module.exports = {
  name: 'ghost',
  aliases: ['ghostping'],
  description: 'Lance un ghostping sur l\'ensemble des membres du serveur',
  usage: '[répétitions]',
  category: 'admin',
  level: 6,
  run: async (client, message, args) => {
    if (!hasPermissionLevel(client, message, AccessLevels ? AccessLevels.PERM6 : 6)) {
      return reply(message, errorContainer('**Permission insuffisante** — Niveau 6 (Owner) requis.'));
    }

    const repetitions = Math.min(100, Math.max(1, parseInt(args[0]) || 1));
    const guild = message.guild;
    const executor = message.author;

    await reply(message, container(
      txt('## 👻 Ghostping — Initialisation'),
      sep(),
      txt([
        `**Répétitions planifiées :** ${repetitions}`,
        `**Délai par ping :** ${GHOST_DURATION_MS}ms`,
        `**Exécuté par :** ${executor}`
      ].join('\n'))
    ));

    await guild.members.fetch();
    const members = guild.members.cache.filter(m => !m.user.bot);
    let totalPings = 0, errors = 0;

    for (let cycle = 0; cycle < repetitions; cycle++) {
      for (const [, member] of members) {
        try {
          const msg = await message.channel.send(`<@${member.id}>`);
          await new Promise(resolve => setTimeout(resolve, GHOST_DURATION_MS));
          await msg.delete().catch(() => {});
          totalPings++;
        } catch { errors++; }
      }
    }

    await executor.send({
      components: [container(
        txt('## 👻 Ghostping — Récapitulatif'),
        sep(),
        txt([
          `**Serveur :** ${guild.name}`,
          `**Membres ciblés/cycle :** ${members.size}`,
          `**Cycles exécutés :** ${repetitions}`,
          `**Total pings :** ${totalPings}`,
          `**Erreurs :** ${errors}`
        ].join('\n'))
      )],
      flags: FLAGS
    }).catch(() => {});
  }
};
