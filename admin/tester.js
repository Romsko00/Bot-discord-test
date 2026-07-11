const ms = require('ms');
const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { isBotOwner } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'tester',
  aliases: ['granttemp', 'tempperm'],
  description: 'Accorde temporairement des permissions à un utilisateur dans un salon',
  usage: '<@user|id> [#salon|id] [durée] | show <@user> [#salon] | off <@user> [#salon]',
  category: 'admin',
  level: 7,
  run: async (client, message, args) => {
    try {
      if (!isBotOwner(client, message)) {
        return reply(message, errorContainer('**Permission insuffisante** — Bot Owner requis.'));
      }

      const sub = (args[0] || '').toLowerCase();
      const resolveUserId = (s) => s?.replace(/<@!?([0-9]+)>/, '$1');
      const resolveChannelFromArg = (arg) => {
        if (!arg) return null;
        if (/^\d{15,20}$/.test(arg)) return message.guild.channels.cache.get(arg) || null;
        if (/^<#(\d+)>$/.test(arg)) return message.guild.channels.cache.get(arg.replace(/[^0-9]/g, '')) || null;
        return null;
      };

      if (sub === 'show' || sub === 'off') {
        const userArg = args[1];
        if (!userArg) return reply(message, errorContainer(`**Usage :** \`!tester ${sub} <@user|id> [#salon]\``));
        const userId = resolveUserId(userArg);
        if (!/^\d{15,20}$/.test(userId)) return reply(message, errorContainer('**Utilisateur invalide.**'));
        const channel = message.mentions.channels.first() || resolveChannelFromArg(args[2]) || message.channel;
        const key = `tempperm_${message.guild.id}_${userId}_${channel.id}`;
        const perm = db.get(key);

        if (sub === 'off') {
          if (!perm) return reply(message, errorContainer('Aucune permission temporaire trouvée.'));
          db.delete(key);
          return reply(message, container(txt('## ✅ Permissions révoquées'), sep(), txt(`Permissions de <@${userId}> dans ${channel} révoquées.`)));
        }

        if (!perm) return reply(message, errorContainer('Aucune permission temporaire active pour cet utilisateur.'));
        const remaining = Math.max(0, perm.expires - Date.now());
        return reply(message, container(txt('## ⏱️ Temps Restant'), sep(), txt(`**Utilisateur :** <@${userId}>\n**Salon :** ${channel}\n**Temps restant :** ${ms(remaining, { long: true })}`)));
      }

      const userArg = args[0];
      if (!userArg) return reply(message, errorContainer('**Usage :** `!tester <@user|id> [#salon] [durée]`\n**Sous-commandes :** `show`, `off`'));
      const userId = resolveUserId(userArg);
      if (!/^\d{15,20}$/.test(userId)) return reply(message, errorContainer('**Utilisateur invalide.**'));

      let channel = message.mentions.channels.first();
      let durationArg;
      if (channel) {
        durationArg = args[2];
      } else if (args[1]) {
        if (/^\d{15,20}$/.test(args[1]) || /^<#(\d+)>$/.test(args[1])) {
          channel = resolveChannelFromArg(args[1]);
          durationArg = args[2];
        } else {
          durationArg = args[1];
        }
      }
      if (!channel) channel = message.channel;
      if (!channel || !channel.isTextBased()) return reply(message, errorContainer('**Salon invalide.**'));

      let durationMs = ms(durationArg || '30m');
      if (!durationMs || durationMs < ms('1m')) return reply(message, errorContainer('**Durée invalide.** Minimum 1 minute. Ex: `15m`, `1h`'));
      if (durationMs > ms('24h')) return reply(message, errorContainer('**Durée trop longue.** Maximum 24h.'));

      const key = `tempperm_${message.guild.id}_${userId}_${channel.id}`;
      db.set(key, { expires: Date.now() + durationMs, grantedBy: message.author.id });
      const humanDur = durationArg || '30m';

      await reply(message, container(
        txt('## ✅ Permissions Temporaires Accordées'),
        sep(),
        txt([
          `**Utilisateur :** <@${userId}>`,
          `**Salon :** ${channel}`,
          `**Durée :** ${humanDur}`,
          `**Accordé par :** ${message.author}`
        ].join('\n'))
      ));

      setTimeout(() => {
        try {
          db.delete(key);
          channel.send(`<@${userId}>, vos permissions temporaires ont expiré.`).catch(() => {});
        } catch (_) {}
      }, durationMs);
    } catch {
      return reply(message, errorContainer('**Erreur interne** lors de l\'exécution.'));
    }
  }
};
