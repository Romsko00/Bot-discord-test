const db = require('../../utils/simpledb');
const Teams = require('../../utils/casinoTeams');
const Casino = require('../../utils/casino');

function isSameDay(tsA, tsB) {
  const a = new Date(tsA); const b = new Date(tsB);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startTeamPayrollScheduler(client) {
  // Run every 30 minutes
  setInterval(async () => {
    try {
      const now = Date.now();
      client.guilds.cache.forEach(async (guild) => {
        try {
          if (typeof client.isResponsibleForGuild === 'function' && !client.isResponsibleForGuild(guild.id)) return;
          const teams = Teams.listTeams(guild.id);
          for (const team of teams) {
            try {
              const payroll = Number(team.payroll || 0);
              if (!payroll || payroll <= 0) continue;
              // Only once per day
              if (team.lastPayrollAt && isSameDay(team.lastPayrollAt, now)) continue;

              // Determine active members (played in last 24h)
              const activeCut = now - 24 * 60 * 60 * 1000;
              const members = Array.isArray(team.members) ? team.members : [];
              const activeMembers = members.filter(uid => (db.get(`casino_last_play_${uid}`) || 0) >= activeCut);
              if (activeMembers.length === 0) {
                team.lastPayrollAt = now;
                Teams.saveTeam(team);
                continue;
              }
              const total = payroll * activeMembers.length;
              if ((team.bank || 0) < total) {
                // Not enough funds; skip but mark attempt in logs
                Teams.saveTeam(Object.assign(team, { lastPayrollAt: now }));
                Teams.customize(team, team.leaderId, {}); // no-op triggers save and log path isn't ideal; instead log directly
                // Better explicit log
                team.logs = [{ ts: now, type: 'payroll_skip_funds', needed: total, bank: team.bank }, ...(team.logs || [])].slice(0, 200);
                Teams.saveTeam(team);
                continue;
              }
              // Payout
              team.bank = (team.bank || 0) - total;
              Teams.saveTeam(team);
              for (const uid of activeMembers) {
                Casino.addCasinoCredits(uid, payroll);
              }
              team.lastPayrollAt = now;
              team.logs = [{ ts: now, type: 'payroll', count: activeMembers.length, payroll, total }, ...(team.logs || [])].slice(0, 200);
              Teams.saveTeam(team);

              // Optional notify channel
              const notifyChId = db.get(`casino_notify_${guild.id}`);
              if (notifyChId) {
                const ch = guild.channels.cache.get(notifyChId);
                if (ch && ch.isTextBased()) {
                  const name = team.name || 'Team';
                  ch.send(`💸 Paie journalière: ${name} — ${activeMembers.length} membres actifs ont reçu ${payroll} jetons chacun. Banque restante: ${team.bank}`)
                    .catch(() => {});
                }
              }
            } catch (e) {
              console.error('[TeamPayroll] team loop error', team?.id, e);
            }
          }
        } catch (e) {
          console.error('[TeamPayroll] guild loop error', guild?.id, e);
        }
      });
    } catch (e) {
      console.error('[TeamPayroll] scheduler error', e);
    }
  }, 30 * 60 * 1000);
}

module.exports = { startTeamPayrollScheduler };
