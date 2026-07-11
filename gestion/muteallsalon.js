const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'muteallsalon',
  aliases: [],
  description: "Désactive l'envoi de messages pour @everyone sur tous les salons textuels",
  category: 'gestion',
  run: async (client, message, args) => {
    const isOwner = client.config.owners?.includes(message.author.id) || client.config.superadmin?.includes(message.author.id) || db.get(`ownerp_${message.guild.id}_${message.author.id}`) || message.author.id === message.guild.ownerId;
    if (!isOwner) return reply(message, errorContainer("Vous n'avez pas la permission."));
    const action = args[0] === 'off' ? 'off' : 'on';
    const everyone = message.guild.roles.everyone;
    const msg = await message.channel.send({ components: [container(txt(`## ⏳ ${action==='on'?'Mute':'Unmute'} en cours…`), sep(), txt('Traitement de tous les salons textuels...'))], flags: FLAGS });
    const channels = message.guild.channels.cache.filter(c => c.isTextBased() && c.manageable);
    let count = 0;
    for (const [, channel] of channels) {
      try { await channel.permissionOverwrites.edit(everyone, { SendMessages: action==='on' ? false : null }); count++; } catch {}
    }
    await msg.edit({ components: [container(txt(`## 🔇 Mute All Salon`), sep(), txt(`**${count}** salons ont été **${action==='on'?'mutés':'unmutés'}** pour @everyone.`))], flags: FLAGS }).catch(()=>{});
  }
};
