const {
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder, ChannelType, ButtonStyle
} = require('discord.js');
const { LogSystem, LOG_TYPES: LOG_TYPES_SYSTEM } = require('../../utils/logSystem');
const db = require('../../utils/simpledb');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, row, btn, reply, errorContainer, FLAGS } = require('../../utils/v2');

const LOG_TYPES = {
  message:    { name: 'Messages',      emoji: '📝', description: 'Suppression & modification de messages',     systemKey: 'MESSAGE'    },
  moderation: { name: 'Modération',    emoji: '🛡️', description: 'Ban, kick, mute, warn...',                  systemKey: 'MODERATION' },
  boost:      { name: 'Boosts',        emoji: '🚀', description: 'Boosts et pertes de boost',                  systemKey: 'BOOST'      },
  channel:    { name: 'Salons',        emoji: '🔧', description: 'Création, modification, suppression',        systemKey: 'CHANNEL'    },
  voice:      { name: 'Vocal',         emoji: '🎤', description: 'Arrivées/départs en vocal, mute...',         systemKey: 'VOICE'      },
  flux:       { name: 'Flux Membres',  emoji: '👥', description: 'Arrivées et départs du serveur',             systemKey: 'FLUX'       },
  raid:       { name: 'Sécurité',      emoji: '🚨', description: 'Détection de raids et alertes',              systemKey: 'RAID'       },
};

module.exports = {
  name: 'logs',
  aliases: ['log', 'logging', 'setlogs'],
  description: 'Configuration complète du système de logs',
  level: 4,
  category: 'gestion',
  run: async (client, message) => {
    try {
      if (!hasPermissionLevel(client, message, 6))
        return reply(message, errorContainer('Niveau 6 (Owner) requis pour configurer les logs.'));

      const guildId = message.guild.id;

      function getChannelId(logType) {
        const sk = LOG_TYPES[logType]?.systemKey;
        const lc = LOG_TYPES_SYSTEM[sk];
        if (!lc) return null;
        return db.get(`${lc.key}${guildId}`) || null;
      }

      function setChannelId(logType, channelId) {
        const sk = LOG_TYPES[logType]?.systemKey;
        const lc = LOG_TYPES_SYSTEM[sk];
        if (!lc) return;
        if (channelId) db.set(`${lc.key}${guildId}`, channelId);
        else db.delete(`${lc.key}${guildId}`);
      }

      // ── Main overview container ──────────────────────────────────────────
      function buildMainContainer() {
        const lines = Object.entries(LOG_TYPES).map(([key, d]) => {
          const chanId = getChannelId(key);
          const status = chanId ? `✅ <#${chanId}>` : '❌ Désactivé';
          return `${d.emoji} **${d.name}** — ${status}`;
        });

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('logs_select')
          .setPlaceholder('Sélectionner un type de log à configurer...')
          .addOptions(Object.entries(LOG_TYPES).map(([key, d]) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(d.name)
              .setValue(key)
              .setDescription(d.description)
              .setEmoji(d.emoji)
          ));

        return container(
          txt('## Système de Logs'),
          sep(),
          txt(lines.join('\n')),
          sep(),
          row(selectMenu),
          row(
            btn('logs_auto_setup', 'Setup auto',    ButtonStyle.Success,   '⚡'),
            btn('logs_disable_all','Tout désactiver',ButtonStyle.Danger,   '🔴'),
            btn('logs_refresh',    'Actualiser',     ButtonStyle.Secondary, '🔄')
          )
        );
      }

      // ── Per-type container ───────────────────────────────────────────────
      function buildTypeContainer(logType) {
        const d      = LOG_TYPES[logType];
        const chanId = getChannelId(logType);

        const channelSelect = new ChannelSelectMenuBuilder()
          .setCustomId(`logs_chan_${logType}`)
          .setPlaceholder('Choisir un salon existant...')
          .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setMinValues(1).setMaxValues(1);

        return container(
          txt(`## ${d.emoji} Logs — ${d.name}`),
          sep(),
          txt([
            `**Statut :** ${chanId ? `✅ Actif dans <#${chanId}>` : '❌ Désactivé'}`,
            `**Description :** ${d.description}`,
          ].join('\n')),
          sep(),
          txt('**Choisir un salon existant :**'),
          row(channelSelect),
          sep(),
          row(
            btn(`logs_create_${logType}`, 'Créer le salon', ButtonStyle.Success,   '🆕'),
            btn(`logs_disable_${logType}`,'Désactiver',     ButtonStyle.Danger,    '🔴'),
            btn('logs_back',              'Retour',          ButtonStyle.Secondary, '↩️')
          )
        );
      }

      // ── Send & collector ─────────────────────────────────────────────────
      const mainMsg = await message.channel.send({ components: [buildMainContainer()], flags: FLAGS });
      const refresh = () => mainMsg.edit({ components: [buildMainContainer()], flags: FLAGS }).catch(() => {});

      const notify = async (text) => {
        const m = await message.channel.send({ components: [container(txt(text))], flags: FLAGS }).catch(() => null);
        if (m) setTimeout(() => m.delete().catch(() => {}), 4_000);
      };

      const collector = mainMsg.createMessageComponentCollector({
        filter: i => i.user.id === message.author.id,
        time: 300_000
      });

      collector.on('collect', async (interaction) => {
        await interaction.deferUpdate().catch(() => {});
        const cid = interaction.customId;

        // Main actions
        if (cid === 'logs_refresh' || cid === 'logs_back') { await refresh(); return; }

        if (cid === 'logs_disable_all') {
          for (const key of Object.keys(LOG_TYPES)) setChannelId(key, null);
          await notify('✅ Tous les logs ont été désactivés.');
          await refresh(); return;
        }

        if (cid === 'logs_auto_setup') {
          await mainMsg.edit({ components: [container(
            txt('## Logs — Configuration Auto'),
            sep(),
            txt('Création des salons de logs en cours...')
          )], flags: FLAGS }).catch(() => {});
          try {
            const result = await LogSystem.setupLogsCategory(message.guild);
            if (result.success) {
              const count = Object.keys(result.channels || {}).length;
              await notify(`✅ ${count} salon(s) de logs créé(s) avec succès.`);
            } else {
              await notify(`❌ Erreur : ${result.error || 'Impossible de créer les salons.'}`);
            }
          } catch (err) {
            console.error('[logs] auto setup:', err);
            await notify('❌ Erreur lors de la création des salons. Vérifiez les permissions.');
          }
          await refresh(); return;
        }

        // Type select
        if (cid === 'logs_select') {
          const logType = interaction.values[0];
          await mainMsg.edit({ components: [buildTypeContainer(logType)], flags: FLAGS }).catch(() => {});
          return;
        }

        // Channel select menu (ChannelSelectMenu for a specific log type)
        if (cid.startsWith('logs_chan_')) {
          const logType = cid.replace('logs_chan_', '');
          const channelId = interaction.values[0];
          setChannelId(logType, channelId);
          await notify(`✅ Logs **${LOG_TYPES[logType]?.name}** configurés dans <#${channelId}>.`);
          await mainMsg.edit({ components: [buildTypeContainer(logType)], flags: FLAGS }).catch(() => {});
          return;
        }

        // Create channel
        if (cid.startsWith('logs_create_')) {
          const logType = cid.replace('logs_create_', ''), d = LOG_TYPES[logType];
          await mainMsg.edit({ components: [container(
            txt(`## ${d.emoji} Logs — ${d.name}`),
            sep(),
            txt('Création du salon en cours...')
          )], flags: FLAGS }).catch(() => {});
          try {
            await LogSystem.setupLogsCategory(message.guild);
            const chanId = getChannelId(logType);
            if (chanId) await notify(`✅ Salon logs **${d.name}** créé dans <#${chanId}>.`);
            else await notify('✅ Salon créé (configuré dans la catégorie logs).');
          } catch (err) {
            console.error('[logs_create]', err);
            await notify('❌ Impossible de créer le salon. Vérifiez les permissions du bot.');
          }
          await refresh(); return;
        }

        // Disable one type
        if (cid.startsWith('logs_disable_')) {
          const logType = cid.replace('logs_disable_', '');
          setChannelId(logType, null);
          await notify(`✅ Logs **${LOG_TYPES[logType]?.name}** désactivés.`);
          await refresh(); return;
        }
      });

      collector.on('end', () => mainMsg.edit({ components: [container(txt('⏰ Menu de configuration expiré.'))], flags: FLAGS }).catch(() => {}));

    } catch (err) {
      console.error('[logs] Erreur critique:', err);
      await reply(message, errorContainer(`Erreur : ${err.message}`));
    }
  }
};
