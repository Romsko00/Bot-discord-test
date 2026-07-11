const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');
const { container, txt, sep, row, reply, errorContainer, successContainer, FLAGS } = require('../../utils/v2');

const WL_TYPES = [
  { value: 'lien', label: 'Liens', description: 'Autoriser les liens/invites' },
  { value: 'all', label: 'Tout', description: 'Toutes les permissions' },
  { value: 'image', label: 'Images', description: 'Autoriser les images' },
  { value: 'gif', label: 'GIF', description: 'Autoriser les GIF' },
  { value: 'vocal', label: 'Vocal', description: 'Salon vocal' },
  { value: 'video', label: 'Vidéo', description: 'Autoriser les vidéos' },
  { value: 'audio', label: 'Audio', description: 'Fichiers audio' },
  { value: 'fichier', label: 'Fichiers', description: 'Pièces jointes' }
];
const WL_TYPE_VALUES = WL_TYPES.map(t => t.value);

function getWhitelistEntries(guildId) {
  const prefix = `antilink_wl_${guildId}_`;
  const entries = [];
  try { for (const { ID } of db.all()) { if (!ID?.startsWith(prefix)) continue; const rest = ID.slice(prefix.length); const li = rest.lastIndexOf('_'); if (li === -1) continue; const roleId = rest.slice(0, li), type = rest.slice(li+1); if (WL_TYPE_VALUES.includes(type)) entries.push({ roleId, type }); } } catch {}
  return entries;
}

module.exports = {
  name: 'antilink',
  description: "Active/désactive l'anti-lien et gère la whitelist.",
  category: 'gestion',
  usage: '+antilink <on|off|max|type|wl> [args...]',
  run: async (client, message, args) => {
    if (!hasPermissionLevel(client, message, 6)) return reply(message, errorContainer('Permission insuffisante.'));
    const sub = (args[0] || '').toLowerCase();
    const guildId = message.guild.id;

    if (sub === 'on') { db.set(`link_${guildId}`, true); db.set(`linksanction_${guildId}`, 'warn'); return reply(message, successContainer('Anti-lien **activé** (sanction: warn).')); }
    if (sub === 'max') { db.set(`link_${guildId}`, true); db.set(`linksanction_${guildId}`, 'ban'); return reply(message, successContainer('Anti-lien **activé au maximum** (sanction: ban).')); }
    if (sub === 'off') { db.delete(`link_${guildId}`); return reply(message, successContainer('Anti-lien **désactivé**.')); }

    if (sub === 'type') {
      const mode = (args[1] || '').toLowerCase();
      if (mode !== 'invite' && mode !== 'all') return reply(message, errorContainer('Usage: `+antilink type <invite|all>`'));
      db.set(`linktype_${guildId}`, mode === 'all' ? 'All' : 'Invite');
      return reply(message, successContainer(`Type défini : **${mode === 'all' ? 'Tous les liens' : 'Invites Discord uniquement'}**.`));
    }

    if (sub === 'wl' || sub === 'whitelist') {
      const action = (args[1] || '').toLowerCase();
      if (action === 'list' || action === 'liste') {
        const entries = getWhitelistEntries(guildId);
        const byRole = {};
        for (const { roleId, type } of entries) { if (!byRole[roleId]) byRole[roleId] = []; byRole[roleId].push(type); }
        const lines = Object.entries(byRole).map(([rid, types]) => { const r = message.guild.roles.cache.get(rid); return `• **${r ? r.name : rid}** : ${types.join(', ')}`; });
        return reply(message, container(txt('## ✅ Whitelist Anti-lien'), sep(), txt(lines.join('\n') || 'Aucun rôle whitelisté.')));
      }
      if (action === 'remove' || action === 'retirer' || action === 'del') {
        const role = message.mentions.roles.first() || (args[2] && message.guild.roles.cache.get(args[2]));
        const type = (args[3] || 'lien').toLowerCase();
        if (!role) return reply(message, errorContainer('Usage: `+antilink wl remove @role [type]`'));
        const toDelete = type === 'all' ? WL_TYPE_VALUES : (WL_TYPE_VALUES.includes(type) ? [type] : ['lien']);
        let removed = 0;
        for (const t of toDelete) { const k = `antilink_wl_${guildId}_${role.id}_${t}`; if (db.has ? db.has(k) : db.get(k)) { db.delete(k); removed++; } }
        return reply(message, successContainer(`Whitelist retirée pour **${role.name}** (${removed} type(s)).`));
      }
      const role = message.mentions.roles.first() || (args[1] && message.guild.roles.cache.get(args[1]));
      const type = (args[2] || '').toLowerCase();
      if (role && type && WL_TYPE_VALUES.includes(type)) {
        db.set(`antilink_wl_${guildId}_${role.id}_${type}`, true);
        return reply(message, successContainer(`Le rôle **${role.name}** a la permission \`${type}\` en whitelist.`));
      }
      await message.guild.roles.fetch().catch(() => {});
      const rolesArray = Array.from(message.guild.roles.cache.filter(r => r.id !== message.guild.id).sort((a,b) => b.position-a.position).values()).slice(0, 25);
      if (!rolesArray.length) return reply(message, errorContainer('Aucun rôle trouvé.'));
      const authorId = message.author.id;
      const roleMenu = new StringSelectMenuBuilder().setCustomId(`antilink_wl_role_${authorId}`).setPlaceholder('Choisir un rôle…').addOptions(rolesArray.map(r => new StringSelectMenuOptionBuilder().setLabel(r.name.slice(0, 100)).setValue(r.id)));
      return message.channel.send({ components: [container(txt('## 🔰 Whitelist Anti-lien (1/2)'), sep(), txt('Sélectionnez le **rôle** à qui accorder des permissions.'), row(roleMenu))], flags: FLAGS });
    }

    const enabled = db.get(`link_${guildId}`), sanction = db.get(`linksanction_${guildId}`) || 'warn', linkType = db.get(`linktype_${guildId}`) || 'Invite';
    return reply(message, container(txt('## 🔗 Configuration Anti-lien'), sep(), txt([`**Statut :** ${enabled ? '✅ Actif' : '❌ Inactif'} | **Sanction :** ${sanction} | **Type :** ${linkType === 'All' ? 'Tous les liens' : 'Invites seulement'}`, '', '**Commandes :**', '`+antilink on` — Activer (warn) | `+antilink max` — Activer (ban) | `+antilink off` — Désactiver', '`+antilink type invite|all` — Changer le type', '`+antilink wl [@role type]` — Whitelist | `+antilink wl list` — Voir la liste', '`+antilink wl remove @role [type]` — Retirer'].join('\n'))));
  },

  async handleInteraction(interaction) {
    if (!interaction.isStringSelectMenu() || !interaction.customId.startsWith('antilink_wl_')) return false;
    const customId = interaction.customId;
    if (customId.startsWith('antilink_wl_role_')) {
      const authorId = customId.replace('antilink_wl_role_', '');
      if (interaction.user.id !== authorId) return interaction.reply({ content: 'Non autorisé.', ephemeral: true }).then(() => true);
      await interaction.guild.roles.fetch();
      const roleId = interaction.values[0];
      const role = interaction.guild.roles.cache.get(roleId);
      const typeMenu = new StringSelectMenuBuilder().setCustomId(`antilink_wl_type_${roleId}_${authorId}`).setPlaceholder('Choisir les permissions…').setMinValues(1).setMaxValues(WL_TYPES.length).addOptions(WL_TYPES.map(t => new StringSelectMenuOptionBuilder().setLabel(t.label).setValue(t.value).setDescription(t.description)));
      await interaction.update({ components: [container(txt(`## 🔰 Whitelist — ${role ? role.name : roleId} (2/2)`), sep(), txt('Choisissez les permissions à accorder.'), row(typeMenu))], flags: FLAGS }).catch(() => {});
      return true;
    }
    if (customId.startsWith('antilink_wl_type_')) {
      const suffix = customId.replace('antilink_wl_type_', '');
      const parts = suffix.split('_'), roleId = parts[0], authorId = parts[1] || '';
      if (interaction.user.id !== authorId) return interaction.reply({ content: 'Non autorisé.', ephemeral: true }).then(() => true);
      await interaction.guild.roles.fetch();
      const guildId = interaction.guild.id;
      for (const type of (interaction.values || [])) { if (WL_TYPE_VALUES.includes(type)) db.set(`antilink_wl_${guildId}_${roleId}_${type}`, true); }
      const role = interaction.guild.roles.cache.get(roleId);
      await interaction.update({ components: [container(txt('## ✅ Whitelist Enregistrée'), sep(), txt(`Le rôle **${role ? role.name : roleId}** a reçu : **${interaction.values.join(', ')}**.`))], flags: FLAGS }).catch(() => {});
      return true;
    }
    return false;
  }
};
