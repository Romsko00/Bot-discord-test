const Discord = require('discord.js');
const QRCode = require('qrcode');
const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'qrcode', aliases: ['qr'],
  description: 'Génère un code QR', level: 0,
  run: async (client, message, args) => {
    let perm = false;
    message.member.roles.cache.forEach(r => { if (db.get(`modsp_${message.guild.id}_${r.id}`) || db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
    const allowed = perm || client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) || db.get(`channelpublic_${message.guild.id}_${message.channel.id}`);
    if (!allowed) return reply(message, errorContainer('Permission refusée.'));
    const text = args.join(' ');
    if (!text) return reply(message, errorContainer('Veuillez fournir un texte ou une URL.'));
    try {
      const qrBuffer = await QRCode.toBuffer(text, { width: 400, margin: 2, color: { dark: '#000000', light: '#FFFFFF' } });
      const attachment = new Discord.AttachmentBuilder(qrBuffer, { name: 'qrcode.png' });
      await message.reply({ components: [container(txt('## 📱 QR Code Généré'), sep(), txt(`**Contenu :** ${text}`))], files: [attachment], flags: FLAGS });
    } catch (e) {
      console.error(e);
      await reply(message, errorContainer('Erreur lors de la génération du QR code.'));
    }
  }
};
