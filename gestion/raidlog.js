const { PermissionsBitField } = require('discord.js');
const db = require('../../utils/simpledb');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer, successContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'raidlog',
  aliases: ['raidlogs'],
  description: 'Logs des raids détectés',
  category: 'gestion',
  run: async (client, message, args) => {
    const hasPerm = hasPermissionLevel(client, message, 6) || client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!hasPerm) return reply(message, errorContainer("Vous n'avez pas la permission d'utiliser cette commande."));
    if (!args[0]) return reply(message, container(txt('## 📋 Aide — Raidlog'), sep(), txt(['**`+raidlog set #salon`** — Définir le salon', '**`+raidlog remove`** — Supprimer la config', '**`+raidlog show`** — Afficher le salon configuré', '**`+raidlog logs [n]`** — Afficher les logs récents'].join('\n'))));

    const sub = args[0].toLowerCase();
    if (sub === 'set') {
      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
      if (!channel) return reply(message, errorContainer('Veuillez mentionner un salon valide.'));
      if (!channel.isTextBased()) return reply(message, errorContainer('Le salon doit être textuel.'));
      const perms = channel.permissionsFor(client.user);
      if (!perms.has(PermissionsBitField.Flags.ViewChannel)||!perms.has(PermissionsBitField.Flags.SendMessages)||!perms.has(PermissionsBitField.Flags.EmbedLinks)) return reply(message, errorContainer('Je n\'ai pas les permissions nécessaires dans ce salon (Voir, Envoyer, Intégrations).'));
      db.set(`${message.guild.id}.raidlog`, channel.id);
      return reply(message, successContainer(`Salon de logs antiraid configuré : ${channel}`));
    }
    if (sub === 'remove' || sub === 'delete') {
      if (!db.get(`${message.guild.id}.raidlog`)) return reply(message, errorContainer('Aucun salon de logs n\'est configuré.'));
      db.delete(`${message.guild.id}.raidlog`);
      return reply(message, successContainer('Salon de logs antiraid supprimé.'));
    }
    if (sub === 'show' || sub === 'view') {
      const channelId = db.get(`${message.guild.id}.raidlog`);
      if (!channelId) return reply(message, container(txt('## 📋 Configuration Logs'), sep(), txt('Aucun salon configuré.\nUtilisez `+raidlog set #salon` pour en configurer un.')));
      const channel = message.guild.channels.cache.get(channelId);
      const hasPerms = channel && channel.permissionsFor(client.user).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks]);
      return reply(message, container(txt('## 📋 Configuration Logs Antiraid'), sep(), txt([`**Salon:** ${channel||`Introuvable (${channelId})`}`, `**Statut:** ${channel?'✅ Actif':'❌ Salon introuvable'}`, `**Permissions:** ${hasPerms?'✅ OK':'❌ Permissions manquantes'}`].join('\n'))));
    }
    if (sub === 'logs' || sub === 'recent') {
      const raidLogs = db.get(`${message.guild.id}.raidlogs`) || [];
      const limit = parseInt(args[1]) || 10;
      if (!raidLogs.length) return reply(message, errorContainer('Aucun log d\'antiraid enregistré.'));
      const recent = raidLogs.slice(-limit).reverse();
      const lines = recent.map(log => { const ts = new Date(log.timestamp).toLocaleString('fr-FR'); return `**${log.type}** — ${ts}\n• ${log.userTag} (${log.userId})\n• Action: ${log.action}\n• Raison: ${log.reason||'Aucune'}`; });
      return reply(message, container(txt(`## 🚨 Logs Antiraid Récents (${recent.length})`), sep(), txt(lines.join('\n\n').slice(0, 3800) + `\n\n*Total: ${raidLogs.length} logs*`)));
    }
    return reply(message, errorContainer(`Sous-commande invalide. Utilisez \`+raidlog help\` pour l'aide.`));
  }
};

async function sendRaidLog(client, guildId, logData) {
  const channelId = db.get(`${guildId}.raidlog`);
  if (!channelId) return;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;
  if (!channel.permissionsFor(client.user).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks])) return;
  const raidLogs = db.get(`${guildId}.raidlogs`) || [];
  raidLogs.push({ ...logData, timestamp: Date.now() });
  db.set(`${guildId}.raidlogs`, raidLogs.length > 100 ? raidLogs.slice(-100) : raidLogs);
  const { container: C, txt: T, sep: S, FLAGS: F } = require('../../utils/v2');
  const lines = [`**Type:** ${logData.type}`, `**Utilisateur:** ${logData.userTag} (${logData.userId})`, `**Action:** ${logData.action}`, `**Date:** <t:${Math.floor(Date.now()/1000)}:F>`];
  if (logData.reason) lines.push(`**Raison:** ${logData.reason}`);
  if (logData.description) lines.push('', logData.description);
  try { await channel.send({ components: [C(T('## 🚨 Antiraid Log'), S(), T(lines.join('\n')))], flags: F }); } catch (e) { console.error('Erreur log raid:', e); }
}
module.exports.sendRaidLog = sendRaidLog;
