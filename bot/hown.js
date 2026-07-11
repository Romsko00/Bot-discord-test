const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const { container, txt, sep, row, btn, reply, errorContainer, FLAGS } = require('../../utils/v2');

const isSuperAdmin = (client, userId) => Array.isArray(client.config?.superadmin) && client.config.superadmin.includes(userId);
const getClients = () => Array.isArray(globalThis.allClients) ? globalThis.allClients : [];
const getOnlineBots = () => getClients().filter(c => c?.user?.id);
const announceStates = new Map();

async function buildDashboardContent(client) {
  const bots = getOnlineBots();
  const totalGuilds = bots.reduce((s, c) => s + c.guilds.cache.size, 0);
  const totalUsers = bots.reduce((s, c) => s + c.guilds.cache.reduce((ss, g) => ss + (g.memberCount || 0), 0), 0);
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s2 = Math.floor(uptime % 60);
  return [
    `**🤖 Bots actifs :** ${bots.length}`,
    `**🌐 Serveurs :** ${totalGuilds}`,
    `**👥 Membres :** ${totalUsers.toLocaleString()}`,
    `**⏱️ Uptime :** ${h}h ${m}m ${s2}s`,
    `**🏓 Ping :** ${client.ws.ping}ms`,
    `**💾 RAM :** ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`,
    bots.length ? `\n**Bots connectés :**\n${bots.map((c, i) => `**${i + 1}.** ${c.user.tag} — ${c.guilds.cache.size} serveurs | ${c.ws.ping}ms`).join('\n')}` : ''
  ].join('\n');
}

function buildDashboardContainer(dashContent, bots, uid) {
  const comps = [
    txt('## 🎛️ Panel SuperAdmin'),
    sep(),
    txt(dashContent),
    sep()
  ];

  if (bots.length) {
    const options = bots.slice(0, 25).map((c) => ({ label: c.user.tag.slice(0, 100), description: `${c.guilds.cache.size} serveur(s)`, value: c.user.id }));
    comps.push(row(new StringSelectMenuBuilder().setCustomId('hown_bot_select').setPlaceholder('Sélectionner un bot...').addOptions(options)));
  }

  comps.push(row(
    new ButtonBuilder().setCustomId('hown_bots').setLabel('🤖 Bots').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('hown_announce').setLabel('📢 Annonce').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('hown_stats').setLabel('📊 Stats').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('hown_leave_server').setLabel('🚪 Quitter Serveur').setStyle(ButtonStyle.Danger)
  ));

  return container(...comps);
}

module.exports = {
  name: 'hown',
  aliases: ['ownerpanel', 'adminpanel', 'panelowner'],
  description: 'Panel de contrôle SuperAdmin multi-bots',
  category: 'bot',
  level: 9,
  run: async (client, message) => {
    if (!isSuperAdmin(client, message.author.id)) return reply(message, errorContainer('**Accès refusé** — Réservé aux SuperAdmins.'));

    const dashContent = await buildDashboardContent(client);
    const bots = getOnlineBots();
    const uid = message.author.id;

    const panelMsg = await message.channel.send({ components: [buildDashboardContainer(dashContent, bots, uid)], flags: FLAGS });

    let selectedBotId = client.user.id;
    const getSelectedClient = () => getOnlineBots().find(c => c.user.id === selectedBotId) || client;

    const collector = panelMsg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 600_000, idle: 120_000 });

    collector.on('collect', async interaction => {
      try {
        const cid = interaction.customId;

        if (cid === 'hown_bot_select') {
          selectedBotId = interaction.values[0];
          const sc = getSelectedClient();
          const guildOptions = Array.from(sc.guilds.cache.values()).slice(0, 25).map(g => ({ label: g.name.slice(0, 100), description: `${g.memberCount} membres`, value: g.id }));
          const comps = [
            txt(`## 🤖 Bot — ${sc.user.tag}`),
            sep(),
            txt([`**Serveurs :** ${sc.guilds.cache.size}`, `**Ping :** ${sc.ws.ping}ms`].join('\n')),
            sep()
          ];
          if (guildOptions.length) comps.push(row(new StringSelectMenuBuilder().setCustomId('hown_guild_select').setPlaceholder('🌐 Sélectionner un serveur...').addOptions(guildOptions)));
          comps.push(row(
            new ButtonBuilder().setCustomId('hown_bots').setLabel('🤖 Bots').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('hown_announce').setLabel('📢 Annonce').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('hown_stats').setLabel('📊 Stats').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('hown_leave_server').setLabel('🚪 Quitter Serveur').setStyle(ButtonStyle.Danger)
          ));
          await interaction.update({ components: [container(...comps)], flags: FLAGS });
          return;
        }

        if (cid === 'hown_guild_select') {
          const guildId = interaction.values[0], sc = getSelectedClient(), guild = sc.guilds.cache.get(guildId);
          if (!guild) { await interaction.reply({ content: '❌ Serveur introuvable.', ephemeral: true }); return; }
          await interaction.update({ components: [container(
            txt(`## 🌐 ${guild.name}`),
            sep(),
            txt([`**ID :** ${guild.id}`, `**Membres :** ${guild.memberCount}`, `**Propriétaire :** <@${guild.ownerId}>`, `**Salons :** ${guild.channels.cache.size}`, `**Boosts :** ${guild.premiumSubscriptionCount || 0}`].join('\n')),
            sep(),
            row(
              new ButtonBuilder().setCustomId(`hown_invite_${guildId}`).setLabel('🔗 Invitation').setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId(`hown_quit_guild_${guildId}`).setLabel('🚪 Quitter').setStyle(ButtonStyle.Danger),
              new ButtonBuilder().setCustomId('hown_stats').setLabel('↩ Retour').setStyle(ButtonStyle.Secondary)
            )
          )], flags: FLAGS });
          return;
        }

        if (cid === 'hown_stats' || cid.startsWith('hown_bots') || cid.startsWith('hown_back_')) {
          const dc = await buildDashboardContent(client);
          const b2 = getOnlineBots();
          await interaction.update({ components: [buildDashboardContainer(dc, b2, uid)], flags: FLAGS });
          return;
        }

        if (cid === 'hown_announce') {
          if (!announceStates.has(uid)) announceStates.set(uid, { title: '', description: '', color: '#5b58e2', image: '', footer: '' });
          const state = announceStates.get(uid);
          await interaction.update({ components: [container(
            txt('## 📢 Annonce Globale'),
            sep(),
            txt([`**Titre :** ${state.title || 'Non défini'}`, `**Description :** ${(state.description || 'Vide').slice(0, 100)}`, `**Couleur :** ${state.color}`].join('\n')),
            sep(),
            row(
              new ButtonBuilder().setCustomId(`hown_ae_title_${uid}`).setLabel('📝 Titre').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId(`hown_ae_desc_${uid}`).setLabel('📄 Description').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId(`hown_ae_color_${uid}`).setLabel('🎨 Couleur').setStyle(ButtonStyle.Secondary)
            ),
            row(
              new ButtonBuilder().setCustomId(`hown_ae_send_${uid}`).setLabel('🚀 Envoyer').setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId(`hown_back_${uid}`).setLabel('↩ Retour').setStyle(ButtonStyle.Danger)
            )
          )], flags: FLAGS });
          return;
        }

        const embFieldMap = {
          [`hown_ae_title_${uid}`]: ['Titre', 'title', TextInputStyle.Short],
          [`hown_ae_desc_${uid}`]: ['Description', 'description', TextInputStyle.Paragraph],
          [`hown_ae_color_${uid}`]: ['Couleur (HEX)', 'color', TextInputStyle.Short]
        };
        if (embFieldMap[cid]) {
          const [label, field, style] = embFieldMap[cid];
          const modal = new ModalBuilder().setCustomId(`hown_ae_modal_${field}_${uid}`).setTitle(`Modifier : ${label}`);
          modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('value').setLabel(label).setStyle(style).setRequired(false).setValue(announceStates.get(uid)?.[field] || '')));
          await interaction.showModal(modal);
          return;
        }

        if (cid === `hown_ae_send_${uid}`) {
          await interaction.deferUpdate();
          const { EmbedBuilder } = require('discord.js');
          const state = announceStates.get(uid) || {};
          const embed = new EmbedBuilder().setColor(state.color || '#5b58e2');
          if (state.title) embed.setTitle(state.title);
          if (state.description) embed.setDescription(state.description);
          if (state.footer) embed.setFooter({ text: state.footer });
          embed.setTimestamp();
          let sent = 0, failed = 0;
          for (const bot of getOnlineBots()) {
            for (const guild of bot.guilds.cache.values()) {
              const zoomCh = guild.channels.cache.find(ch => ch.name === 'annonce-zoom' && ch.isTextBased());
              if (zoomCh) { try { await zoomCh.send({ embeds: [embed] }); sent++; } catch { failed++; } }
            }
          }
          await panelMsg.edit({ components: [container(txt('## ✅ Annonce Envoyée'), sep(), txt([`**Salons atteints :** ${sent}`, `**Échecs :** ${failed}`].join('\n')))], flags: FLAGS }).catch(() => {});
          return;
        }

        if (cid === 'hown_leave_server') {
          const sc = getSelectedClient(), guildOptions = Array.from(sc.guilds.cache.values()).slice(0, 25).map(g => ({ label: g.name.slice(0, 100), description: `${g.memberCount} membres`, value: g.id }));
          if (!guildOptions.length) { await interaction.reply({ content: '❌ Aucun serveur.', ephemeral: true }); return; }
          await interaction.update({ components: [container(
            txt('## 🚪 Quitter un Serveur'),
            sep(),
            txt('Sélectionnez le serveur à quitter.'),
            row(new StringSelectMenuBuilder().setCustomId('hown_quit_select').setPlaceholder('Choisir le serveur...').addOptions(guildOptions))
          )], flags: FLAGS });
          return;
        }

        if (cid === 'hown_quit_select') {
          const guildId = interaction.values[0], sc = getSelectedClient(), guild = sc.guilds.cache.get(guildId), name = guild?.name || guildId;
          if (guild) await guild.leave().catch(() => {});
          await interaction.update({ components: [container(txt(`## ✅ Serveur Quitté`), sep(), txt(`Le bot a quitté **${name}**.`))], flags: FLAGS });
          return;
        }

        if (cid.startsWith('hown_invite_')) {
          const guildId = cid.replace('hown_invite_', ''), sc = getSelectedClient(), guild = sc.guilds.cache.get(guildId);
          if (!guild) { await interaction.reply({ content: '❌ Serveur introuvable.', ephemeral: true }); return; }
          const invCh = guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.CreateInstantInvite));
          if (!invCh) { await interaction.reply({ content: '❌ Impossible de créer une invitation.', ephemeral: true }); return; }
          const invite = await invCh.createInvite({ maxAge: 3600, maxUses: 1 });
          await interaction.reply({ content: `🔗 Invitation (1h) : **${invite.url}**`, ephemeral: true });
          return;
        }

        if (cid.startsWith('hown_quit_guild_')) {
          const guildId = cid.replace('hown_quit_guild_', ''), sc = getSelectedClient(), guild = sc.guilds.cache.get(guildId);
          if (guild) await guild.leave().catch(() => {});
          await interaction.reply({ content: `✅ Serveur quitté.`, ephemeral: true });
          return;
        }

        await interaction.deferUpdate().catch(() => {});
      } catch (e) { console.error('[hown]', e); try { await interaction.deferUpdate(); } catch {} }
    });

    collector.on('modalSubmit', async (submit) => {
      try {
        await submit.deferUpdate();
        const parts = submit.customId.split('_');
        const field = parts[3], uid2 = parts[4];
        if (!announceStates.has(uid2)) return;
        announceStates.get(uid2)[field] = submit.fields.getTextInputValue('value') || '';
      } catch (e) { console.error('[hown modalSubmit]', e); }
    });

    collector.on('end', () => panelMsg.edit({ components: [] }).catch(() => {}));
  }
};
