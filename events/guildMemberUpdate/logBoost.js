const LogSystem = require('../../utils/logSystem');

module.exports = async (client, oldMember, newMember) => {
  const logSystem = new LogSystem(client);

  const oldBoosting = oldMember.premiumSince;
  const newBoosting = newMember.premiumSince;

  if (!oldBoosting && newBoosting) {
    await logSystem.logBoost(newMember.guild, 'boost', newMember.user);

    // ── Message de boost personnalisé ──────────────────────────────────────
    try {
      const boostmsg = client.commands?.get('boostmsg');
      if (boostmsg?.handleBoostEvent) {
        await boostmsg.handleBoostEvent(client, newMember.guild, newMember);
      }
    } catch (e) {
      console.error('[boostmsg] Erreur event:', e);
    }

  } else if (oldBoosting && !newBoosting) {
    await logSystem.logBoost(newMember.guild, 'unboost', newMember.user);
  }
};
