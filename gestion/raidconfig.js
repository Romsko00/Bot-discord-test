const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const EMOJIS = require('../../utils/emojis');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const RaidDetection = require('../../utils/raidDetection');
const { container, txt, sep, reply, errorContainer, successContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'raidconfig',
  aliases: ['antiraid', 'raidsettings', 'security'],
  description: 'Configuration du système de détection de raids',
  level: 4,
  category: 'gestion',
  run: async (client, message) => {
    try {
      if (!hasPermissionLevel(client, message, 6)) return reply(message, errorContainer('Vous devez être administrateur pour configurer la sécurité.'));
      const guildId = message.guild.id;
      const raidDetection = new RaidDetection(client);

      function buildMainContent() {
        const stats = raidDetection.getStats(guildId), thresholds = raidDetection.raidThresholds;
        return container(txt('## 🛡️ Configuration Anti-Raid'), sep(), txt([`**Joins récents (1 min):** ${stats.joins}`, `**Leaves récents (1 min):** ${stats.leaves}`, `**Total membres:** ${stats.totalMembers}`, '', `**Seuil joins/min:** ${thresholds.maxJoinsPerMinute}`, `**Seuil leaves/min:** ${thresholds.maxLeavesPerMinute}`, `**Intervalle:** ${thresholds.checkInterval/1000}s`].join('\n')));
      }

      function buildMainRow() {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('raid_thresholds').setLabel('Modifier les Seuils').setEmoji(EMOJIS.SETTINGS||'⚙️').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('raid_test').setLabel('Test de Détection').setEmoji('🧪').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('raid_status').setLabel('État du Système').setEmoji('📊').setStyle(ButtonStyle.Success)
        );
      }

      const backRow = () => new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('raid_back').setLabel('Retour').setEmoji('↩️').setStyle(ButtonStyle.Secondary));

      const mainMsg = await message.channel.send({ components: [buildMainContent(), buildMainRow()], flags: FLAGS });
      const refresh = () => mainMsg.edit({ components: [buildMainContent(), buildMainRow()], flags: FLAGS }).catch(()=>{});

      const collector = mainMsg.createMessageComponentCollector({ filter: i => i.user.id===message.author.id, time: 300000 });
      collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();
        if (interaction.customId === 'raid_thresholds') {
          await mainMsg.edit({ components: [container(txt('## ⚙️ Modification des Seuils'), sep(), txt('Configurez les seuils de détection de raids')), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('raid_set_joins_low').setLabel('Joins: Faible (5)').setEmoji(EMOJIS.ONLINE||'🟢').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('raid_set_joins_medium').setLabel('Joins: Moyen (10)').setEmoji(EMOJIS.IDLE||'🟡').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('raid_set_joins_high').setLabel('Joins: Élevé (20)').setEmoji(EMOJIS.DND||'🔴').setStyle(ButtonStyle.Danger)), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('raid_set_leaves_low').setLabel('Leaves: Faible (3)').setEmoji(EMOJIS.ONLINE||'🟢').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('raid_set_leaves_medium').setLabel('Leaves: Moyen (8)').setEmoji(EMOJIS.IDLE||'🟡').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('raid_set_leaves_high').setLabel('Leaves: Élevé (15)').setEmoji(EMOJIS.DND||'🔴').setStyle(ButtonStyle.Danger)), backRow()], flags: FLAGS }).catch(()=>{});
          return;
        }
        if (interaction.customId === 'raid_test') {
          await mainMsg.edit({ components: [container(txt('## 🧪 Test de Détection'), sep(), txt('Simulation d\'un raid en cours...')), backRow()], flags: FLAGS }).catch(()=>{});
          for (let i=0;i<12;i++) raidDetection.recordJoin(message.guild);
          setTimeout(async () => { await mainMsg.edit({ components: [container(txt('## ✅ Test Terminé'), sep(), txt('Simulation terminée. Vérifiez vos logs de sécurité.')), backRow()], flags: FLAGS }).catch(()=>{}); setTimeout(() => refresh(), 3000); }, 2000);
          return;
        }
        if (interaction.customId === 'raid_status') {
          const stats = raidDetection.getStats(guildId);
          await mainMsg.edit({ components: [container(txt('## 📊 État du Système Anti-Raid'), sep(), txt([`**Joins (1 min):** ${stats.joins}`, `**Leaves (1 min):** ${stats.leaves}`, `**Total membres:** ${stats.totalMembers}`, '', `**État:** Actif`, `**Latence:** ${Math.round(client.ws.ping)}ms`, `**Seuil joins:** ${raidDetection.raidThresholds.maxJoinsPerMinute}/min`, `**Seuil leaves:** ${raidDetection.raidThresholds.maxLeavesPerMinute}/min`].join('\n'))), backRow()], flags: FLAGS }).catch(()=>{});
          return;
        }
        if (interaction.customId.startsWith('raid_set_')) {
          const parts=interaction.customId.split('_'), type=parts[2], level=parts[3];
          const values={joins:{low:5,medium:10,high:20},leaves:{low:3,medium:8,high:15}};
          const newVal=values[type]?.[level];
          if (newVal!==undefined) raidDetection.setThresholds({[`max${type.charAt(0).toUpperCase()+type.slice(1)}PerMinute`]:newVal});
          await message.channel.send({ components: [successContainer(`Seuil de ${type} défini à **${newVal}**/min.`)], flags: FLAGS }).then(m=>setTimeout(()=>m.delete().catch(()=>{}),5000)).catch(()=>{});
          await refresh(); return;
        }
        if (interaction.customId === 'raid_back') { await refresh(); return; }
      });
      collector.on('end', () => mainMsg.edit({ components: [buildMainContent()], flags: FLAGS }).catch(()=>{}));
    } catch (err) { console.error('[raidconfig]', err); await reply(message, errorContainer(`Erreur: ${err.message}`)); }
  }
};
