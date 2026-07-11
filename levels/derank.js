const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'derank',
  description: 'Fait descendre un membre d\'un rang ou descend tout le monde',
  usage: '@user|all [niveau]',
  level: 5,
  run: async (client, message, args) => {
    try {
      const sub = (args[0] || '').toLowerCase();
      const guildId = message.guild.id;
      const rewardEntries = db.all().filter(d => d.ID.startsWith(`rewardlevel_${guildId}_`));
      const levelMap = new Map();
      for (const e of rewardEntries) {
        const parts = e.ID.split('_'), roleId = parts[2], lvl = parseInt(parts[3]);
        if (!levelMap.has(lvl)) levelMap.set(lvl, []);
        levelMap.get(lvl).push(roleId);
      }
      const sortedLevels = Array.from(levelMap.keys()).sort((a, b) => a - b);

      if (sub === 'all') {
        if (!hasPermissionLevel(client, message, 6)) return reply(message, errorContainer('**Permission insuffisante** — Niveau 6 requis.'));
        if (!sortedLevels.length) return reply(message, errorContainer('Aucun rang configuré.'));
        const members = message.guild.members.cache.filter(m => !m.user.bot);
        let processed = 0;
        for (const member of members.values()) {
          let userLevel = 0;
          for (const lvl of sortedLevels) { const roleIds = levelMap.get(lvl) || []; for (const rid of roleIds) if (member.roles.cache.has(rid)) userLevel = Math.max(userLevel, lvl); }
          if (!userLevel) continue;
          const idx = sortedLevels.indexOf(userLevel), prevLevel = sortedLevels[idx - 1];
          const allRewardRoleIds = new Set(rewardEntries.map(e => e.ID.split('_')[2]));
          const toRemove = member.roles.cache.filter(r => allRewardRoleIds.has(r.id)).map(r => r.id);
          if (toRemove.length) await member.roles.remove(toRemove).catch(() => {});
          if (typeof prevLevel !== 'undefined') {
            const cands = (levelMap.get(prevLevel) || []).map(rid => message.guild.roles.cache.get(rid)).filter(Boolean).sort((a, b) => b.position - a.position);
            if (cands[0]) await member.roles.add(cands[0]).catch(() => {});
          }
          processed++;
          await new Promise(r => setTimeout(r, 50));
        }
        return reply(message, container(txt('## ✅ Derank Global Terminé'), sep(), txt(`**Membres traités :** ${processed}`)));
      }

      if (!hasPermissionLevel(client, message, 5)) return reply(message, errorContainer('**Permission insuffisante** — Niveau 5 requis.'));
      const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
      if (!target) return reply(message, errorContainer('**Usage :** `!derank @membre [niveau]` ou `!derank all`'));
      if (!sortedLevels.length) return reply(message, errorContainer('Aucun rang configuré.'));

      let userLevel = 0;
      for (const lvl of sortedLevels) { const roleIds = levelMap.get(lvl) || []; for (const rid of roleIds) if (target.roles.cache.has(rid)) userLevel = Math.max(userLevel, lvl); }
      if (!userLevel) return reply(message, errorContainer(`${target} n'a pas de rang configuré.`));

      const idx = sortedLevels.indexOf(userLevel), prevLevel = sortedLevels[idx - 1];
      const allRewardRoleIds = new Set(rewardEntries.map(e => e.ID.split('_')[2]));
      const toRemove = target.roles.cache.filter(r => allRewardRoleIds.has(r.id)).map(r => r.id);
      if (toRemove.length) await target.roles.remove(toRemove).catch(() => {});

      if (typeof prevLevel === 'undefined') {
        return reply(message, container(txt('## ✅ Rang Retiré'), sep(), txt(`${target} a été retiré de son rang (plus bas).`)));
      }
      const cands = (levelMap.get(prevLevel) || []).map(rid => message.guild.roles.cache.get(rid)).filter(Boolean).sort((a, b) => b.position - a.position);
      if (!cands[0]) return reply(message, errorContainer('Rôle invalide pour le rang précédent.'));
      await target.roles.add(cands[0]);
      return reply(message, container(txt('## ✅ Rang Rétrogradé'), sep(), txt([`**Membre :** ${target}`, `**Nouveau rang :** ${cands[0]} (niveau ${prevLevel})`].join('\n'))));
    } catch (error) {
      console.error('[derank]', error);
      return reply(message, errorContainer('Erreur lors de la modification du rang.'));
    }
  }
};
