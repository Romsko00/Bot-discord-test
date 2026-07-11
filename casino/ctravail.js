const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const Jobs = require('../../utils/jobs');

module.exports = {
  name: 'ctravail',
  aliases: ['cjob', 'cjobs', 'travail', 'job'],
  description: 'Système de travail pour gagner des crédits',
  usage: '+ctravail list | +ctravail choisir <métier> | +ctravail travailler',
  category: 'casino',
  run: async (client, message, args) => {
    if (!message.guild) return;
    const sub = (args[0] || 'list').toLowerCase();
    const uid = message.author.id;
    if (sub === 'list') {
      const jobs = Jobs.listJobs();
      const lines = jobs.map(j => `**${j.name}** — ${j.dailyMin === j.dailyMax ? j.dailyMin : `${j.dailyMin}-${j.dailyMax}`} JTN/jour | Compétence: ${j.skill}\n${j.desc || ''}`);
      return reply(message, container(txt('## 🛠️ Métiers Disponibles'), sep(), txt(lines.join('\n\n') || 'Aucun métier défini')));
    }
    if (sub === 'choisir') {
      const name = (args[1] || '').toLowerCase();
      if (!name) return reply(message, errorContainer('Usage: `+ctravail choisir <métier>`'));
      const can = Jobs.canChangeJob(uid, 7);
      if (!can.ok) return reply(message, errorContainer(`Changement possible dans ${Math.ceil(can.remaining / 86400000)} jour(s).`));
      const r = Jobs.setUserJob(uid, name);
      if (!r.ok) return reply(message, errorContainer(r.error));
      return reply(message, container(txt('## ✅ Métier Choisi'), sep(), txt(`**${r.job.name}** — Compétence: ${r.job.skill}`)));
    }
    if (sub === 'travailler') {
      const r = Jobs.work(uid);
      if (!r.ok) return reply(message, errorContainer(r.error));
      return reply(message, container(txt('## 🛠️ Travail Effectué'), sep(), txt([`**Métier :** ${r.job.name}`, `**Gain :** ${r.reward} JTN`].join('\n'))));
    }
    return reply(message, errorContainer('Usage: `+ctravail list` | `+ctravail choisir <métier>` | `+ctravail travailler`'));
  }
};
