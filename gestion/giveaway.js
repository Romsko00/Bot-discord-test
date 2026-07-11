const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../../utils/simpledb');
const ms = require('ms');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

function selectWinners(users, count) {
  const arr = Array.from(users.values()), winners = [], used = new Set();
  for (let i=0;i<Math.min(count,arr.length);i++) { let idx; do { idx=Math.floor(Math.random()*arr.length); } while (used.has(idx)); used.add(idx); winners.push(arr[idx]); }
  return winners.map(u=>u.toString());
}
function findReaction(msg, emojiInput) {
  return msg.reactions.cache.find(r=>r.emoji?.toString()===emojiInput) || msg.reactions.cache.find(r=>r.emoji?.name===emojiInput) || msg.reactions.cache.find(r=>r.emoji?.id===emojiInput) || null;
}
function isValidDuration(d) { const v=ms(d); return typeof v==='number'&&v>0; }
function getOptionName(v) { return {duration:'la durée',channel:'le salon',imposed_winner:'le gagnant imposé',voice_required:'la présence vocale',required_role:'le rôle obligatoire',winners_count:'le nombre de gagnants',reaction:'la réaction',prize:'le gain'}[v]||v; }

function createConfigContent(message) {
  const guildId = message.guild.id;
  const lines = [
    `**Durée:** ${db.get(`dure${guildId}`)?ms(db.get(`dure${guildId}`)):'Non défini'}`,
    `**Salon:** ${db.get(`channel${guildId}`)?`<#${db.get(`channel${guildId}`)}>`:message.channel.toString()}`,
    `**Gagnant imposé:** ${db.get(`imposer${guildId}`)?`<@${db.get(`imposer${guildId}`)}>` :'Non défini'}`,
    `**Présence vocale:** ${db.get(`presencevocal${guildId}`)?'Oui':'Non'}`,
    `**Rôle obligatoire:** ${db.get(`roleobliga${guildId}`) ? (() => { const _rid = db.get(`roleobliga${guildId}`); const _r = message.guild.roles.cache.get(_rid); return _r ? `${_r.name} (\`${_rid}\`)` : `~~${_rid}~~`; })() : 'Non défini'}`,
    `**Gagnants:** ${db.get(`winnergv${guildId}`)||1}`,
    `**Réaction:** ${db.get(`reactgv${guildId}`)||'🎉'}`,
    `**Gain:** ${db.get(`gain${guildId}`)||'Non défini'}`
  ];
  return container(txt('## 🎉 Configuration Giveaway'), sep(), txt(lines.join('\n')));
}

async function endGiveaway(client, giveawayData) {
  const { guildId, channelId, messageId, prize, winnersCount, reactionEmoji, requiredRole, voiceRequired, imposedWinner } = giveawayData;
  const guild = client.guilds.cache.get(guildId); if (!guild) return;
  const channel = guild.channels.cache.get(channelId); if (!channel) return;
  try {
    const fetchedMsg = await channel.messages.fetch(messageId).catch(()=>null);
    if (!fetchedMsg) return channel.send('❌ Message de giveaway non trouvé.');
    const reaction = findReaction(fetchedMsg, reactionEmoji);
    if (!reaction) return channel.send('❌ Aucune réaction détectée.');
    const users = await reaction.users.fetch();
    let filtered = users.filter(u=>!u.bot);
    if (requiredRole) filtered = filtered.filter(u=>{ const m=guild.members.cache.get(u.id); return m?.roles.cache.has(requiredRole); });
    if (voiceRequired) filtered = filtered.filter(u=>{ const m=guild.members.cache.get(u.id); return m?.voice?.channel; });
    if (!filtered.size) return channel.send('❌ Aucun participant valide.');
    let winners;
    if (imposedWinner && filtered.has(imposedWinner)) {
      const imposed = filtered.get(imposedWinner);
      winners = [imposed.toString()];
      if (winnersCount > 1) { filtered.delete(imposedWinner); winners = [imposed.toString(), ...selectWinners(filtered, winnersCount-1)]; }
    } else { winners = selectWinners(filtered, winnersCount); }
    const { container: c2, txt: t2, sep: s2, FLAGS: F2 } = require('../../utils/v2');
    await channel.send({ components: [c2(t2('## 🎉 Giveaway Terminé'), s2(), t2(`Félicitations à ${winners.join(', ')} qui gagne(nt) **${prize}** !`))], flags: F2 });
  } catch (e) { console.error('[giveaway] endGiveaway:', e); try { await channel.send('❌ Erreur lors de la fin du giveaway.'); } catch {} }
}

module.exports = {
  name: 'giveaway',
  aliases: ['gvw'],
  description: 'Crée et gère les giveaways sur le serveur',
  category: 'gestion',
  level: 3,
  run: async (client, message, args) => {

    if (args[0] === 'reroll') {
      const messageId = args[1] || db.get(`last${message.guild.id}`);
      if (!messageId) return reply(message, errorContainer('Aucun giveaway trouvé. Utilisez: `+giveaway reroll <message id>`'));
      try {
        const giveawayMessage = await message.channel.messages.fetch(messageId);
        const reactionEmoji = db.get(`reactgv${message.guild.id}`) || '🎉';
        const reaction = findReaction(giveawayMessage, reactionEmoji);
        if (!reaction || reaction.count <= 1) return reply(message, errorContainer('Aucun participant trouvé.'));
        const winnersCount = db.get(`winnergv${message.guild.id}`) || 1;
        const users = await reaction.users.fetch();
        let filtered = users.filter(u=>!u.bot);
        const imposedId = db.get(`imposer${message.guild.id}`);
        if (imposedId && filtered.has(imposedId)) { const f = new (require('discord.js').Collection)(); f.set(imposedId, filtered.get(imposedId)); filtered = f; }
        if (db.get(`presencevocal${message.guild.id}`)) filtered = filtered.filter(u=>{ const m=message.guild.members.cache.get(u.id); return m?.voice?.channel; });
        const reqRole = db.get(`roleobliga${message.guild.id}`);
        if (reqRole) filtered = filtered.filter(u=>{ const m=message.guild.members.cache.get(u.id); return m?.roles.cache.has(reqRole); });
        if (!filtered.size) return reply(message, errorContainer('Aucun participant valide après filtres.'));
        const winners = selectWinners(filtered, winnersCount);
        return reply(message, container(txt('## 🎉 Reroll Giveaway'), sep(), txt(`Félicitations à ${winners.join(', ')} qui gagne(nt) **${db.get(`gain${message.guild.id}`)||'le prix'}** !`)));
      } catch (e) { console.error('[giveaway] reroll:', e); return reply(message, errorContainer('Une erreur est survenue lors du reroll.')); }
    }

    if (args[0] === 'end') {
      const messageId = args[1] || db.get(`last${message.guild.id}`);
      if (!messageId) return reply(message, errorContainer('Aucun giveaway trouvé.'));
      const entry = db.all().find(e => e.data?.messageId === messageId);
      if (!entry?.data) return reply(message, errorContainer('Données du giveaway introuvables.'));
      await endGiveaway(client, entry.data);
      return reply(message, container(txt('## ✅ Giveaway Terminé'), sep(), txt('Le giveaway a été terminé manuellement.')));
    }

    // Config menu
    const guildId = message.guild.id;
    const selectMenu = new StringSelectMenuBuilder().setCustomId('gv_config_menu').setPlaceholder('Choisissez une option').addOptions([
      new StringSelectMenuOptionBuilder().setLabel('Durée').setValue('duration').setEmoji('🕙'),
      new StringSelectMenuOptionBuilder().setLabel('Salon').setValue('channel').setEmoji('🏷️'),
      new StringSelectMenuOptionBuilder().setLabel('Gagnant imposé').setValue('imposed_winner').setEmoji('🕵️'),
      new StringSelectMenuOptionBuilder().setLabel('Présence vocale').setValue('voice_required').setEmoji('🔊'),
      new StringSelectMenuOptionBuilder().setLabel('Rôle obligatoire').setValue('required_role').setEmoji('🌞'),
      new StringSelectMenuOptionBuilder().setLabel('Nombre de gagnants').setValue('winners_count').setEmoji('👤'),
      new StringSelectMenuOptionBuilder().setLabel('Réaction').setValue('reaction').setEmoji('⭐'),
      new StringSelectMenuOptionBuilder().setLabel('Gain').setValue('prize').setEmoji('🎁')
    ]);
    const menuRow = new ActionRowBuilder().addComponents(selectMenu);
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('gv_confirm').setLabel('Valider').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('gv_cancel').setLabel('Annuler').setEmoji('❌').setStyle(ButtonStyle.Danger)
    );
    const configMsg = await message.channel.send({ components: [createConfigContent(message), menuRow, btnRow], flags: FLAGS });
    const filter1 = m => m.author.id===message.author.id && m.channel.id===message.channel.id;
    const collector = configMsg.createMessageComponentCollector({ time: 300000 });
    collector.on('collect', async interaction => {
      if (interaction.user.id !== message.author.id) return interaction.reply({ content: 'Vous ne pouvez pas interagir avec ce menu.', ephemeral: true });
      if (interaction.isStringSelectMenu()) {
        const option = interaction.values[0];
        await interaction.reply({ content: `Envoyez la nouvelle valeur pour **${getOptionName(option)}** :\n- durée : 1d, 2h, 30m\n- présence vocale : on/off\n- gagnant imposé/rôle obligatoire : mention/ID ou \`reset\`\n- gagnants : nombre ≥ 1\n- réaction : emoji\n- gain : texte`, ephemeral: true });
        const col = message.channel.createMessageCollector({ filter: filter1, time: 60000, max: 1 });
        col.on('collect', async resp => {
          try {
            switch (option) {
              case 'duration': if (!isValidDuration(resp.content)) { await message.channel.send('Durée invalide.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000)); return; } db.set(`dure${guildId}`, ms(resp.content)); break;
              case 'channel': { const ch=resp.mentions.channels.first()||message.guild.channels.cache.get(resp.content); if (!ch) { await message.channel.send('Salon introuvable.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000)); return; } db.set(`channel${guildId}`, ch.id); break; }
              case 'imposed_winner': { const u=resp.mentions.users.first()||client.users.cache.get(resp.content); if (!u) { if (resp.content.toLowerCase()==='reset') { db.delete(`imposer${guildId}`); break; } await message.channel.send('Utilisateur introuvable.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000)); return; } db.set(`imposer${guildId}`, u.id); break; }
              case 'voice_required': { const v=resp.content.toLowerCase(); const on=['on','oui','true','enable','enabled'].includes(v); const off=['off','non','false','disable','disabled'].includes(v); if (!on&&!off) { await message.channel.send('Utilisez on/off.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000)); return; } db.set(`presencevocal${guildId}`, on); break; }
              case 'required_role': { const r=resp.mentions.roles.first()||message.guild.roles.cache.get(resp.content); if (!r) { if (resp.content.toLowerCase()==='reset') { db.delete(`roleobliga${guildId}`); break; } await message.channel.send('Rôle introuvable.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000)); return; } db.set(`roleobliga${guildId}`, r.id); break; }
              case 'winners_count': { const n=parseInt(resp.content,10); if (!Number.isInteger(n)||n<1) { await message.channel.send('Entier ≥ 1 requis.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000)); return; } db.set(`winnergv${guildId}`, n); break; }
              case 'reaction': { const e=resp.content.trim(); if (!e) { await message.channel.send('Emoji invalide.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000)); return; } db.set(`reactgv${guildId}`, e); break; }
              case 'prize': { const p=resp.content.trim(); if (!p) { await message.channel.send('Le gain ne peut pas être vide.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),3000)); return; } db.set(`gain${guildId}`, p); break; }
            }
            await configMsg.edit({ components: [createConfigContent(message), menuRow, btnRow], flags: FLAGS }).catch(()=>{});
            await resp.delete().catch(()=>{});
          } catch (e) { console.error('[giveaway] menuSelection:', e); }
        });
      } else if (interaction.isButton()) {
        if (interaction.customId === 'gv_confirm') {
          if (!db.get(`dure${guildId}`) || !db.get(`gain${guildId}`)) { await interaction.reply({ content: 'Durée et gain sont requis.', ephemeral: true }); return; }
          await interaction.deferUpdate();
          const durationMs = db.get(`dure${guildId}`), prize = db.get(`gain${guildId}`), winnersCount = db.get(`winnergv${guildId}`)||1, reactionEmoji = db.get(`reactgv${guildId}`)||'🎉', channelId = db.get(`channel${guildId}`)||message.channel.id;
          const channel = message.guild.channels.cache.get(channelId)||message.channel;
          const endsAt = Date.now() + durationMs;
          const gwMsg = await channel.send({ components: [container(txt('## 🎉 Giveaway'), sep(), txt([`Réagissez avec ${reactionEmoji} pour participer !`, `**Gain :** ${prize}`, `**Gagnants :** ${winnersCount}`, `**Se termine :** <t:${Math.floor(endsAt/1000)}:R>`].join('\n')))], flags: FLAGS });
          let usedEmoji = reactionEmoji;
          try { await gwMsg.react(reactionEmoji); } catch { usedEmoji='🎉'; await gwMsg.react('🎉'); }
          db.set(`last${guildId}`, gwMsg.id);
          const giveawayData = { guildId, channelId: channel.id, messageId: gwMsg.id, endsAt, prize, winnersCount, reactionEmoji: usedEmoji, requiredRole: db.get(`roleobliga${guildId}`)||null, voiceRequired: db.get(`presencevocal${guildId}`)||false, imposedWinner: db.get(`imposer${guildId}`)||null };
          db.set(`giveaway_${guildId}_${Date.now()}`, giveawayData);
          setTimeout(async () => { try { await endGiveaway(client, giveawayData); } catch (e) { console.error('[giveaway] fin:', e); } }, Math.max(1000, Math.min(durationMs, 2147483647)));
          await configMsg.edit({ components: [container(txt('## ✅ Giveaway Lancé !'), sep(), txt(`Le giveaway a été créé dans ${channel}.`))], flags: FLAGS }).catch(()=>{});
          collector.stop('done');
        } else if (interaction.customId === 'gv_cancel') {
          await interaction.deferUpdate();
          await configMsg.edit({ components: [container(txt('## ❌ Annulé'), sep(), txt('Configuration du giveaway annulée.'))], flags: FLAGS }).catch(()=>{});
          collector.stop('cancel');
        }
      }
    });
    collector.on('end', (_,r) => { if (r!=='done'&&r!=='cancel') configMsg.edit({ components: [createConfigContent(message)], flags: FLAGS }).catch(()=>{}); });
  }
};
