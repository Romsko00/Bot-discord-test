const { container, txt, sep, reply } = require('../../utils/v2');
const Jobs = require('../../utils/jobs');

module.exports = {
  name: 'cskills',
  aliases: ['ccomp', 'skills', 'competences'],
  description: 'Compétences et améliorations du casino',
  usage: '+cskills',
  category: 'casino',
  run: async (client, message, args) => {
    if (!message.guild) return;
    const uid = message.author.id;
    const skills = Jobs.getSkills(uid);
    const job = Jobs.getUserJob(uid);
    const lines = Object.entries(skills).sort((a, b) => b[1] - a[1]).map(([k, v]) => `• **${k}** — niveau ${v}`);
    return reply(message, container(
      txt('## 📈 Compétences Casino'),
      sep(),
      txt([lines.join('\n') || 'Aucune compétence', '', `**Métier actuel :** ${job?.name || 'Aucun'}`].join('\n'))
    ));
  }
};
