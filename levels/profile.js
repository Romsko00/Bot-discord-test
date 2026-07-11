const { container, txt, sep, section, reply, errorContainer, formatNumber, progress, FLAGS, btn, row, ButtonStyle } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'profile',
  aliases: ['level', 'rankview', 'pr', 'profil'],
  description: 'Affiche le profil complet d\'un membre (niveau, XP, stats, rôle)',
  usage: '[@membre]',
  category: 'levels',
  level: 0,

  run: async (client, message, args) => {
    try {
      let target;
      if (args[0]) {
        target = message.mentions.members.first()
          || await message.guild.members.fetch(args[0].replace(/\D/g, '')).catch(() => null);
        if (!target) return reply(message, errorContainer('Membre introuvable.'));
      } else {
        target = message.member;
      }

      if (!target?.user) return reply(message, errorContainer('Impossible de récupérer le profil.'));
      if (target.user.bot) return reply(message, errorContainer('Les bots n\'ont pas de profil.'));

      const guildId = message.guild.id;
      const userId  = target.user.id;

      const xp            = parseInt(db.get(`guild_${guildId}_xp_${userId}`))       || 0;
      const level         = parseInt(db.get(`guild_${guildId}_level_${userId}`))     || 1;
      const totalMessages = parseInt(db.get(`msg_${guildId}_${userId}`))             || 0;
      const credits       = parseInt(db.get(`credits_${guildId}_${userId}`))
                          || parseInt(db.get(`user_credits_${userId}`))              || 0;
      const vocalTime     = parseInt(db.get(`vocal_time_${guildId}_${userId}`))      || 0;
      const xpNeeded      = level * 500;
      const progressBar   = progress(xp, xpNeeded, 18);

      let rankPosition = 'N/A';
      try {
        const allXp = db.all().filter(d => d.ID.startsWith(`guild_${guildId}_xp_`))
          .sort((a, b) => (b.data || 0) - (a.data || 0));
        const idx = allXp.findIndex(d => d.ID === `guild_${guildId}_xp_${userId}`);
        if (idx !== -1) rankPosition = `#${idx + 1} / ${allXp.length}`;
      } catch {}

      let vocalStr = 'N/A';
      if (vocalTime > 0) {
        const h = Math.floor(vocalTime / 3600);
        const m = Math.floor((vocalTime % 3600) / 60);
        vocalStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
      }

      const topRole = target.roles.cache
        .filter(r => r.id !== message.guild.id)
        .sort((a, b) => b.position - a.position)
        .first();

      const joinedDate = target.joinedAt
        ? target.joinedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '?';

      const createdDate = target.user.createdAt
        ? target.user.createdAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '?';

      const pct = xpNeeded > 0 ? Math.round((xp / xpNeeded) * 100) : 0;

      return reply(message, container(
        txt(`## Profil — ${target.user.username}`),
        sep(),
        txt([
          `**Classement :** ${rankPosition}`,
          `**Niveau :** ${level}`,
          `**Rôle principal :** ${topRole ? topRole.toString() : 'Aucun'}`,
        ].join('\n')),
        sep(),
        txt([
          `**Messages :** ${formatNumber(totalMessages)}`,
          `**Crédits :** ${formatNumber(credits)}`,
          `**Vocal :** ${vocalStr}`,
        ].join('\n')),
        sep(),
        txt([
          `**XP :** ${formatNumber(xp)} / ${formatNumber(xpNeeded)} (${pct}%)`,
          progressBar,
        ].join('\n')),
        sep(),
        txt([
          `**Membre depuis :** ${joinedDate}`,
          `**Compte créé le :** ${createdDate}`,
          `**ID :** \`${userId}\``,
        ].join('\n'))
      ));

    } catch (error) {
      console.error('[profile]', error);
      return reply(message, errorContainer('Erreur lors de la génération du profil.'));
    }
  }
};
