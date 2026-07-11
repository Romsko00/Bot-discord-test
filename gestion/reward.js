const { ActionRowBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/simpledb');
const EMOJIS = require('../../utils/emojis');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

const PREFIX_INV = (g) => `rewardinvite_${g}_`;
const PREFIX_LVL = (g) => `rewardlevel_${g}_`;
function getInvRewards(g) { return db.all().filter(e=>e.ID.startsWith(PREFIX_INV(g))).map(e=>{const p=e.ID.split('_');return{roleId:p[2],count:parseInt(p[3])};}).sort((a,b)=>a.count-b.count); }
function getLvlRewards(g) { return db.all().filter(e=>e.ID.startsWith(PREFIX_LVL(g))).map(e=>{const p=e.ID.split('_');return{roleId:p[2],level:parseInt(p[3])};}).sort((a,b)=>a.level-b.level); }
function totalCount(g) { return getInvRewards(g).length + getLvlRewards(g).length; }

function buildContent(guild) {
  const inv=getInvRewards(guild.id), lvl=getLvlRewards(guild.id);
  const invLines=inv.length?inv.map(r=>{const role=guild.roles.cache.get(r.roleId);return `${EMOJIS.ROLE||'🎭'} **${r.count}** invitations → ${role?`${role.name} (\`${r.roleId}\`)`:`~~${r.roleId}~~`}`;}):[`*Aucune*`];
  const lvlLines=lvl.length?lvl.map(r=>{const role=guild.roles.cache.get(r.roleId);return `${EMOJIS.LEVEL||'⭐'} Niveau **${r.level}** → ${role?`${role.name} (\`${r.roleId}\`)`:`~~${r.roleId}~~`}`;}):[`*Aucune*`];
  return container(txt('## 🎁 Récompenses (Invitations & Niveaux)'), sep(), txt([`**Récompenses Invitations (${inv.length}):**`, ...invLines, '', `**Récompenses Niveaux (${lvl.length}):**`, ...lvlLines, '', `*${inv.length+lvl.length} récompense(s) au total*`].join('\n')));
}

function buildMainRow(guildId) {
  const count = totalCount(guildId);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rw_add').setEmoji('➕').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rw_count').setLabel(`${count} récompense(s)`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('rw_remove').setEmoji('➖').setStyle(ButtonStyle.Secondary).setDisabled(!count),
    new ButtonBuilder().setCustomId('rw_clear').setEmoji('🗑️').setStyle(ButtonStyle.Danger).setDisabled(!count)
  );
}

module.exports = {
  name: 'reward',
  aliases: ['rewardrole'],
  description: 'Système de récompenses (invitations & niveaux)',
  category: 'gestion',
  run: async (client, message) => {
    let perm = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!perm) message.member.roles.cache.forEach(r => { if (db.get(`ownerp_${message.guild.id}_${r.id}`)) perm=true; });
    if (!perm) return reply(message, errorContainer('Permission refusée.'));
    const guildId = message.guild.id;
    const msg = await message.channel.send({ components: [buildContent(message.guild), buildMainRow(guildId)], flags: FLAGS });
    const refresh = () => msg.edit({ components: [buildContent(message.guild), buildMainRow(guildId)], flags: FLAGS }).catch(()=>{});
    let pendingType=null, pendingValue=null;

    const col = msg.createMessageComponentCollector({ time: 300000, filter: i => i.user.id===message.author.id });
    col.on('collect', async (i) => {
      if (i.customId === 'rw_add') {
        await i.deferUpdate();
        const menu = new StringSelectMenuBuilder().setCustomId('rw_type_select').setPlaceholder('Type de récompense').addOptions([new StringSelectMenuOptionBuilder().setLabel('Récompense Invitations').setValue('invite').setEmoji('📨').setDescription("Attribuer un rôle selon le nb d'invitations"), new StringSelectMenuOptionBuilder().setLabel('Récompense Niveau').setValue('level').setEmoji('⭐').setDescription('Attribuer un rôle selon le niveau XP')]);
        await msg.edit({ components: [container(txt('## ➕ Ajouter une Récompense'), sep(), txt('Quel type de récompense voulez-vous ajouter ?')), new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('rw_back').setEmoji('↩️').setLabel('Retour').setStyle(ButtonStyle.Secondary))], flags: FLAGS }).catch(()=>{});
        return;
      }
      if (i.customId === 'rw_remove') {
        await i.deferUpdate();
        const all=[...getInvRewards(guildId).map(r=>new StringSelectMenuOptionBuilder().setLabel(`Invitations: ${r.count} → ${message.guild.roles.cache.get(r.roleId)?.name||r.roleId}`).setValue(`inv_${r.roleId}_${r.count}`)),...getLvlRewards(guildId).map(r=>new StringSelectMenuOptionBuilder().setLabel(`Niveau: ${r.level} → ${message.guild.roles.cache.get(r.roleId)?.name||r.roleId}`).setValue(`lvl_${r.roleId}_${r.level}`))].slice(0,25);
        await msg.edit({ components: [container(txt('## ➖ Retirer une Récompense'), sep(), txt('Quelle(s) récompense(s) retirer ?')), new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('rw_reward_remove').setPlaceholder('Sélectionner').addOptions(all).setMinValues(1).setMaxValues(all.length)), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('rw_back').setEmoji('↩️').setLabel('Retour').setStyle(ButtonStyle.Secondary))], flags: FLAGS }).catch(()=>{});
        return;
      }
      if (i.customId === 'rw_clear') { await i.deferUpdate(); getInvRewards(guildId).forEach(r=>db.delete(`${PREFIX_INV(guildId)}${r.roleId}_${r.count}`)); getLvlRewards(guildId).forEach(r=>db.delete(`${PREFIX_LVL(guildId)}${r.roleId}_${r.level}`)); await refresh(); return; }
      if (i.customId === 'rw_back') { await i.deferUpdate(); pendingType=pendingValue=null; await refresh(); return; }
      if (i.customId === 'rw_type_select') {
        pendingType=i.values[0];
        const modal=new ModalBuilder().setCustomId('rw_modal_value').setTitle(pendingType==='invite'?"Nombre d'invitations":'Niveau requis').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('num_val').setLabel(pendingType==='invite'?"Nombre d'invitations":'Niveau').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 10').setRequired(true)));
        await i.showModal(modal);
        let submit; try { submit=await i.awaitModalSubmit({filter:x=>x.customId==='rw_modal_value'&&x.user.id===message.author.id,time:60000}); } catch { return; }
        const num=parseInt(submit.fields.getTextInputValue('num_val'));
        if (isNaN(num)||num<=0) { await submit.reply({content:`${EMOJIS.ERROR||'❌'} Valeur invalide.`,ephemeral:true}); return; }
        pendingValue=num; await submit.deferUpdate();
        await msg.edit({ components: [container(txt('## ➕ Ajouter une Récompense'), sep(), txt(`Quel rôle attribuer pour **${num}** ${pendingType==='invite'?'invitation(s)':'niveau(x)'} ?`)), new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('rw_role_select').setPlaceholder('Sélectionner un rôle').setMinValues(1).setMaxValues(1)), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('rw_back').setEmoji('↩️').setLabel('Retour').setStyle(ButtonStyle.Secondary))], flags: FLAGS }).catch(()=>{});
        return;
      }
      if (i.customId === 'rw_role_select') {
        await i.deferUpdate();
        const roleId=i.values[0], type=pendingType, val=pendingValue; pendingType=pendingValue=null;
        if (type==='invite') db.set(`${PREFIX_INV(guildId)}${roleId}_${val}`,true); else db.set(`${PREFIX_LVL(guildId)}${roleId}_${val}`,true);
        await refresh(); return;
      }
      if (i.customId === 'rw_reward_remove') {
        await i.deferUpdate();
        for (const v of i.values) { const [type,roleId,val]=v.split('_'); if (type==='inv') db.delete(`${PREFIX_INV(guildId)}${roleId}_${val}`); else db.delete(`${PREFIX_LVL(guildId)}${roleId}_${val}`); }
        await refresh(); return;
      }
    });
    col.on('end', () => msg.edit({ components: [buildContent(message.guild)], flags: FLAGS }).catch(()=>{}));
  }
};
