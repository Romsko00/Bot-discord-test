const Discord = require('discord.js');
const db = require('../../utils/simpledb');
const fs = require('fs').promises;
const path = require('path');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'archive', aliases: ['backupchat'],
  description: 'Archive des messages', level: 0,
  run: async (client, message, args) => {
    let perm = false;
    message.member.roles.cache.forEach(r => { if (db.get(`modsp_${message.guild.id}_${r.id}`) || db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
    const allowed = perm || client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`);
    if (!allowed) return reply(message, errorContainer('Permission refusée.'));
    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]) || message.channel;
    const limit = parseInt(args[1]) || 100;
    if (limit > 1000) return reply(message, errorContainer('La limite maximale est de 1000 messages.'));
    await message.reply(`📦 Archivage des ${limit} derniers messages...`);
    try {
      const messages = await channel.messages.fetch({ limit });
      const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      let archiveContent = `Archive du salon: ${channel.name}\nServeur: ${message.guild.name}\nDate: ${new Date().toLocaleString('fr-FR')}\nTotal messages: ${messages.size}\n${'='.repeat(50)}\n\n`;
      sorted.forEach(msg => {
        archiveContent += `[${msg.createdAt.toLocaleString('fr-FR')}] ${msg.author.tag}: ${msg.content.replace(/```/g, '´´´')}\n`;
        if (msg.attachments.size > 0) msg.attachments.forEach(a => { archiveContent += `[PIÈCE JOINTE] ${a.url}\n`; });
        if (msg.embeds.length > 0) archiveContent += `[EMBED] ${msg.embeds[0].title || 'Sans titre'}\n`;
        archiveContent += '\n';
      });
      const archiveDir = path.join(__dirname, '..', '..', 'archives');
      await fs.mkdir(archiveDir, { recursive: true });
      const fileName = `archive_${channel.id}_${Date.now()}.txt`;
      const filePath = path.join(archiveDir, fileName);
      await fs.writeFile(filePath, archiveContent);
      await reply(message, container(
        txt('## ✅ Archive Créée'),
        sep(),
        txt([`**Salon :** ${channel}`, `**Messages :** ${messages.size}`, `**Fichier :** \`${fileName}\``].join('\n')),
        sep(),
        txt(`*Archivé par ${message.author.tag}*`)
      ));
      await message.channel.send({ files: [{ attachment: filePath, name: fileName }] });
      setTimeout(async () => { try { await fs.unlink(filePath); } catch {} }, 60000);
    } catch (e) { console.error('Archive error:', e); await reply(message, errorContainer("Erreur lors de l'archivage.")); }
  }
};
