const db = require('../../utils/simpledb');
const math = require('mathjs');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'calc',
  aliases: ['calculator', 'math'],
  description: 'Calcule une expression mathématique',
  run: async (client, message, args) => {
    let perm = false;
    message.member.roles.cache.forEach(role => { if (db.get(`modsp_${message.guild.id}_${role.id}`)) perm = true; if (db.get(`ownerp_${message.guild.id}_${role.id}`)) perm = true; });
    const allowed = (client.config.superadmin?.includes(message.author.id)) || (client.config.owners?.includes(message.author.id)) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true || perm || db.get(`channelpublic_${message.guild.id}_${message.channel.id}`) === true;
    if (!allowed) return;
    if (!args.length) return message.react('❌');
    try {
      const result = math.evaluate(args.join(' '));
      await reply(message, container(txt('## 🔢 Calculatrice'), sep(), txt(`**Expression :** \`${args.join(' ')}\`\n**Résultat :** \`\`\`${result}\`\`\``)));
    } catch (err) {
      await reply(message, errorContainer('Format invalide.'));
    }
  }
};
