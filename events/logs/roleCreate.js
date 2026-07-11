const Discord = require('discord.js');
const { LogSystem } = require('../../utils/logSystem');

module.exports = async (client, role) => {
  try {
    const guild = role.guild;

    // Récupérer l'exécuteur via les audit logs
    let executorText = 'Inconnu';
    try {
      const logs = await guild.fetchAuditLogs({ 
        type: Discord.AuditLogEvent.RoleCreate, 
        limit: 1 
      });
      const entry = logs.entries.first();
      if (entry && entry.target?.id === role.id) {
        executorText = `${entry.executor?.tag || entry.executor?.id || 'Inconnu'}`;
      }
    } catch {}

    let description = `**Couleur:** ${role.hexColor || '#000000'}\n`;
    description += `**Position:** ${role.position}\n`;
    description += `**Mentionnable:** ${role.mentionable ? 'Oui' : 'Non'}\n`;
    description += `**Affiché séparément:** ${role.hoist ? 'Oui' : 'Non'}\n`;
    
    // Ajouter les permissions importantes
    const importantPerms = [
      { flag: Discord.PermissionFlagsBits.Administrator, name: 'Administrateur' },
      { flag: Discord.PermissionFlagsBits.ManageGuild, name: 'Gérer serveur' },
      { flag: Discord.PermissionFlagsBits.ManageRoles, name: 'Gérer rôles' },
      { flag: Discord.PermissionFlagsBits.ManageChannels, name: 'Gérer salons' },
      { flag: Discord.PermissionFlagsBits.ManageMessages, name: 'Gérer messages' },
      { flag: Discord.PermissionFlagsBits.KickMembers, name: 'Expulser membres' },
      { flag: Discord.PermissionFlagsBits.BanMembers, name: 'Bannir membres' },
      { flag: Discord.PermissionFlagsBits.ModerateMembers, name: 'Modérer membres' }
    ];
    
    const permList = importantPerms
      .filter(perm => role.permissions.has(perm.flag))
      .map(perm => perm.name)
      .slice(0, 10);
    
    if (permList.length > 0) {
      description += `**Permissions principales:** ${permList.join(', ')}${role.permissions.bitfield > importantPerms.reduce((acc, p) => acc + p.flag, 0) ? '...' : ''}`;
    }

    const embed = new Discord.EmbedBuilder()
      .setColor(role.hexColor || 0x000000)
      .setTitle('Rôle créé')
      .setDescription(description)
      .addFields(
        { 
          name: 'Informations', 
          value: `**Nom:** ${role.name}\n**ID:** ${role.id}\n**Par:** ${executorText}`, 
          inline: false 
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Zoom Bot • Logs de rôles' });

    // Envoyer via le nouveau système de logs
    await LogSystem.sendEventLog(guild, 'MODERATION', embed);

  } catch (e) {
    console.error('Erreur roleCreate:', e);
  }
};
