const Discord = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');
const ms = require('ms');

function crypt(str, mask, n = 1) {
  if (!str) return 'Non défini';
  return ('' + str).slice(0, -n).replace(/./g, mask) + ('' + str).slice(-n);
}
function getChannelDisplay(guild, channelId) {
  if (!channelId) return '❌ Non configuré';
  const ch = guild.channels.cache.get(channelId);
  return ch ? `${ch}` : '❌ Salon introuvable';
}
function getIntervalDisplay(interval) {
  if (!interval) return '2m';
  try { return ms(interval, { long: true }); } catch { return '2m'; }
}
function isValidTimeFormat(t) { return /^\d+[smh]$/.test(t); }
function isValidColor(c) { return /^#([0-9A-F]{3}){1,2}$/i.test(c) || ['red','green','blue','yellow','purple','orange','pink','black','white','gray','grey'].includes(c.toLowerCase()); }

function buildConfigContainer(guild) {
  const g = guild.id;
  return container(
    txt('## 🖼️ Configuration Images de Profil Aléatoires'),
    sep(),
    txt([
      `**Salon photos :** ${getChannelDisplay(guild, db.get(`randompp_${g}`))}`,
      `**Salon bannières :** ${getChannelDisplay(guild, db.get(`randombanner_${g}`))}`,
      `**Salon GIFs :** ${getChannelDisplay(guild, db.get(`randomgif_${g}`))}`,
      `**Intervalle :** ${getIntervalDisplay(db.get(`randominterval_${g}`))}`,
      `**Couleur :** \`${db.get(`randomcolor_${g}`) || '#2f3136'}\``
    ].join('\n'))
  );
}

module.exports = {
  name: 'setpp',
  aliases: [],
  description: 'Change l\'avatar du serveur',

  run: async (client, message) => {
    let hasPermission = false;
    for (const role of message.member.roles.cache.values()) { if (db.get(`ownerp_${message.guild.id}_${role.id}`)) { hasPermission = true; break; } }
    if (!client.config.superadmin?.includes(message.author.id) && !client.config.owners?.includes(message.author.id) && !db.get(`ownermd_${client.user.id}_${message.author.id}`) && !hasPermission)
      return reply(message, errorContainer('Vous n\'avez pas la permission.'));

    const g = message.guild.id;
    const buildMenu = () => [
      new Discord.ActionRowBuilder().addComponents(
        new Discord.StringSelectMenuBuilder().setCustomId('pp_config_menu').setPlaceholder('Choisissez une option').addOptions([
          { label: 'Modifier l\'intervalle', value: 'edit_interval', emoji: '🕗' },
          { label: 'Modifier la couleur', value: 'edit_color', emoji: '🎨' },
          { label: 'Salon photos', value: 'edit_pp_channel', emoji: '📷' },
          { label: 'Salon bannières', value: 'edit_banner_channel', emoji: '🔳' },
          { label: 'Salon GIFs', value: 'edit_gif_channel', emoji: '📡' }
        ])
      ),
      new Discord.ActionRowBuilder().addComponents(
        new Discord.ButtonBuilder().setCustomId('pp_refresh').setLabel('Rafraîchir').setEmoji('🔄').setStyle(Discord.ButtonStyle.Secondary),
        new Discord.ButtonBuilder().setCustomId('pp_clear').setLabel('Tout supprimer').setEmoji('🗑️').setStyle(Discord.ButtonStyle.Danger)
      )
    ];

    const configMessage = await message.channel.send({ components: [buildConfigContainer(message.guild), ...buildMenu()], flags: FLAGS });
    const refresh = () => configMessage.edit({ components: [buildConfigContainer(message.guild), ...buildMenu()], flags: FLAGS }).catch(() => {});

    const ask = async (prompt) => {
      const q = await message.channel.send(prompt);
      try {
        const c = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 60000, errors: ['time'] });
        const r = c.first(); await q.delete().catch(() => {}); await r.delete().catch(() => {}); return r.content.trim();
      } catch { await q.delete().catch(() => {}); return null; }
    };

    const collector = configMessage.createMessageComponentCollector({ time: 300000, filter: i => i.user.id === message.author.id });
    collector.on('collect', async (interaction) => {
      if (interaction.isStringSelectMenu()) {
        await interaction.deferUpdate();
        const val = interaction.values[0];
        if (val === 'edit_interval') {
          const v = await ask('Entrez le nouvel intervalle (ex: 30s, 2m, 1h). Minimum: 30 secondes :');
          if (v) { if (!isValidTimeFormat(v)) return message.channel.send('Format invalide.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000)); const ms_ = ms(v); if (ms_ < 30000) return message.channel.send('Intervalle minimum : 30s.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000)); db.set(`randominterval_${g}`, ms_); }
        } else if (val === 'edit_color') {
          const v = await ask('Entrez la couleur (hex: #FF0000 ou nom) :');
          if (v) { if (!isValidColor(v)) return message.channel.send('Couleur invalide.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000)); db.set(`randomcolor_${g}`, v); }
        } else {
          const dbKey = { edit_pp_channel: 'randompp', edit_banner_channel: 'randombanner', edit_gif_channel: 'randomgif' }[val];
          const typeName = { edit_pp_channel: 'photos', edit_banner_channel: 'bannières', edit_gif_channel: 'GIFs' }[val];
          if (dbKey) {
            const v = await ask(`Mentionnez le salon pour les **${typeName}** (ou tapez \`supprimer\`) :`);
            if (v) {
              if (v.toLowerCase() === 'supprimer') { db.delete(`${dbKey}_${g}`); }
              else { const ch = message.mentions.channels.first() || message.guild.channels.cache.get(v.replace(/\D/g, '')); if (!ch?.isTextBased()) return message.channel.send('Salon introuvable.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000)); db.set(`${dbKey}_${g}`, ch.id); }
            }
          }
        }
        await refresh();
      } else if (interaction.isButton()) {
        await interaction.deferUpdate();
        if (interaction.customId === 'pp_refresh') { await refresh(); }
        else if (interaction.customId === 'pp_clear') {
          const conf = await message.channel.send({ components: [container(txt('## ⚠️ Confirmation'), sep(), txt('Supprimer toutes les configurations ?')), new Discord.ActionRowBuilder().addComponents(new Discord.ButtonBuilder().setCustomId('pp_confirm_yes').setLabel('Confirmer').setStyle(Discord.ButtonStyle.Danger), new Discord.ButtonBuilder().setCustomId('pp_confirm_no').setLabel('Annuler').setStyle(Discord.ButtonStyle.Secondary))], flags: FLAGS });
          try {
            const c = await conf.awaitMessageComponent({ filter: i => i.user.id === message.author.id, time: 15000 });
            if (c.customId === 'pp_confirm_yes') { ['randompp','randombanner','randomgif','randominterval','randomcolor'].forEach(k => db.delete(`${k}_${g}`)); await c.deferUpdate(); await conf.delete().catch(() => {}); await refresh(); }
            else { await c.deferUpdate(); await conf.delete().catch(() => {}); }
          } catch { await conf.delete().catch(() => {}); }
        }
      }
    });
    collector.on('end', () => configMessage.edit({ components: [buildConfigContainer(message.guild)], flags: FLAGS }).catch(() => {}));
  }
};
