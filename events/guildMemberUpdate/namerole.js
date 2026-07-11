const db = require('../../utils/simpledb');

module.exports = async (client, oldMember, newMember) => {
  try {
    const oldNick = oldMember.nickname || oldMember.user.username;
    const newNick = newMember.nickname || newMember.user.username;
    if (oldNick === newNick) return;

    const guildId = newMember.guild.id;
    const cfg = db.get(`namerole_${guildId}`);
    if (!cfg || !cfg.enabled || !cfg.keyword || !cfg.roleId) return;

    const role = newMember.guild.roles.cache.get(cfg.roleId);
    if (!role) return;

    const hasKeyword = newNick.toLowerCase().includes(cfg.keyword.toLowerCase());
    const hasRole = newMember.roles.cache.has(cfg.roleId);

    if (hasKeyword && !hasRole) {
      await newMember.roles.add(role, `[NamerRole] Pseudo contient "${cfg.keyword}"`).catch(() => {});
    } else if (!hasKeyword && hasRole) {
      await newMember.roles.remove(role, `[NamerRole] Pseudo ne contient plus "${cfg.keyword}"`).catch(() => {});
    }
  } catch (err) {
    console.error('[namerole] guildMemberUpdate error:', err);
  }
};
