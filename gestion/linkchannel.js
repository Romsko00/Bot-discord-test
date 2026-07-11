const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType } = require('discord.js');
const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

const ITEMS_PER_PAGE = 5;
function getChannels(guildId) { return db.get(`linkchannel_${guildId}`) || []; }
function setChannels(guildId, channels) { db.set(`linkchannel_${guildId}`, channels); }

function buildContent(guild, page) {
  const channels = getChannels(guild.id);
  const totalPages = Math.max(1, Math.ceil(channels.length / ITEMS_PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * ITEMS_PER_PAGE;
  const slice = channels.slice(start, start + ITEMS_PER_PAGE);
  const lines = slice.length ? slice.map((chId, idx) => { const ch = guild.channels.cache.get(chId); return `**${start+idx+1}.** ${ch?`<#${chId}>`:`*Inconnu (${chId})*`}`; }) : ['*Aucun salon autorisé pour le moment.*'];
  return { content: container(txt('## 🔗 Salons Autorisés pour les Liens'), sep(), txt(lines.join('\n') + `\n\n*Page ${safePage}/${totalPages} — ${channels.length} salon(s)*`)), safePage, totalPages };
}

function buildRows(msgId, page, totalPages, guild) {
  const channels = getChannels(guild.id);
  const textChannels = guild.channels.cache.filter(c => c.type===ChannelType.GuildText||c.type===ChannelType.GuildAnnouncement).sort((a,b) => a.position-b.position).first(25);
  const addOptions = textChannels.map(ch => { const already = channels.includes(ch.id); return new StringSelectMenuOptionBuilder().setLabel((already?'✓ ':'')+ch.name.slice(0,95)).setValue(ch.id).setDescription(already?'Déjà autorisé':'Cliquer pour autoriser'); });
  const addMenu = new StringSelectMenuBuilder().setCustomId(`lc_add_${msgId}`).setPlaceholder('Autoriser les liens dans…').addOptions(addOptions.length ? addOptions : [new StringSelectMenuOptionBuilder().setLabel('Aucun salon disponible').setValue('__none__')]);
  const row1 = new ActionRowBuilder().addComponents(addMenu);
  const prevBtn = new ButtonBuilder().setCustomId(`lc_prev_${msgId}`).setLabel('<').setStyle(ButtonStyle.Secondary).setDisabled(page<=1);
  const nextBtn = new ButtonBuilder().setCustomId(`lc_next_${msgId}`).setLabel('>').setStyle(ButtonStyle.Secondary).setDisabled(page>=totalPages);
  const delBtn = new ButtonBuilder().setCustomId(`lc_del_${msgId}`).setLabel('Supprimer un salon').setStyle(ButtonStyle.Danger);
  const rows = [row1, new ActionRowBuilder().addComponents(prevBtn, nextBtn, delBtn)];
  if (channels.length > 0) rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`lc_delall_${msgId}`).setLabel('Tout supprimer').setStyle(ButtonStyle.Danger)));
  return rows;
}

module.exports = {
  name: 'linkchannel',
  aliases: ['lc', 'linkcanal'],
  description: 'Gérer les salons où les liens sont autorisés (bypass anti-lien)',
  category: 'gestion',
  run: async (client, message) => {
    const isOwner = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!isOwner) return reply(message, errorContainer("Vous n'avez pas la permission d'utiliser cette commande."));
    let page = 1;
    const { content, safePage, totalPages } = buildContent(message.guild, page);
    const msg = await message.channel.send({ components: [content, ...buildRows(message.id, safePage, totalPages, message.guild)], flags: FLAGS });
    const state = { page: safePage };
    const refresh = () => { const { content: c, safePage: p, totalPages: tp } = buildContent(message.guild, state.page); state.page = p; return msg.edit({ components: [c, ...buildRows(message.id, p, tp, message.guild)], flags: FLAGS }).catch(()=>{}); };

    const collector = msg.createMessageComponentCollector({ time: 300000 });
    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== message.author.id) return interaction.reply({ content: 'Cette interface est réservée à son créateur.', ephemeral: true });
      await interaction.deferUpdate();
      const id = interaction.customId;
      if (id === `lc_prev_${message.id}`) { state.page = Math.max(1, state.page-1); await refresh(); return; }
      if (id === `lc_next_${message.id}`) { state.page = state.page+1; await refresh(); return; }
      if (id === `lc_add_${message.id}`) { const chId = interaction.values[0]; if (chId==='__none__') return; const chs = getChannels(message.guild.id); if (!chs.includes(chId)) { chs.push(chId); setChannels(message.guild.id, chs); } await refresh(); return; }
      if (id === `lc_delall_${message.id}`) { setChannels(message.guild.id, []); state.page=1; await refresh(); return; }
      if (id === `lc_del_${message.id}`) {
        const channels = getChannels(message.guild.id);
        if (!channels.length) return;
        const delOptions = channels.slice(0,25).map(chId => { const ch=message.guild.channels.cache.get(chId); return new StringSelectMenuOptionBuilder().setLabel(ch?ch.name.slice(0,97):chId).setValue(chId); });
        const delMenu = new StringSelectMenuBuilder().setCustomId(`lc_doremove_${message.id}`).setPlaceholder('Choisir le salon à retirer…').addOptions(delOptions);
        const delMsg = await message.channel.send({ components: [container(txt('## 🗑️ Supprimer un salon'), sep(), txt('Sélectionne le salon à retirer de la liste.')), new ActionRowBuilder().addComponents(delMenu), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`lc_delcancel_${message.id}`).setLabel('Annuler').setStyle(ButtonStyle.Secondary))], flags: FLAGS });
        const delCollector = delMsg.createMessageComponentCollector({ time: 60000, max: 1 });
        delCollector.on('collect', async (di) => {
          if (di.user.id !== message.author.id) return di.reply({ content: 'Réservé à l\'auteur.', ephemeral: true });
          await di.deferUpdate().catch(()=>{});
          if (di.customId === `lc_doremove_${message.id}`) { const updated = getChannels(message.guild.id).filter(id => id!==di.values[0]); setChannels(message.guild.id, updated); }
          delMsg.delete().catch(()=>{}); await refresh();
        });
        delCollector.on('end', () => delMsg.delete().catch(()=>{}));
        return;
      }
    });
    collector.on('end', () => msg.edit({ components: [buildContent(message.guild, state.page).content], flags: FLAGS }).catch(()=>{}));
  }
};
