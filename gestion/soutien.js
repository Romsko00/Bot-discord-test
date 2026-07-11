const Discord = require('discord.js');
const soutienSystem = require('../../utils/soutienSystem');
const db = require('../../utils/simpledb');
const { ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

const DETECTION_TYPES = {
  CONTAINS:    { key: 'contains',    label: 'Contient',     description: 'Le statut contient le texte spécifié' },
  STARTS_WITH: { key: 'starts_with', label: 'Commence par', description: 'Le statut commence par le texte spécifié' },
  ENDS_WITH:   { key: 'ends_with',   label: 'Finit par',    description: 'Le statut finit par le texte spécifié' },
  EXACT:       { key: 'exact',       label: 'Exact',        description: 'Le statut correspond exactement au texte' },
};

const MENU_OPTIONS = [
  { label: 'Modifier le rôle',         value: 'config_role',       emoji: '🎭' },
  { label: 'Modifier le texte',        value: 'config_text',       emoji: '📝' },
  { label: 'Type de détection',        value: 'config_type',       emoji: '🔧' },
  { label: 'Sensibilité casse',        value: 'config_case',       emoji: '🎯' },
  { label: 'Activer/Désactiver',       value: 'toggle_active',     emoji: '⚡' },
  { label: 'Activer/Désactiver logs',  value: 'toggle_logs',       emoji: '📋' },
  { label: 'Modifier salon logs',      value: 'config_logchannel', emoji: '📌' },
  { label: 'Vérifier membres',         value: 'check_members',     emoji: '🔍' },
  { label: 'Démarrer surveillance',    value: 'start_monitor',     emoji: '🚀' },
  { label: 'Arrêter surveillance',     value: 'stop_monitor',      emoji: '⏹' },
  { label: 'Tester détection',         value: 'test_detection',    emoji: '🧪' },
  { label: 'Afficher statistiques',    value: 'show_stats',        emoji: '📊' },
  { label: 'Aide',                     value: 'show_help',         emoji: '❓' },
  { label: 'Réinitialiser',           value: 'reset_config',      emoji: '🔄' },
];

function buildConfigContainer(guildId) {
  const cfg = soutienSystem.getConfig(guildId);
  return container(
    txt('## ⚡ Configuration Soutien'),
    sep(),
    txt([
      `**Statut :** ${cfg.isActive ? '✅ Activé' : '❌ Désactivé'}`,
      `**Rôle :** ${cfg.roleId ? `\`${cfg.roleId}\`` : '❌ Non configuré'}`,
      `**Texte à détecter :** ${cfg.statusText ? `\`${cfg.statusText}\`` : '❌ Non configuré'}`,
      `**Type :** ${Object.values(DETECTION_TYPES).find(t => t.key === cfg.detectionType)?.label || 'Contient'}`,
      `**Sensibilité casse :** ${cfg.caseSensitive ? '✅ Sensible' : '❌ Insensible'}`,
      `**Logs :** ${cfg.logsEnabled ? '✅ Activés' : '❌ Désactivés'}`,
      `**Salon logs :** ${cfg.logChannel ? `<#${cfg.logChannel}>` : '❌ Non configuré'}`,
    ].join('\n'))
  );
}

function buildMenuComponents() {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('soutien_menu')
    .setPlaceholder('Faites un choix')
    .addOptions(MENU_OPTIONS.map(o => ({ label: o.label.substring(0, 100), value: o.value, emoji: o.emoji })));
  return [
    new ActionRowBuilder().addComponents(selectMenu),
    new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('soutien_refresh').setLabel('Rafraîchir').setEmoji('🔄').setStyle(Discord.ButtonStyle.Secondary)),
  ];
}

module.exports = {
  name: 'soutien',
  aliases: [],
  handleInteraction,

  run: async (client, message, args) => {
    try {
      if (!message.guild) return reply(message, errorContainer('Serveur uniquement.'));
      if (!message.member) { try { message.member = await message.guild.members.fetch(message.author.id); } catch {} }
      let perm = false;
      message.member?.roles?.cache?.forEach(role => { if (db.get(`ownerp_${message.guild.id}_${role.id}`)) perm = true; });
      const isAuth = (client.config.superadmin?.includes(message.author.id)) || (client.config.owners?.includes(message.author.id)) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true || perm;
      if (!isAuth) return reply(message, errorContainer('Permissions insuffisantes.'));

      const sub = args[0]?.toLowerCase();
      switch (sub) {
        case 'check':  return await checkAllMembers(client, message);
        case 'status': return await showStatus(message);
        case 'help':   return await showHelp(message);
        case 'reset':  return await resetConfig(message);
        case 'test':   return await testDetection(message, args.slice(1).join(' '));
        case 'start':  return await startMonitoring(client, message);
        case 'stop':   return await stopMonitoring(message);
        case 'logs':   return await toggleLogs(message);
        case 'stats':  return await showStatistics(message);
        default:       return await showConfigMenu(client, message);
      }
    } catch (e) { console.error('[soutien]', e); }
  }
};

async function showConfigMenu(client, message) {
  const guildId = message.guild.id;
  const initialMessage = await message.channel.send({ components: [buildConfigContainer(guildId), ...buildMenuComponents()], flags: FLAGS });
  const refresh = () => initialMessage.edit({ components: [buildConfigContainer(guildId), ...buildMenuComponents()], flags: FLAGS }).catch(() => {});

  const collector = initialMessage.createMessageComponentCollector({ time: 300_000 });
  collector.on('collect', async interaction => {
    if (interaction.user.id !== message.author.id) return interaction.reply({ content: 'Accès refusé.', ephemeral: true });
    try {
      if (interaction.replied || interaction.deferred) return;
      if (interaction.isButton() && interaction.customId === 'soutien_refresh') {
        await interaction.update({ components: [buildConfigContainer(guildId), ...buildMenuComponents()], flags: FLAGS });
        return;
      }
      if (!interaction.isStringSelectMenu()) return;
      const value = interaction.values[0];
      const modalActions = ['config_role', 'config_text', 'config_logchannel', 'test_detection'];
      if (modalActions.includes(value)) {
        switch (value) {
          case 'config_role':
            await interaction.showModal(new ModalBuilder().setCustomId('soutien_config_role').setTitle('Rôle de Soutien').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_input').setLabel('ID ou mention du rôle').setStyle(TextInputStyle.Short).setRequired(true)))); break;
          case 'config_text':
            await interaction.showModal(new ModalBuilder().setCustomId('soutien_config_text').setTitle('Texte de Détection').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('text_input').setLabel('Texte à détecter').setStyle(TextInputStyle.Paragraph).setRequired(true)))); break;
          case 'config_logchannel':
            await interaction.showModal(new ModalBuilder().setCustomId('soutien_config_logchannel').setTitle('Salon de Logs').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('log_input').setLabel('ID ou mention du salon').setStyle(TextInputStyle.Short).setRequired(true)))); break;
          case 'test_detection':
            await interaction.showModal(new ModalBuilder().setCustomId('soutien_test_detection').setTitle('Test de Détection').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('test_input').setLabel('Texte à tester').setStyle(TextInputStyle.Paragraph).setRequired(true)))); break;
        }
        return;
      }
      if (value === 'config_type') { await showDetectionTypes(interaction); return; }
      await interaction.deferUpdate();
      switch (value) {
        case 'config_case':   toggleCaseSensitivity(guildId); break;
        case 'toggle_active': toggleActive(guildId); break;
        case 'toggle_logs':   toggleLogsConfig(guildId); break;
        case 'check_members': await checkAllMembers(client, message, interaction); return;
        case 'start_monitor': await startMonitoring(client, message, interaction); break;
        case 'stop_monitor':  await stopMonitoring(message, interaction); break;
        case 'show_stats':    await showStatistics(message, interaction); return;
        case 'show_help':     await showHelp(message); break;
        case 'reset_config':  await resetConfig(message, interaction); return;
      }
      await interaction.editReply({ components: [buildConfigContainer(guildId), ...buildMenuComponents()], flags: FLAGS });
    } catch (e) {
      console.error('[soutien] collector:', e);
      if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Une erreur est survenue.', ephemeral: true }).catch(() => {});
    }
  });
  collector.on('end', () => initialMessage.edit({ components: [buildConfigContainer(guildId)], flags: FLAGS }).catch(() => {}));
}

async function showDetectionTypes(interaction) {
  const cfg = soutienSystem.getConfig(interaction.guild.id);
  const options = Object.values(DETECTION_TYPES).map(t => ({ label: t.label, value: t.key, emoji: '🔧', default: cfg.detectionType === t.key }));
  const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('detection_type_menu').setPlaceholder('Type de détection').addOptions(options));
  await interaction.deferUpdate();
  await interaction.followUp({ content: 'Choisissez le type de détection :', components: [row], ephemeral: true });
}

function toggleCaseSensitivity(guildId) { const cfg = soutienSystem.getConfig(guildId); soutienSystem.updateConfig(guildId, 'case', !cfg.caseSensitive); }
function toggleActive(guildId) { const cfg = soutienSystem.getConfig(guildId); soutienSystem.updateConfig(guildId, 'active', !cfg.isActive); }
function toggleLogsConfig(guildId) { const cfg = soutienSystem.getConfig(guildId); soutienSystem.updateConfig(guildId, 'logs', !cfg.logsEnabled); }

async function checkAllMembers(client, message, interaction = null) {
  const cfg = soutienSystem.getConfig(message.guild.id);
  if (!cfg.roleId || !cfg.statusText) {
    const msg = 'Configuration incomplète — configurez d\'abord un rôle et une phrase.';
    if (interaction) return interaction.followUp({ content: msg, ephemeral: true });
    return reply(message, errorContainer(msg));
  }
  const role = message.guild.roles.cache.get(cfg.roleId);
  if (!role) { const msg = 'Rôle introuvable.'; if (interaction) return interaction.followUp({ content: msg, ephemeral: true }); return reply(message, errorContainer(msg)); }

  let progressMsg;
  if (interaction) progressMsg = await interaction.followUp({ content: '🔍 Scan... (0%)', fetchReply: true, ephemeral: true });
  else progressMsg = await message.channel.send({ components: [container(txt('## 🔍 Scan en cours...'), sep(), txt('Vérification des présences... (0%)'))], flags: FLAGS });

  let added = 0, removed = 0, checked = 0;
  const presences = message.guild.presences.cache;
  const total = presences.size;
  for (const presence of presences.values()) {
    const member = message.guild.members.cache.get(presence.userId);
    if (!member || member.user.bot) continue;
    checked++;
    if (checked % 10 === 0 && total > 0) {
      const pct = Math.round(checked / total * 100);
      if (interaction) await interaction.editReply(`🔍 Scan... (${pct}%)`).catch(() => {});
      else await progressMsg.edit({ components: [container(txt(`🔍 Scan... (${pct}%)`))], flags: FLAGS }).catch(() => {});
    }
    try {
      const has = soutienSystem.checkMemberStatus(member, cfg);
      if (has  && !member.roles.cache.has(cfg.roleId)) { await member.roles.add(role);    added++;   }
      if (!has &&  member.roles.cache.has(cfg.roleId)) { await member.roles.remove(role); removed++; }
    } catch (e) { console.error('[soutien] checkMember:', e); }
  }
  const resultContent = container(txt('## 📊 Résultat du Scan'), sep(), txt([`**Présences vérifiées :** ${checked}`, `**Rôles ajoutés :** ${added}`, `**Rôles retirés :** ${removed}`].join('\n')));
  if (interaction) await interaction.editReply({ content: null, components: [resultContent], flags: FLAGS }).catch(() => {});
  else await progressMsg.edit({ components: [resultContent], flags: FLAGS }).catch(() => {});
}

async function showStatus(message) {
  const cfg  = soutienSystem.getConfig(message.guild.id);
  const role = cfg.roleId ? message.guild.roles.cache.get(cfg.roleId) : null;
  await message.channel.send({ components: [container(
    txt('## 📊 Statut — Système de Soutien'),
    sep(),
    txt([`**Statut :** ${cfg.isActive ? '✅ Activé' : '❌ Désactivé'}`, `**Rôle :** ${role ? `${role}` : 'Non configuré'}`, `**Phrase :** ${cfg.statusText ? `\`${cfg.statusText}\`` : 'Non configurée'}`, `**Type :** ${DETECTION_TYPES[cfg.detectionType?.toUpperCase()]?.label || 'Contient'}`].join('\n'))
  )], flags: FLAGS });
}

async function handleInteraction(interaction) {
  try {
    if (interaction.isModalSubmit()) {
      switch (interaction.customId) {
        case 'soutien_config_role': { const input = interaction.fields.getTextInputValue('role_input'); const role = interaction.guild.roles.cache.get(input.replace(/[<@&>]/g, '')); if (!role) return interaction.reply({ content: 'Rôle invalide.', ephemeral: true }); soutienSystem.updateConfig(interaction.guild.id, 'role', role.id); await interaction.reply({ content: `✅ Rôle défini : ${role}`, ephemeral: true }); break; }
        case 'soutien_config_text': { const input = interaction.fields.getTextInputValue('text_input'); if (!input.trim()) return interaction.reply({ content: 'Texte invalide.', ephemeral: true }); soutienSystem.updateConfig(interaction.guild.id, 'text', input); await interaction.reply({ content: `✅ Texte défini : \`${input}\``, ephemeral: true }); break; }
        case 'soutien_config_logchannel': { const input = interaction.fields.getTextInputValue('log_input'); const ch = interaction.guild.channels.cache.get(input.replace(/[<#>]/g, '')); if (!ch || ch.type !== 0) return interaction.reply({ content: 'Salon invalide.', ephemeral: true }); soutienSystem.updateConfig(interaction.guild.id, 'logchannel', ch.id); await interaction.reply({ content: `✅ Salon de logs : ${ch}`, ephemeral: true }); break; }
        case 'soutien_test_detection': {
          const input = interaction.fields.getTextInputValue('test_input');
          const cfg = soutienSystem.getConfig(interaction.guild.id);
          let hasIt = false;
          if (cfg.statusText) { const st = cfg.caseSensitive ? cfg.statusText : cfg.statusText.toLowerCase(); const ft = cfg.caseSensitive ? input : input.toLowerCase(); switch (cfg.detectionType) { case 'contains': hasIt = ft.includes(st); break; case 'starts_with': hasIt = ft.startsWith(st); break; case 'ends_with': hasIt = ft.endsWith(st); break; case 'exact': hasIt = ft === st; break; default: hasIt = ft.includes(st); } }
          await interaction.reply({ content: `🧪 **Test :** \`${input}\`\n**Résultat :** ${hasIt ? '✅ Détecté' : '❌ Non détecté'}`, ephemeral: true }); break;
        }
      }
    } else if (interaction.isStringSelectMenu() && interaction.customId === 'detection_type_menu') {
      const type = interaction.values[0];
      const label = Object.values(DETECTION_TYPES).find(t => t.key === type)?.label || type;
      soutienSystem.updateConfig(interaction.guild.id, 'type', type);
      await interaction.reply({ content: `✅ Type de détection : **${label}**`, ephemeral: true });
    }
  } catch (e) {
    console.error('[soutien] handleInteraction:', e);
    if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Une erreur est survenue.', ephemeral: true }).catch(() => {});
  }
}

async function startMonitoring(client, message, interaction = null) {
  const cfg = soutienSystem.getConfig(message.guild.id);
  if (!cfg.roleId || !cfg.statusText) { const msg = 'Configuration incomplète.'; if (interaction) return interaction.followUp({ content: msg, ephemeral: true }); return reply(message, errorContainer(msg)); }
  soutienSystem.updateConfig(message.guild.id, 'active', true);
  if (interaction) await interaction.followUp({ content: '✅ Surveillance démarrée!', ephemeral: true });
  else await message.channel.send({ components: [container(txt('## 🚀 Surveillance Démarrée'), sep(), txt('Le système de soutien est maintenant actif.'))], flags: FLAGS });
}
async function stopMonitoring(message, interaction = null) {
  soutienSystem.updateConfig(message.guild.id, 'active', false);
  if (interaction) await interaction.followUp({ content: '⏹ Surveillance arrêtée.', ephemeral: true });
  else await message.channel.send({ components: [container(txt('⏹ **Surveillance arrêtée.**'))], flags: FLAGS });
}
async function toggleLogs(message) {
  const cfg = soutienSystem.getConfig(message.guild.id);
  soutienSystem.updateConfig(message.guild.id, 'logs', !cfg.logsEnabled);
  await message.channel.send({ components: [container(txt(`📋 Logs ${!cfg.logsEnabled ? '✅ activés' : '❌ désactivés'}`))] , flags: FLAGS });
}
async function testDetection(message, testText) {
  if (!testText) return reply(message, errorContainer('Spécifiez un texte à tester.'));
  const cfg = soutienSystem.getConfig(message.guild.id);
  let has = false;
  if (cfg.statusText) { const st = cfg.caseSensitive ? cfg.statusText : cfg.statusText.toLowerCase(); const ft = cfg.caseSensitive ? testText : testText.toLowerCase(); switch (cfg.detectionType) { case 'contains': has = ft.includes(st); break; case 'starts_with': has = ft.startsWith(st); break; case 'ends_with': has = ft.endsWith(st); break; case 'exact': has = ft === st; break; default: has = ft.includes(st); } }
  await message.channel.send({ components: [container(txt(`## 🧪 Test de Détection`), sep(), txt([`**Texte :** \`${testText}\``, `**Résultat :** ${has ? '✅ Détecté' : '❌ Non détecté'}`].join('\n')))], flags: FLAGS });
}
async function resetConfig(message, interaction = null) {
  ['role','text','active','logs','type','case','interval','logchannel'].forEach(k => db.delete(`soutien_${k}_${message.guild.id}`));
  if (interaction) await interaction.followUp({ content: '✅ Configuration réinitialisée!', ephemeral: true });
  else await message.channel.send({ components: [container(txt('## ✅ Configuration réinitialisée !'))], flags: FLAGS });
}
async function showHelp(message) {
  await message.channel.send({ components: [container(txt('## ❓ Aide — Système de Soutien'), sep(), txt(['`+soutien` — Menu de configuration', '`+soutien check` — Scan de tous les membres', '`+soutien status` — Statut actuel', '`+soutien start/stop` — Démarrer/arrêter', '`+soutien test [texte]` — Tester la détection', '`+soutien logs` — Toggle des logs', '`+soutien reset` — Réinitialiser'].join('\n')))], flags: FLAGS });
}
async function showStatistics(message, interaction = null) {
  const cfg = soutienSystem.getConfig(message.guild.id);
  const roleMembers = cfg.roleId ? (message.guild.roles.cache.get(cfg.roleId)?.members.size ?? 0) : 0;
  const statsContainer = container(txt('## 📈 Statistiques — Soutien'), sep(), txt([`**Statut :** ${cfg.isActive ? '✅ Activé' : '❌ Désactivé'}`, `**Logs :** ${cfg.logsEnabled ? '✅' : '❌'}`, cfg.roleId ? `**Membres avec le rôle :** ${roleMembers}` : null].filter(Boolean).join('\n')));
  if (interaction) await interaction.followUp({ components: [statsContainer], flags: FLAGS, ephemeral: true });
  else await message.channel.send({ components: [statsContainer], flags: FLAGS });
}
