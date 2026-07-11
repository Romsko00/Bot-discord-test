const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const configManager = require('../../utils/casinoConfigManager');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const casinoAdmin = require('../../utils/casinoAdmin');
const Casino = require('../../utils/casino');
const casinoStats = require('../../utils/casinoStats');
const db = require('../../utils/simpledb');

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
  return String(num);
}

function getCasinoStats(guildId) {
  const allBalances = db.all().filter(k => (k.ID || k.key || '').startsWith('casino_credits_'));
  const totalBalance = allBalances.reduce((sum, item) => sum + (Number(item.data || item.value) || 0), 0);
  const totalPlayers = allBalances.length;
  let stats = {};
  try { stats = casinoStats.getGuildStats(guildId, 1); } catch {}
  return {
    totalPlayers, activePlayers: stats.recent?.uniquePlayers?.length || Math.floor(totalPlayers * 0.3),
    totalBalance, revenue24h: (stats.recent?.totalBets || 0) - (stats.recent?.totalWins || 0),
    games24h: stats.recent?.totalGames || 0, avgWin: stats.recent?.totalGames > 0 ? Math.floor((stats.recent?.totalWins || 0) / stats.recent.totalGames) : 0,
    rtp: stats.rtp || 0.96, currentJackpot: db.get(`casino_jackpot_${guildId}`) || db.get('casino_jackpot_global') || 0,
    topGames: stats.topGames || [], topWinners: (stats.biggestWins || []).slice(0, 5).map(w => ({ userId: w.userId, amount: w.amount }))
  };
}

function buildSectionText(guildId, section) {
  const cfg = configManager.getGuildConfig(guildId);
  const stats = getCasinoStats(guildId);
  if (section === 'main') return [
    `**Casino :** ${cfg.general.enabled ? '✅ Activé' : '❌ Désactivé'} | **Monnaie :** ${cfg.general.currency?.symbol} ${cfg.general.currency?.name}`,
    `**Joueurs :** ${stats.totalPlayers} | **JTN total :** ${formatNumber(stats.totalBalance)} | **Jackpot :** ${formatNumber(stats.currentJackpot)}`,
    `**Parties 24h :** ${stats.games24h} | **RTP :** ${(stats.rtp * 100).toFixed(2)}%`
  ].join('\n');
  if (section === 'economy') return [
    `**Solde départ :** ${formatNumber(cfg.economy.startingBalance)} | **Max :** ${formatNumber(cfg.economy.maxBalance)}`,
    `**Mise min :** ${formatNumber(cfg.economy.minBet)} | **Mise max :** ${formatNumber(cfg.economy.maxBet)}`,
    `**Protection faillite :** ${cfg.economy.bankruptcyProtection?.enabled ? `✅ (reset: ${cfg.economy.bankruptcyProtection.resetAmount})` : '❌'}`,
    `**Inflation :** ${cfg.economy.inflation?.enabled ? `✅ ${(cfg.economy.inflation.rate * 100).toFixed(2)}%/sem` : '❌'}`
  ].join('\n');
  if (section === 'games') return Object.entries(cfg.games || {}).map(([k, v]) => `**${k.toUpperCase()} :** ${v.enabled ? '✅' : '❌'} | ${v.minBet}-${v.maxBet}${v.rtp ? ` | RTP: ${(v.rtp * 100).toFixed(0)}%` : ''}`).join('\n') || 'Aucun jeu.';
  if (section === 'security') return [
    `**Anti-cheat :** ${cfg.security?.antiCheat?.enabled ? '✅' : '❌'} | **Max streak :** ${cfg.security?.antiCheat?.maxWinStreak}`,
    `**Limite gain/j :** ${formatNumber(cfg.security?.limits?.maxDailyWin)} | **Limite perte/j :** ${formatNumber(cfg.security?.limits?.maxDailyLoss)}`,
    `**Bannis :** ${(cfg.restrictions?.users?.banned || []).length} users | ${(cfg.restrictions?.roles?.blacklist || []).length} rôles`
  ].join('\n');
  if (section === 'stats') return [
    `**Joueurs :** ${stats.totalPlayers} (${stats.activePlayers} actifs) | **JTN :** ${formatNumber(stats.totalBalance)}`,
    `**Revenue 24h :** ${formatNumber(stats.revenue24h)} | **Parties :** ${stats.games24h} | **Gain moyen :** ${formatNumber(stats.avgWin)}`,
    `**Top joueurs :** ${stats.topWinners.map((w, i) => `#${i+1} <@${w.userId}> ${formatNumber(w.amount)}`).join(', ') || 'N/A'}`
  ].join('\n');
  if (section === 'promotions') { const m = cfg.multipliers || {}; return [`**Global :** x${m.global || 1.0}`, `**Weekend :** ${m.weekend?.enabled ? `✅ x${m.weekend.multiplier}` : '❌'}`, `**Happy Hour :** ${m.happyHour?.enabled ? `✅ ${m.happyHour.hours?.join('-')}h x${m.happyHour.multiplier}` : '❌'}`, `**Événement :** ${m.events?.active ? `✅ x${m.events.multiplier}` : '❌'}`].join('\n'); }
  if (section === 'logs') { const logs = casinoAdmin.getAudit(guildId, { limit: 8 }); return logs.length > 0 ? logs.map(l => `• [${new Date(l.ts).toLocaleString('fr-FR')}] **${l.type}**${l.userId ? ` <@${l.userId}>` : ''}${l.reason ? ` — ${l.reason}` : ''}`).join('\n') : 'Aucun log.'; }
  return 'Sélectionnez une section.';
}

module.exports = {
  name: 'cadmin',
  aliases: ['casinoadmin', 'adminpanel', 'casinopanel'],
  description: 'Panel d\'administration complet du casino',
  usage: '+cadmin',
  category: 'casino',
  permissionLevel: 6,
  run: async (client, message) => {
    const isAdmin = hasPermissionLevel(client, message, 6) || client.config.owners?.includes(message.author.id) || client.config.superadmin?.includes(message.author.id);
    if (!isAdmin) return reply(message, errorContainer('Cette commande est réservée aux administrateurs (niveau 6).'));
    const guildId = message.guild.id;
    let currentSection = 'main';

    const buildC = () => container(txt(`## 🎰 Panel Admin Casino — ${currentSection.charAt(0).toUpperCase() + currentSection.slice(1)}`), sep(), txt(buildSectionText(guildId, currentSection)));

    const selectMenu = new StringSelectMenuBuilder().setCustomId('cadmin_menu').setPlaceholder('🎛️ Sélectionnez une section').addOptions([
      { label: 'Menu Principal', value: 'main', emoji: '🏠' },
      { label: 'Économie', value: 'economy', emoji: '💰' },
      { label: 'Jeux', value: 'games', emoji: '🎮' },
      { label: 'Sécurité', value: 'security', emoji: '🛡️' },
      { label: 'Statistiques', value: 'stats', emoji: '📊' },
      { label: 'Promotions', value: 'promotions', emoji: '🎉' },
      { label: 'Logs & Audit', value: 'logs', emoji: '📋' }
    ]);

    const getBtnRow = (section) => {
      const btns = [new ButtonBuilder().setCustomId('cadmin_refresh').setLabel('🔄 Actualiser').setStyle(ButtonStyle.Success)];
      if (section === 'main') {
        btns.push(new ButtonBuilder().setCustomId('cadmin_toggle_casino').setLabel('🎰 Toggle Casino').setStyle(ButtonStyle.Primary));
        btns.push(new ButtonBuilder().setCustomId('cadmin_export').setLabel('📤 Exporter').setStyle(ButtonStyle.Secondary));
      } else if (section === 'economy') {
        btns.push(new ButtonBuilder().setCustomId('cadmin_edit_startbal').setLabel('💵 Solde Départ').setStyle(ButtonStyle.Primary));
        btns.push(new ButtonBuilder().setCustomId('cadmin_edit_minbet').setLabel('📉 Mise Min').setStyle(ButtonStyle.Primary));
        btns.push(new ButtonBuilder().setCustomId('cadmin_edit_maxbet').setLabel('📈 Mise Max').setStyle(ButtonStyle.Primary));
      } else if (section === 'games') {
        btns.push(new ButtonBuilder().setCustomId('cadmin_games_toggle_all').setLabel('🎮 Toggle Tous').setStyle(ButtonStyle.Danger));
      } else if (section === 'security') {
        btns.push(new ButtonBuilder().setCustomId('cadmin_toggle_anticheat').setLabel('🛡️ Anti-Cheat').setStyle(ButtonStyle.Danger));
        btns.push(new ButtonBuilder().setCustomId('cadmin_edit_dailylimit').setLabel('🛑 Limite Jour').setStyle(ButtonStyle.Secondary));
      }
      return new ActionRowBuilder().addComponents(...btns.slice(0, 5));
    };

    const sent = await message.channel.send({ components: [buildC(), new ActionRowBuilder().addComponents(selectMenu), getBtnRow(currentSection)], flags: FLAGS });
    const collector = sent.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 600000 });

    collector.on('collect', async interaction => {
      try {
        if (interaction.isStringSelectMenu()) {
          await interaction.deferUpdate();
          currentSection = interaction.values[0];
          await interaction.editReply({ components: [buildC(), new ActionRowBuilder().addComponents(selectMenu), getBtnRow(currentSection)], flags: FLAGS });
          return;
        }
        if (!interaction.isButton()) return;
        const id = interaction.customId;
        if (id === 'cadmin_refresh') { await interaction.deferUpdate(); await interaction.editReply({ components: [buildC(), new ActionRowBuilder().addComponents(selectMenu), getBtnRow(currentSection)], flags: FLAGS }); return; }
        if (id === 'cadmin_toggle_casino') {
          await interaction.deferUpdate();
          const cfg = configManager.getGuildConfig(guildId);
          cfg.general.enabled = !cfg.general.enabled;
          configManager.saveGuildConfig(guildId, cfg);
          casinoAdmin.addAudit(guildId, { type: 'config_change', userId: message.author.id, reason: `Casino ${cfg.general.enabled ? 'activé' : 'désactivé'}` });
          await interaction.editReply({ components: [buildC(), new ActionRowBuilder().addComponents(selectMenu), getBtnRow(currentSection)], flags: FLAGS });
          return;
        }
        if (id === 'cadmin_export') {
          await interaction.deferUpdate();
          const data = configManager.exportConfig(guildId);
          const buf = Buffer.from(data, 'utf-8');
          await interaction.followUp({ content: '📤 Configuration exportée:', files: [{ attachment: buf, name: `casino-config-${guildId}.json` }], ephemeral: true });
          return;
        }
        if (id === 'cadmin_games_toggle_all') {
          await interaction.deferUpdate();
          const cfg = configManager.getGuildConfig(guildId);
          const allEnabled = Object.values(cfg.games || {}).every(g => g.enabled);
          for (const k in cfg.games) cfg.games[k].enabled = !allEnabled;
          configManager.saveGuildConfig(guildId, cfg);
          await interaction.editReply({ components: [buildC(), new ActionRowBuilder().addComponents(selectMenu), getBtnRow(currentSection)], flags: FLAGS });
          return;
        }
        if (id === 'cadmin_toggle_anticheat') {
          await interaction.deferUpdate();
          const cfg = configManager.getGuildConfig(guildId);
          if (cfg.security?.antiCheat) cfg.security.antiCheat.enabled = !cfg.security.antiCheat.enabled;
          configManager.saveGuildConfig(guildId, cfg);
          await interaction.editReply({ components: [buildC(), new ActionRowBuilder().addComponents(selectMenu), getBtnRow(currentSection)], flags: FLAGS });
          return;
        }
        const modalMap = {
          cadmin_edit_startbal: { title: 'Solde de Départ', label: 'Nouveau solde', path: 'economy.startingBalance' },
          cadmin_edit_minbet: { title: 'Mise Minimum', label: 'Nouvelle mise min', path: 'economy.minBet' },
          cadmin_edit_maxbet: { title: 'Mise Maximum', label: 'Nouvelle mise max', path: 'economy.maxBet' },
          cadmin_edit_dailylimit: { title: 'Limite Gain/Jour', label: 'Nouvelle limite', path: 'security.limits.maxDailyWin' }
        };
        if (modalMap[id]) {
          const mc = modalMap[id];
          const modal = new ModalBuilder().setCustomId(`modal_${id}`).setTitle(`Éditer — ${mc.title}`);
          modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('value').setLabel(mc.label).setStyle(TextInputStyle.Short).setPlaceholder('Ex: 1000').setRequired(true)));
          await interaction.showModal(modal);
          try {
            const sub = await interaction.awaitModalSubmit({ time: 60000, filter: i => i.user.id === message.author.id && i.customId === `modal_${id}` });
            const val = parseInt(sub.fields.getTextInputValue('value'));
            if (isNaN(val) || val < 0) { await sub.reply({ content: '❌ Valeur invalide.', ephemeral: true }); return; }
            configManager.updateConfigValue(guildId, mc.path, val);
            casinoAdmin.addAudit(guildId, { type: 'config_change', userId: message.author.id, reason: `${mc.title} → ${val}` });
            await sub.reply({ content: `✅ **${mc.title}** mis à jour à **${formatNumber(val)}** !`, ephemeral: true });
            await sent.edit({ components: [buildC(), new ActionRowBuilder().addComponents(selectMenu), getBtnRow(currentSection)], flags: FLAGS });
          } catch {}
          return;
        }
      } catch (err) { try { if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ Erreur interaction.', ephemeral: true }); } catch {} }
    });
    collector.on('end', () => sent.edit({ components: [buildC()] }).catch(() => {}));
  }
};
