const Discord = require('discord.js');
const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'servericon', aliases: ['sav', 'guildavatar', 'serveravatar', 'icone'],
  description: "Affiche l'icône du serveur",
  run: async (client, message) => {
    let hasPermission = false;
    if (message.member) { message.member.roles.cache.forEach(r => { if (db.get(`ownerp_${message.guild.id}_${r.id}`) || db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`modsp_${message.guild.id}_${r.id}`)) hasPermission = true; }); }
    const allowed = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true || hasPermission || db.get(`channelpublic_${message.guild.id}_${message.channel.id}`) === true;
    if (!allowed) return reply(message, errorContainer('Permission refusée.'));
    if (!message.guild.iconURL()) return reply(message, errorContainer("Ce serveur ne possède pas d'icône."));
    const iconURL = message.guild.iconURL({ extension: 'png', size: 4096, forceStatic: false });
    const formats = [
      { label: 'PNG',  url: message.guild.iconURL({ extension: 'png',  size: 4096 }) },
      { label: 'JPG',  url: message.guild.iconURL({ extension: 'jpg',  size: 4096 }) },
      { label: 'WEBP', url: message.guild.iconURL({ extension: 'webp', size: 4096 }) },
      { label: 'GIF',  url: message.guild.iconURL({ extension: 'gif',  size: 4096 }) },
    ].filter(f => f.url);
    const links = formats.map(f => `[${f.label}](${f.url})`).join(' · ');
    const row = new Discord.ActionRowBuilder().addComponents(new Discord.ButtonBuilder().setLabel('Télécharger').setURL(iconURL).setStyle(Discord.ButtonStyle.Link).setEmoji('📥'));
    await message.channel.send({ components: [container(txt(`## 🖼️ Icône du serveur — ${message.guild.name}`), sep(), txt(`**Télécharger :** ${links}`)), row], flags: FLAGS }).catch(() => {});
  }
};
