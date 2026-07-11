const {
  ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType,
  PermissionsBitField
} = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

function getConfig(guildId) {
  return db.get(`captcha_${guildId}`) || {
    enabled: false,
    type: 'button',
    channelId: null,
    roleId: null,
    muteRoleId: null
  };
}

function getChannelDisplay(guild, channelId) {
  if (!channelId) return '*Non défini*';
  const ch = guild.channels.cache.get(channelId);
  return ch ? ch.toString() : '❌ Salon introuvable';
}

function getRoleDisplay(guild, roleId) {
  if (!roleId) return '*Non défini*';
  const role = guild.roles.cache.get(roleId);
  return role ? role.toString() : '❌ Rôle introuvable';
}

function getTypeLabel(type) {
  const labels = { button: 'Bouton (clic)', image: 'Image (code à taper)', text: 'Texte (calcul simple)' };
  return labels[type] || 'Bouton (clic)';
}

const { row: v2row } = require('../../utils/v2');

function buildContainer(guild, cfg) {
  const muteStatus = cfg.muteRoleId
    ? `${getRoleDisplay(guild, cfg.muteRoleId)} *(retiré après vérification)*`
    : '*Non défini — accès non restreint à l\'arrivée*';

  const hint = cfg.muteRoleId
    ? '🔒 Rôle quarantaine configuré. Utilisez **[⚙️ Appliquer les permissions]** pour restreindre automatiquement l\'accès aux salons.'
    : '⚠️ Sans rôle quarantaine, les nouveaux membres ont accès immédiat au serveur.';

  const typeSelect = new StringSelectMenuBuilder()
    .setCustomId('captcha_type')
    .setPlaceholder('🖱️ Type de CAPTCHA...')
    .addOptions([
      new StringSelectMenuOptionBuilder().setLabel('Bouton (clic simple)').setValue('button').setEmoji('🖱️').setDefault(cfg.type === 'button'),
      new StringSelectMenuOptionBuilder().setLabel('Image (code à taper)').setValue('image').setEmoji('🖼️').setDefault(cfg.type === 'image'),
      new StringSelectMenuOptionBuilder().setLabel('Texte (calcul simple)').setValue('text').setEmoji('🔢').setDefault(cfg.type === 'text'),
    ]);

  const chanSelect = new ChannelSelectMenuBuilder()
    .setCustomId('captcha_channel')
    .setPlaceholder('📢 Salon de vérification...')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  const roleVerifSelect = new RoleSelectMenuBuilder()
    .setCustomId('captcha_role')
    .setPlaceholder('🎖️ Rôle attribué après vérification...')
    .setMinValues(0)
    .setMaxValues(1);

  const roleQuarantineSelect = new RoleSelectMenuBuilder()
    .setCustomId('captcha_mute_role')
    .setPlaceholder('🔒 Rôle quarantaine (optionnel)...')
    .setMinValues(0)
    .setMaxValues(1);

  return container(
    txt('## 🔐 Configuration CAPTCHA'),
    sep(),
    txt([
      `**Statut :** ${cfg.enabled ? '🟢 Actif' : '🔴 Désactivé'}`,
      `**Type :** ${getTypeLabel(cfg.type)}`,
      `**Salon de vérification :** ${getChannelDisplay(guild, cfg.channelId)}`,
      `**Rôle après vérification :** ${getRoleDisplay(guild, cfg.roleId)}`,
      `**Rôle quarantaine :** ${muteStatus}`,
    ].join('\n')),
    sep(),
    txt('**Type de vérification**'),
    v2row(typeSelect),
    txt('**Salon & rôles**'),
    v2row(chanSelect),
    v2row(roleVerifSelect),
    v2row(roleQuarantineSelect),
    sep(),
    txt(hint),
    v2row(
      new ButtonBuilder().setCustomId('captcha_toggle').setLabel(cfg.enabled ? '🔴 Désactiver' : '🟢 Activer').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder().setCustomId('captcha_perms').setLabel('⚙️ Appliquer les permissions').setStyle(ButtonStyle.Secondary).setDisabled(!cfg.muteRoleId || !cfg.channelId),
      new ButtonBuilder().setCustomId('captcha_reset_perms').setLabel('🔄 Réinitialiser permissions').setStyle(ButtonStyle.Danger).setDisabled(!cfg.muteRoleId)
    ),
    v2row(
      new ButtonBuilder().setCustomId('captcha_publish').setLabel('📤 Publier le CAPTCHA').setStyle(ButtonStyle.Primary).setDisabled(!cfg.channelId || !cfg.roleId),
      new ButtonBuilder().setCustomId('captcha_close').setLabel('✖️ Fermer').setStyle(ButtonStyle.Secondary)
    )
  );
}

async function resetQuarantinePermissions(guild, cfg) {
  const muteRole = guild.roles.cache.get(cfg.muteRoleId);
  if (!muteRole) throw new Error('Rôle quarantaine introuvable.');

  const channels = guild.channels.cache.filter(ch =>
    ch.type === ChannelType.GuildText ||
    ch.type === ChannelType.GuildVoice ||
    ch.type === ChannelType.GuildCategory ||
    ch.type === ChannelType.GuildAnnouncement ||
    ch.type === ChannelType.GuildForum
  );

  let reset = 0;
  let failed = 0;

  for (const [, channel] of channels) {
    if (!channel.permissionOverwrites.cache.has(muteRole.id)) continue;
    try {
      await channel.permissionOverwrites.delete(muteRole, '[CAPTCHA] Réinitialisation permissions quarantaine');
      reset++;
    } catch {
      failed++;
    }
  }

  return { reset, failed };
}

async function applyQuarantinePermissions(guild, cfg) {
  const muteRole = guild.roles.cache.get(cfg.muteRoleId);
  if (!muteRole) throw new Error('Rôle quarantaine introuvable.');

  const verifyChannel = guild.channels.cache.get(cfg.channelId);
  let applied = 0;
  let failed = 0;

  const channels = guild.channels.cache.filter(ch =>
    ch.type === ChannelType.GuildText ||
    ch.type === ChannelType.GuildVoice ||
    ch.type === ChannelType.GuildCategory ||
    ch.type === ChannelType.GuildAnnouncement ||
    ch.type === ChannelType.GuildForum
  );

  for (const [, channel] of channels) {
    try {
      if (verifyChannel && channel.id === verifyChannel.id) {
        // Salon de vérification : le membre peut voir mais pas écrire librement
        await channel.permissionOverwrites.edit(muteRole, {
          ViewChannel: true,
          SendMessages: false,
          AddReactions: false,
        }, { reason: '[CAPTCHA] Accès salon de vérification' });
      } else {
        // Tous les autres salons : accès totalement bloqué
        await channel.permissionOverwrites.edit(muteRole, {
          ViewChannel: false,
        }, { reason: '[CAPTCHA] Restriction rôle quarantaine' });
      }
      applied++;
    } catch {
      failed++;
    }
  }

  return { applied, failed, total: channels.size };
}

async function publishCaptcha(client, message, cfg) {
  const channel = message.guild.channels.cache.get(cfg.channelId);
  if (!channel) return;

  const verifyBtn = new ButtonBuilder()
    .setCustomId('captcha_verify')
    .setLabel('✅ Cliquez ici pour vous vérifier')
    .setStyle(ButtonStyle.Success);

  const publishContainer = container(
    txt('## 🔐 Vérification requise'),
    sep(),
    txt([
      'Bienvenue sur ce serveur !',
      'Pour accéder au serveur, vous devez vous vérifier.',
      '',
      cfg.type === 'button' ? '👇 **Cliquez sur le bouton ci-dessous pour continuer.**' :
      cfg.type === 'image'  ? '👇 **Cliquez sur le bouton et entrez le code affiché.**' :
                              '👇 **Cliquez sur le bouton et résolvez le calcul.**',
      '',
      cfg.muteRoleId ? '🔒 *Votre accès est restreint jusqu\'à votre vérification.*' : '',
    ].filter(Boolean).join('\n')),
    v2row(verifyBtn)
  );

  await channel.send({
    components: [publishContainer],
    flags: FLAGS
  });
}

module.exports = {
  name: 'captcha',
  aliases: ['verification', 'captchaconfig'],
  description: 'Configure le système de vérification CAPTCHA',
  category: 'gestion',
  level: 4,
  run: async (client, message) => {
    if (!hasPermissionLevel(client, message, 4)) {
      return reply(message, errorContainer('**Permission insuffisante** — Niveau 4 (Admin) requis.'));
    }

    const guildId = message.guild.id;
    let cfg = getConfig(guildId);

    const panelMsg = await message.channel.send({
      components: [buildContainer(message.guild, cfg)],
      flags: FLAGS
    });

    const timeout = setTimeout(() => panelMsg.edit({ components: [] }).catch(() => {}), 300_000);

    const collector = panelMsg.createMessageComponentCollector({
      filter: i => i.user.id === message.author.id,
      time: 300_000
    });

    const refresh = async (interaction) => {
      cfg = getConfig(guildId);
      await interaction.update({
        components: [buildContainer(message.guild, cfg)]
      });
    };

    const notify = async (text) => {
      const m = await message.channel.send({
        components: [container(txt(text))],
        flags: FLAGS
      }).catch(() => null);
      if (m) setTimeout(() => m.delete().catch(() => {}), 6_000);
    };

    collector.on('collect', async interaction => {
      if (interaction.customId === 'captcha_close') {
        clearTimeout(timeout);
        collector.stop();
        return interaction.update({ components: [] });
      }

      if (interaction.customId === 'captcha_toggle') {
        cfg = getConfig(guildId);
        cfg.enabled = !cfg.enabled;
        db.set(`captcha_${guildId}`, cfg);
        return refresh(interaction);
      }

      if (interaction.customId === 'captcha_type') {
        cfg = getConfig(guildId);
        cfg.type = interaction.values[0];
        db.set(`captcha_${guildId}`, cfg);
        return refresh(interaction);
      }

      if (interaction.customId === 'captcha_channel') {
        cfg = getConfig(guildId);
        cfg.channelId = interaction.values[0] || null;
        db.set(`captcha_${guildId}`, cfg);
        return refresh(interaction);
      }

      if (interaction.customId === 'captcha_role') {
        cfg = getConfig(guildId);
        cfg.roleId = interaction.values[0] || null;
        db.set(`captcha_${guildId}`, cfg);
        if (cfg.roleId) db.set(`captcha_role_${guildId}`, cfg.roleId);
        return refresh(interaction);
      }

      if (interaction.customId === 'captcha_mute_role') {
        cfg = getConfig(guildId);
        cfg.muteRoleId = interaction.values[0] || null;
        db.set(`captcha_${guildId}`, cfg);
        return refresh(interaction);
      }

      if (interaction.customId === 'captcha_perms') {
        cfg = getConfig(guildId);
        await interaction.deferUpdate();

        const progressMsg = await message.channel.send({
          components: [container(txt('## ⚙️ Application des permissions...'), sep(), txt('Configuration des permissions du rôle quarantaine en cours...\n*Cela peut prendre quelques secondes.*'))],
          flags: FLAGS
        }).catch(() => null);

        try {
          const result = await applyQuarantinePermissions(message.guild, cfg);
          if (progressMsg) await progressMsg.delete().catch(() => {});
          await notify([
            `## ✅ Permissions appliquées`,
            `**${result.applied}** salon(s) configuré(s) sur **${result.total}**${result.failed > 0 ? ` · ⚠️ ${result.failed} échec(s)` : ''}`,
            `Le rôle quarantaine ne peut voir que le salon de vérification.`,
          ].join('\n'));
        } catch (err) {
          if (progressMsg) await progressMsg.delete().catch(() => {});
          await notify(`## ❌ Erreur\n${err.message || 'Impossible d\'appliquer les permissions. Vérifiez que le bot est au-dessus du rôle quarantaine.'}`);
        }

        await panelMsg.edit({ components: [buildContainer(message.guild, cfg)], flags: FLAGS }).catch(() => {});
        return;
      }

      if (interaction.customId === 'captcha_reset_perms') {
        cfg = getConfig(guildId);
        await interaction.deferUpdate();

        const progressMsg = await message.channel.send({
          components: [container(txt('## 🔄 Réinitialisation en cours...'), sep(), txt('Suppression des permissions du rôle quarantaine sur tous les salons...\n*Cela peut prendre quelques secondes.*'))],
          flags: FLAGS
        }).catch(() => null);

        try {
          const result = await resetQuarantinePermissions(message.guild, cfg);
          if (progressMsg) await progressMsg.delete().catch(() => {});
          if (result.reset === 0 && result.failed === 0) {
            await notify('## ℹ️ Aucune permission à réinitialiser\nLe rôle quarantaine n\'avait aucune override sur les salons.');
          } else {
            await notify([
              `## ✅ Permissions réinitialisées`,
              `**${result.reset}** salon(s) réinitialisé(s)${result.failed > 0 ? ` · ⚠️ ${result.failed} échec(s)` : ''}`,
              `Le rôle quarantaine n\'a plus d\'overrides sur les salons du serveur.`,
            ].join('\n'));
          }
        } catch (err) {
          if (progressMsg) await progressMsg.delete().catch(() => {});
          await notify(`## ❌ Erreur\n${err.message || 'Impossible de réinitialiser les permissions.'}`);
        }

        await panelMsg.edit({ components: [buildPanel(message.guild, cfg), ...buildRows(cfg)], flags: FLAGS }).catch(() => {});
        return;
      }

      if (interaction.customId === 'captcha_publish') {
        cfg = getConfig(guildId);
        await interaction.deferUpdate();
        try {
          await publishCaptcha(client, message, cfg);
          await notify(`## ✅ CAPTCHA publié\nLe CAPTCHA a été publié dans <#${cfg.channelId}>.`);
        } catch {
          await notify('## ❌ Erreur\nImpossible de publier le CAPTCHA. Vérifiez les permissions du bot.');
        }
        await panelMsg.edit({ components: [buildContainer(message.guild, cfg)], flags: FLAGS }).catch(() => {});
        return;
      }
    });

    collector.on('end', () => {
      clearTimeout(timeout);
      panelMsg.edit({ components: [] }).catch(() => {});
    });
  }
};
