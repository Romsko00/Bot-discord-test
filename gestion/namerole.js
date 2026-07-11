const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  RoleSelectMenuBuilder
} = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

function getConfig(guildId) {
  return db.get(`namerole_${guildId}`) || { enabled: false, keyword: null, roleId: null };
}

function buildPanel(guild, cfg) {
  const role = cfg.roleId ? guild.roles.cache.get(cfg.roleId) : null;
  const lines = [
    `**Statut :** ${cfg.enabled ? '🟢 Actif' : '🔴 Désactivé'}`,
    `**Pseudo recherché :** ${cfg.keyword ? `\`${cfg.keyword}\`` : '*Pas défini*'}`,
    `**Rôle attribué :** ${role ? role.toString() : '❌ Non défini'}`,
  ];
  return container(
    txt('## 🏷️ Configuration Name Rôle'),
    sep(),
    txt('Système d\'attribution automatique de rôle aux membres dont le pseudo contient un élément spécifique.'),
    sep(),
    txt(lines.join('\n'))
  );
}

function buildRows(cfg) {
  const toggleBtn = new ButtonBuilder()
    .setCustomId('namerole_toggle')
    .setLabel(cfg.enabled ? 'Désactiver' : 'Activer')
    .setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const keywordBtn = new ButtonBuilder()
    .setCustomId('namerole_keyword')
    .setLabel('Configurer le pseudo')
    .setStyle(ButtonStyle.Primary);

  const closeBtn = new ButtonBuilder()
    .setCustomId('namerole_close')
    .setLabel('Fermer')
    .setStyle(ButtonStyle.Secondary);

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId('namerole_role')
    .setPlaceholder('Sélectionner le rôle à attribuer')
    .setMinValues(0)
    .setMaxValues(1);

  return [
    new ActionRowBuilder().addComponents(toggleBtn, keywordBtn, closeBtn),
    new ActionRowBuilder().addComponents(roleSelect),
  ];
}

module.exports = {
  name: 'namerole',
  aliases: ['namedrole', 'pseudorole'],
  description: 'Configure l\'attribution automatique de rôle selon le pseudo',
  category: 'gestion',
  level: 4,
  run: async (client, message) => {
    if (!hasPermissionLevel(client, message, 4)) {
      return reply(message, errorContainer('**Permission insuffisante** — Niveau 4 (Admin) requis.'));
    }

    const guildId = message.guild.id;
    let cfg = getConfig(guildId);

    const panelMsg = await message.channel.send({
      components: [buildPanel(message.guild, cfg), ...buildRows(cfg)],
      flags: FLAGS
    });

    const timeout = setTimeout(() => {
      panelMsg.edit({ components: [] }).catch(() => {});
    }, 300_000);

    const collector = panelMsg.createMessageComponentCollector({
      filter: i => i.user.id === message.author.id,
      time: 300_000
    });

    const refresh = async () => {
      cfg = getConfig(guildId);
      await panelMsg.edit({
        components: [buildPanel(message.guild, cfg), ...buildRows(cfg)],
        flags: FLAGS
      }).catch(() => {});
    };

    collector.on('collect', async interaction => {
      if (interaction.customId === 'namerole_close') {
        clearTimeout(timeout);
        collector.stop();
        return interaction.update({ components: [] });
      }

      if (interaction.customId === 'namerole_toggle') {
        cfg = getConfig(guildId);
        cfg.enabled = !cfg.enabled;
        db.set(`namerole_${guildId}`, cfg);
        return interaction.update({
          components: [buildPanel(message.guild, cfg), ...buildRows(cfg)]
        });
      }

      if (interaction.customId === 'namerole_keyword') {
        const modal = new ModalBuilder()
          .setCustomId('namerole_keyword_modal')
          .setTitle('Configurer le pseudo recherché')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('keyword_input')
                .setLabel('Élément de pseudo (ex: [STAFF], VIP, etc.)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Entrez le texte à rechercher dans le pseudo...')
                .setRequired(true)
                .setMaxLength(50)
            )
          );
        await interaction.showModal(modal);

        try {
          const modalInter = await interaction.awaitModalSubmit({ time: 120_000, filter: i => i.user.id === message.author.id });
          const keyword = modalInter.fields.getTextInputValue('keyword_input').trim();
          cfg = getConfig(guildId);
          cfg.keyword = keyword;
          db.set(`namerole_${guildId}`, cfg);
          await modalInter.deferUpdate();
          await refresh();
        } catch {}
        return;
      }

      if (interaction.customId === 'namerole_role') {
        cfg = getConfig(guildId);
        cfg.roleId = interaction.values[0] || null;
        db.set(`namerole_${guildId}`, cfg);
        return interaction.update({
          components: [buildPanel(message.guild, cfg), ...buildRows(cfg)]
        });
      }
    });

    collector.on('end', () => {
      clearTimeout(timeout);
      panelMsg.edit({ components: [] }).catch(() => {});
    });
  }
};
