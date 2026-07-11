const Discord = require('discord.js');
const { LogSystem } = require('../../utils/logSystem');

module.exports = async (client, oldRole, newRole) => {
  try {
    const guild = newRole.guild;

    const changes = [];
    
    // Changement de nom
    if (oldRole.name !== newRole.name) {
      changes.push(`**Nom:** ${oldRole.name} ➜ ${newRole.name}`);
    }
    
    // Changement de couleur
    if (oldRole.hexColor !== newRole.hexColor) {
      const oldColor = oldRole.hexColor || '#000000';
      const newColor = newRole.hexColor || '#000000';
      changes.push(`**Couleur:** ${oldColor} ➜ ${newColor}`);
    }
    
    // Changement de mentionnable
    if (oldRole.mentionable !== newRole.mentionable) {
      changes.push(`**Mentionnable:** ${oldRole.mentionable ? 'Oui' : 'Non'} ➜ ${newRole.mentionable ? 'Oui' : 'Non'}`);
    }
    
    // Changement de position hiérarchique
    if (oldRole.position !== newRole.position) {
      changes.push(`**Position:** ${oldRole.position} ➜ ${newRole.position}`);
    }
    
    // Changement de séparateur (hoisted)
    if (oldRole.hoist !== newRole.hoist) {
      changes.push(`**Affiché séparément:** ${oldRole.hoist ? 'Oui' : 'Non'} ➜ ${newRole.hoist ? 'Oui' : 'Non'}`);
    }
    
    // Changement d'icône (pour les rôles premium)
    if (oldRole.icon !== newRole.icon) {
      const oldIcon = oldRole.icon ? 'Oui' : 'Non';
      const newIcon = newRole.icon ? 'Oui' : 'Non';
      changes.push(`**Icône:** ${oldIcon} ➜ ${newIcon}`);
    }

    // Analyse des permissions
    const permissionChanges = analyzeRolePermissionChanges(oldRole, newRole);
    if (permissionChanges.length > 0) {
      changes.push(`**Permissions:**\n${permissionChanges.join('\n')}`);
    }

    if (changes.length === 0) return;

    // Récupérer l'exécuteur via les audit logs
    let executorText = 'Inconnu';
    try {
      const logs = await guild.fetchAuditLogs({ 
        type: Discord.AuditLogEvent.RoleUpdate, 
        limit: 1 
      });
      const entry = logs.entries.first();
      if (entry && entry.target?.id === newRole.id) {
        executorText = `${entry.executor?.tag || entry.executor?.id || 'Inconnu'}`;
      }
    } catch {}

    const embed = new Discord.EmbedBuilder()
      .setColor(newRole.hexColor || 0x000000)
      .setTitle('Rôle modifié')
      .setDescription(changes.join('\n'))
      .addFields(
        { 
          name: 'Informations', 
          value: `**Rôle:** ${newRole.name}\n**ID:** ${newRole.id}\n**Par:** ${executorText}`, 
          inline: false 
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Zoom Bot • Logs de rôles' });

    // Envoyer via le nouveau système de logs
    await LogSystem.sendEventLog(guild, 'MODERATION', embed);

  } catch (e) {
    console.error('Erreur roleUpdate:', e);
  }
};

function analyzeRolePermissionChanges(oldRole, newRole) {
  const changes = [];
  
  // Comparer les permissions
  const oldPerms = oldRole.permissions;
  const newPerms = newRole.permissions;
  
  const addedPerms = [];
  const removedPerms = [];
  
  // Liste des permissions importantes à vérifier
  const importantPerms = [
    { flag: Discord.PermissionFlagsBits.Administrator, name: 'Administrateur' },
    { flag: Discord.PermissionFlagsBits.ManageGuild, name: 'Gérer serveur' },
    { flag: Discord.PermissionFlagsBits.ManageRoles, name: 'Gérer rôles' },
    { flag: Discord.PermissionFlagsBits.ManageChannels, name: 'Gérer salons' },
    { flag: Discord.PermissionFlagsBits.ManageMessages, name: 'Gérer messages' },
    { flag: Discord.PermissionFlagsBits.KickMembers, name: 'Expulser membres' },
    { flag: Discord.PermissionFlagsBits.BanMembers, name: 'Bannir membres' },
    { flag: Discord.PermissionFlagsBits.ModerateMembers, name: 'Modérer membres' },
    { flag: Discord.PermissionFlagsBits.ViewAuditLog, name: 'Voir logs d\'audit' },
    { flag: Discord.PermissionFlagsBits.ManageWebhooks, name: 'Gérer webhooks' },
    { flag: Discord.PermissionFlagsBits.ManageEmojisAndStickers, name: 'Gérer émojis et stickers' },
    { flag: Discord.PermissionFlagsBits.ManageEvents, name: 'Gérer événements' },
    { flag: Discord.PermissionFlagsBits.CreateEvents, name: 'Créer événements' },
    { flag: Discord.PermissionFlagsBits.SendMessages, name: 'Envoyer messages' },
    { flag: Discord.PermissionFlagsBits.Connect, name: 'Se connecter (vocal)' },
    { flag: Discord.PermissionFlagsBits.Speak, name: 'Parler' },
    { flag: Discord.PermissionFlagsBits.PrioritySpeaker, name: 'Priorité vocale' },
    { flag: Discord.PermissionFlagsBits.MuteMembers, name: 'Rendre muet' },
    { flag: Discord.PermissionFlagsBits.DeafenMembers, name: 'Rendre sourd' },
    { flag: Discord.PermissionFlagsBits.MoveMembers, name: 'Déplacer membres' }
  ];
  
  for (const perm of importantPerms) {
    const hadPermission = oldPerms.has(perm.flag);
    const hasPermission = newPerms.has(perm.flag);
    
    if (!hadPermission && hasPermission) {
      addedPerms.push(perm.name);
    } else if (hadPermission && !hasPermission) {
      removedPerms.push(perm.name);
    }
  }
  
  if (addedPerms.length > 0) {
    changes.push(`➕ **Ajoutées:** ${addedPerms.join(', ')}`);
  }
  
  if (removedPerms.length > 0) {
    changes.push(`➖ **Retirées:** ${removedPerms.join(', ')}`);
  }
  
  return changes;
}
