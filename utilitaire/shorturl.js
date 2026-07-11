const axios = require('axios');
const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'shorturl', aliases: ['short', 'url'],
  description: 'Raccourcit une URL', level: 0,
  run: async (client, message, args) => {
    let perm = false;
    message.member.roles.cache.forEach(r => { if (db.get(`modsp_${message.guild.id}_${r.id}`) || db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
    const allowed = perm || client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) || db.get(`channelpublic_${message.guild.id}_${message.channel.id}`);
    if (!allowed) return reply(message, errorContainer('Permission refusée.'));
    const url = args[0]; if (!url) return reply(message, errorContainer('Veuillez fournir une URL.'));
    try { new URL(url); } catch { return reply(message, errorContainer('URL invalide.')); }
    try {
      let apiUrl = `https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`;
      if (args[1]) apiUrl += `&shorturl=${encodeURIComponent(args[1])}`;
      const res = await axios.get(apiUrl);
      if (res.data.errorcode) return reply(message, errorContainer(`Erreur : ${res.data.errormessage}`));
      await reply(message, container(txt('## 🔗 URL Raccourcie'), sep(), txt([`**URL Originale :** ${url}`, `**URL Raccourcie :** ${res.data.shorturl}`, `*Raccourci par ${message.author.tag}*`].join('\n'))));
    } catch (e) { console.error(e); await reply(message, errorContainer("Erreur lors du raccourcissement de l'URL.")); }
  }
};
