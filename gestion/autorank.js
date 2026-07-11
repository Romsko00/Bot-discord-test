const { ActionRowBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, ButtonBuilder, ButtonStyle } = require('discord.js');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { getConfig, setConfig } = require('../../utils/autorank');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

function buildText(guild) {
  const cfg = getConfig(guild.id);
  const channels = (cfg.allowedChannels || []).filter(id => guild.channels.cache.has(id));
  const roles = (cfg.rolesToGrant || []).filter(id => guild.roles.cache.has(id));
  return [
    `**Statut :** ${cfg.enabled ? '✅ Activé' : '❌ Désactivé'} | **Logs :** ${cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'Non configuré'}`,
    `**Salons autorisés (${channels.length}) :** ${channels.length ? channels.map(id => `<#${id}>`).join(', ') : 'Tous'}`,
    `**Rôles (${roles.length}) :** ${roles.length ? roles.map(id => { const r = guild.roles.cache.get(id); return r ? `${r.name} (\`${r.id}\`)` : `~~${id}~~`; }).join(', ') : 'Aucun'}`
  ].join('\n');
}

function buildMainRows(guildId) {
  const cfg = getConfig(guildId);
  const ch = (cfg.allowedChannels || []).length, rl = (cfg.rolesToGrant || []).length;
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ar_toggle').setLabel(cfg.enabled ? 'Désactiver' : 'Activer').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ar_setlog').setLabel('Salon logs').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ar_clearlog').setLabel('Retirer logs').setStyle(ButtonStyle.Secondary).setDisabled(!cfg.logChannelId)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ar_ch_add').setLabel('+ Salon').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ar_ch_count').setLabel(`Salons: ${ch}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('ar_ch_remove').setLabel('- Salon').setStyle(ButtonStyle.Secondary).setDisabled(ch === 0),
      new ButtonBuilder().setCustomId('ar_ch_clear').setLabel('🗑️').setStyle(ButtonStyle.Danger).setDisabled(ch === 0)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ar_rl_add').setLabel('+ Rôle').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ar_rl_count').setLabel(`Rôles: ${rl}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('ar_rl_remove').setLabel('- Rôle').setStyle(ButtonStyle.Secondary).setDisabled(rl === 0),
      new ButtonBuilder().setCustomId('ar_rl_clear').setLabel('🗑️').setStyle(ButtonStyle.Danger).setDisabled(rl === 0)
    )
  ];
}

module.exports = {
  name: 'autorank',
  aliases: [],
  description: 'Attribution automatique de rôles',
  category: 'gestion',
  run: async (client, message) => {
    if (!hasPermissionLevel(client, message, 6)) return reply(message, errorContainer('Permission insuffisante.'));
    const guildId = message.guild.id;
    const build = () => container(txt('## 🏆 AutoRank — Configuration'), sep(), txt(buildText(message.guild)));
    const msg = await message.channel.send({ components: [build(), ...buildMainRows(guildId)], flags: FLAGS });
    const refresh = () => msg.edit({ components: [build(), ...buildMainRows(guildId)], flags: FLAGS }).catch(() => {});
    const backRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ar_back').setLabel('↩ Retour').setStyle(ButtonStyle.Secondary));
    const col = msg.createMessageComponentCollector({ time: 300000, filter: i => i.user.id === message.author.id });
    col.on('collect', async i => {
      const cid = i.customId;
      if (cid === 'ar_toggle') { await i.deferUpdate(); setConfig(guildId, { enabled: !getConfig(guildId).enabled }); await refresh(); return; }
      if (cid === 'ar_clearlog') { await i.deferUpdate(); setConfig(guildId, { logChannelId: null }); await refresh(); return; }
      if (cid === 'ar_ch_clear') { await i.deferUpdate(); setConfig(guildId, { allowedChannels: [] }); await refresh(); return; }
      if (cid === 'ar_rl_clear') { await i.deferUpdate(); setConfig(guildId, { rolesToGrant: [] }); await refresh(); return; }
      if (cid === 'ar_back') { await i.deferUpdate(); await msg.edit({ components: [build(), ...buildMainRows(guildId)], flags: FLAGS }).catch(() => {}); return; }
      if (cid === 'ar_setlog') { await i.deferUpdate(); await msg.edit({ components: [container(txt('## 📋 Salon de Logs')), new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('ar_log_select').setPlaceholder('Sélectionner un salon').setChannelTypes(ChannelType.GuildText)), backRow], flags: FLAGS }).catch(() => {}); return; }
      if (cid === 'ar_ch_add') { await i.deferUpdate(); await msg.edit({ components: [container(txt('## ➕ Ajouter Salons')), new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('ar_ch_select').setPlaceholder('Sélectionner des salons').setChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(10)), backRow], flags: FLAGS }).catch(() => {}); return; }
      if (cid === 'ar_ch_remove') {
        await i.deferUpdate(); const cfg = getConfig(guildId);
        const opts = (cfg.allowedChannels || []).slice(0, 25).map(id => { const c = message.guild.channels.cache.get(id); return { label: c?.name || id, value: id }; });
        if (!opts.length) return;
        await msg.edit({ components: [container(txt('## ➖ Retirer Salons')), new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ar_ch_deselect').setPlaceholder('Sélectionner').addOptions(opts).setMinValues(1).setMaxValues(opts.length)), backRow], flags: FLAGS }).catch(() => {}); return;
      }
      if (cid === 'ar_rl_add') { await i.deferUpdate(); await msg.edit({ components: [container(txt('## ➕ Ajouter Rôles')), new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('ar_rl_select').setPlaceholder('Sélectionner des rôles').setMinValues(1).setMaxValues(10)), backRow], flags: FLAGS }).catch(() => {}); return; }
      if (cid === 'ar_rl_remove') {
        await i.deferUpdate(); const cfg = getConfig(guildId);
        const opts = (cfg.rolesToGrant || []).slice(0, 25).map(id => { const r = message.guild.roles.cache.get(id); return { label: r?.name || id, value: id }; });
        if (!opts.length) return;
        await msg.edit({ components: [container(txt('## ➖ Retirer Rôles')), new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ar_rl_deselect').setPlaceholder('Sélectionner').addOptions(opts).setMinValues(1).setMaxValues(opts.length)), backRow], flags: FLAGS }).catch(() => {}); return;
      }
      if (cid === 'ar_ch_select') { await i.deferUpdate(); const cfg = getConfig(guildId); setConfig(guildId, { allowedChannels: Array.from(new Set([...(cfg.allowedChannels||[]), ...i.values])) }); await refresh(); return; }
      if (cid === 'ar_ch_deselect') { await i.deferUpdate(); const cfg = getConfig(guildId); setConfig(guildId, { allowedChannels: (cfg.allowedChannels||[]).filter(id => !i.values.includes(id)) }); await refresh(); return; }
      if (cid === 'ar_rl_select') { await i.deferUpdate(); const cfg = getConfig(guildId); setConfig(guildId, { rolesToGrant: Array.from(new Set([...(cfg.rolesToGrant||[]), ...i.values])) }); await refresh(); return; }
      if (cid === 'ar_rl_deselect') { await i.deferUpdate(); const cfg = getConfig(guildId); setConfig(guildId, { rolesToGrant: (cfg.rolesToGrant||[]).filter(id => !i.values.includes(id)) }); await refresh(); return; }
      if (cid === 'ar_log_select') { await i.deferUpdate(); setConfig(guildId, { logChannelId: i.values[0] }); await refresh(); return; }
    });
    col.on('end', () => msg.edit({ components: [build()], flags: FLAGS }).catch(() => {}));
  }
};
