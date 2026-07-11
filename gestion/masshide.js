const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'masshide',
  aliases: [],
  description: 'Masque/affiche tous les salons pour @everyone',
  category: 'gestion',
  run: async (client, message, args) => {
    const isOwner = client.config.owners?.includes(message.author.id) || client.config.superadmin?.includes(message.author.id) || db.get(`ownerp_${message.guild.id}_${message.author.id}`) || message.author.id === message.guild.ownerId;
    if (!isOwner) return reply(message, errorContainer("Vous n'avez pas la permission."));
    const action = args[0] === 'off' ? 'off' : 'on';
    const everyoneRole = message.guild.roles.everyone;
    const msg = await message.channel.send({ components: [container(txt(`## ⏳ ${action==='on'?'Masquage':'Affichage'} en cours…`), sep(), txt('Traitement de tous les salons...'))], flags: FLAGS });
    const channels = message.guild.channels.cache.filter(c => c.manageable);
    let count = 0;
    for (const [, channel] of channels) {
      try { await channel.permissionOverwrites.edit(everyoneRole, { ViewChannel: action==='on' ? false : null }); count++; } catch {}
    }
    await msg.edit({ components: [container(txt(`## ${action==='on'?'🔒':'🔓'} Mass Hide — ${action==='on'?'Masqué':'Affiché'}`), sep(), txt(`Les salons ont été **${action==='on'?'masqués':'rendus visibles'}** pour @everyone.\nSalons affectés : **${count}**`))], flags: FLAGS }).catch(()=>{});
  }
};
