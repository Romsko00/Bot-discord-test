const { PermissionFlagsBits } = require('discord.js');
const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'setallsalon',
  description: 'Configure une permission pour un rôle sur tous les salons',
  category: 'gestion',
  usage: 'setallsalon <rôle> <permission> <true/false/null>',
  run: async (client, message, args) => {
    const isOwner = client.config.owners?.includes(message.author.id) || client.config.superadmin?.includes(message.author.id) || db.get(`ownerp_${message.guild.id}_${message.author.id}`) || message.author.id === message.guild.ownerId;
    if (!isOwner) return reply(message, errorContainer("Vous n'avez pas la permission d'utiliser cette commande."));
    if (args.length < 3) return reply(message, errorContainer('Usage: `+setallsalon <rôle> <permission> <true/false/null>`'));
    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
    if (!role) return reply(message, errorContainer('Rôle introuvable.'));
    const permission = args[1], valueStr = args[2].toLowerCase();
    const validPerms = Object.keys(PermissionFlagsBits);
    if (!validPerms.includes(permission)) return reply(message, errorContainer(`Permission invalide. Exemples: ${validPerms.slice(0,10).join(', ')}...`));
    let value;
    if (valueStr==='true'||valueStr==='on') value=true;
    else if (valueStr==='false'||valueStr==='off') value=false;
    else if (valueStr==='null'||valueStr==='reset') value=null;
    else return reply(message, errorContainer('Valeur invalide. Utilisez `true`, `false` ou `null`.'));
    const msg = await message.channel.send({ components: [container(txt('## ⏳ Application en cours…'), sep(), txt(`Application de \`${permission}\` → \`${value}\` pour ${role} sur tous les salons...`))], flags: FLAGS });
    const channels = message.guild.channels.cache.filter(c => c.manageable);
    let count=0, errors=0;
    for (const [,channel] of channels) { try { await channel.permissionOverwrites.edit(role, {[permission]:value}); count++; } catch { errors++; } }
    await msg.edit({ components: [container(txt('## ✅ Gestion de Masse — Salons'), sep(), txt(`La permission **${permission}** a été définie sur **${value}** pour ${role} sur **${count}** salons.\n*${errors} erreur(s) rencontrée(s).*`))], flags: FLAGS }).catch(()=>{});
  }
};
