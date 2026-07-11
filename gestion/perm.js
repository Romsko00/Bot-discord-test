const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/simpledb');
const { getUserPermissionLevel, hasPermissionLevel, isBotOwner, setRolePermissionLevel, removeRolePermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer, successContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'perm',
  aliases: [],
  description: 'Gestion des permissions',
  category: 'gestion',
  run: async (client, message, args) => {
    if (!hasPermissionLevel(client, message, 6)) return reply(message, errorContainer("Vous n'avez pas la permission d'utiliser cette commande (niveau 6 requis)."));
    const sub = args[0]?.toLowerCase();
    switch (sub) {
      case 'set': await handleSet(client, message, args); break;
      case 'del': case 'delete': await handleDel(client, message, args); break;
      case 'clear': await handleClear(client, message); break;
      case 'list': case undefined: await handleList(client, message); break;
      default: await showHelp(message); break;
    }
  }
};

async function handleSet(client, message, args) {
  if (!isBotOwner(client, message)) return reply(message, errorContainer('Seuls les propriétaires du bot peuvent définir des permissions.'));
  if (args.length < 3) return reply(message, errorContainer('Utilisation: `+perm set <niveau> @rôle`\nNiveaux: 1 à 6'));
  const level = parseInt(args[1]);
  if (isNaN(level)||level<1||level>6) return reply(message, errorContainer('Le niveau doit être un nombre entre 1 et 6.'));
  const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]);
  if (!role) return reply(message, errorContainer(`Aucun rôle trouvé pour \`${args[2]}\`.`));
  try { setRolePermissionLevel(message.guild.id, role.id, level); return reply(message, successContainer(`Niveau **${level}** accordé au rôle ${role}`)); }
  catch (e) { return reply(message, errorContainer(`Erreur: ${e.message}`)); }
}

async function handleDel(client, message, args) {
  if (!isBotOwner(client, message)) return reply(message, errorContainer('Seuls les propriétaires du bot peuvent supprimer des permissions.'));
  if (args.length < 2) return reply(message, errorContainer('Utilisation: `+perm del @rôle`'));
  const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
  if (!role) return reply(message, errorContainer(`Aucun rôle trouvé pour \`${args[1]}\`.`));
  const current = db.get(`permlevel_${message.guild.id}_${role.id}`);
  if (!current) return reply(message, errorContainer('Ce rôle n\'a pas de niveau de permission défini.'));
  removeRolePermissionLevel(message.guild.id, role.id);
  return reply(message, successContainer(`Niveau de permission retiré du rôle ${role}`));
}

async function handleClear(client, message) {
  if (!isBotOwner(client, message)) return reply(message, errorContainer('Seuls les propriétaires du bot peuvent effacer toutes les permissions.'));
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('confirm_clear').setLabel('Confirmer').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('cancel_clear').setLabel('Annuler').setStyle(ButtonStyle.Secondary));
  const msg = await message.channel.send({ components: [container(txt('## ⚠️ Confirmation Requise'), sep(), txt('Êtes-vous sûr de vouloir effacer **toutes** les permissions de ce serveur ?')), row], flags: FLAGS });
  try {
    const confirmation = await msg.awaitMessageComponent({ filter: i => i.user.id===message.author.id, time: 15000 });
    if (confirmation.customId === 'confirm_clear') {
      await confirmation.deferUpdate();
      const permissions = db.all().filter(d => d.ID.startsWith(`permlevel_${message.guild.id}_`));
      for (const perm of permissions) db.delete(perm.ID);
      await msg.edit({ components: [successContainer(`${permissions.length} niveaux de permissions supprimés.`)], flags: FLAGS }).catch(()=>{});
    } else {
      await confirmation.deferUpdate();
      await msg.edit({ components: [container(txt('## ℹ️ Annulé'), sep(), txt('Opération annulée.'))], flags: FLAGS }).catch(()=>{});
    }
  } catch { await msg.edit({ components: [errorContainer('Temps de confirmation écoulé.')], flags: FLAGS }).catch(()=>{}); }
}

async function handleList(client, message) {
  const permissions = db.all().filter(d => d.ID.startsWith(`permlevel_${message.guild.id}_`));
  const lines = [];
  if (!permissions.length) { lines.push('Aucun niveau de permission configuré sur ce serveur.'); }
  else {
    const levels = {};
    for (let i=1;i<=6;i++) levels[i]=[];
    for (const perm of permissions) { const roleId=perm.ID.split('_')[2], role=message.guild.roles.cache.get(roleId); if (role) levels[perm.data].push(role); }
    for (let level=6;level>=1;level--) { const roles=levels[level]; if (roles.length) lines.push(`**Niveau ${level}${level===6?' (Plus élevé)':''}:** ${roles.map(r=>`${r.name} (\`${r.id}\`)`).join(', ')}`); }
  }
  const ownersArray = Array.isArray(client.config.owners) ? client.config.owners : [];
  if (ownersArray.length) lines.push(`**Propriétaires du bot:** ${ownersArray.length} configuré(s)`);
  const ownerMdCount = db.all().filter(d => d.ID.startsWith(`ownermd_${client.user.id}`)).length;
  if (ownerMdCount) lines.push(`**Owners temporaires:** ${ownerMdCount} configuré(s)`);
  return reply(message, container(txt('## 📋 Niveaux de Permissions'), sep(), txt(lines.join('\n'))));
}

async function showHelp(message) {
  return reply(message, container(txt('## 🛠️ Aide — Perm'), sep(), txt([
    '**`+perm set <niveau> @rôle`** — Accorder un niveau (1-6) à un rôle',
    '**`+perm del @rôle`** — Retirer le niveau d\'un rôle',
    '**`+perm clear`** — Effacer tous les niveaux du serveur',
    '**`+perm list`** — Lister tous les niveaux',
    '', '*Seuls les propriétaires du bot peuvent utiliser set/del/clear*'
  ].join('\n'))));
}
