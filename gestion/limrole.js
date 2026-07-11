const { ActionRowBuilder, ButtonBuilder, ButtonStyle, RoleSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../../utils/simpledb');
const EMOJIS = require('../../utils/emojis');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

const PREFIX = (g) => `limrole_${g}_`;
function getLimits(guildId) { return db.all().filter(e=>e.ID.startsWith(PREFIX(guildId))).map(e=>({roleId:e.ID.replace(PREFIX(guildId),''),limit:e.data})).filter(e=>e.limit!==null&&e.limit!==undefined); }

function buildContent(guild) {
  const limits = getLimits(guild.id);
  const lines = limits.length ? limits.map(l => { const role=guild.roles.cache.get(l.roleId), count=role?.members?.size??'?'; return `${EMOJIS.ROLE||'🎭'} ${role?`${role.name} (\`${l.roleId}\`)`:`~~${l.roleId}~~`} — \`${count}/${l.limit}\``; }) : ['*Aucune limite configurée*'];
  return container(txt('## 🎭 Limites de Rôles'), sep(), txt(lines.join('\n') + `\n\n*${limits.length} limite(s) configurée(s)*`));
}

function buildMainRow(guildId) {
  const count = getLimits(guildId).length;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('lr_add').setEmoji('➕').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('lr_count').setLabel(`${count} limite(s)`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('lr_remove').setEmoji('➖').setStyle(ButtonStyle.Secondary).setDisabled(!count),
    new ButtonBuilder().setCustomId('lr_clear').setEmoji('🗑️').setStyle(ButtonStyle.Danger).setDisabled(!count)
  );
}

module.exports = {
  name: 'limrole',
  aliases: [],
  description: 'Limite le nombre de membres pouvant avoir un rôle.',
  category: 'gestion',
  run: async (client, message) => {
    if (!hasPermissionLevel(client, message, 6)) return reply(message, errorContainer('Permission refusée.'));
    const guildId = message.guild.id;
    const msg = await message.channel.send({ components: [buildContent(message.guild), buildMainRow(guildId)], flags: FLAGS });
    const refresh = () => msg.edit({ components: [buildContent(message.guild), buildMainRow(guildId)], flags: FLAGS }).catch(()=>{});

    const col = msg.createMessageComponentCollector({ time: 300000, filter: i => i.user.id === message.author.id });
    col.on('collect', async (i) => {
      if (i.customId === 'lr_add') {
        await i.deferUpdate();
        await msg.edit({ components: [container(txt('## ➕ Ajouter une Limite'), sep(), txt('Sélectionnez le rôle à limiter :')), new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('lr_role_select').setPlaceholder('Sélectionner un rôle').setMinValues(1).setMaxValues(1)), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('lr_back').setEmoji('↩️').setLabel('Retour').setStyle(ButtonStyle.Secondary))], flags: FLAGS }).catch(()=>{});
        return;
      }
      if (i.customId === 'lr_remove') {
        await i.deferUpdate();
        const limits = getLimits(guildId);
        const opts = limits.slice(0,25).map(l => { const r=message.guild.roles.cache.get(l.roleId); return new StringSelectMenuOptionBuilder().setLabel(`${r?.name||l.roleId} (max: ${l.limit})`).setValue(l.roleId); });
        await msg.edit({ components: [container(txt('## ➖ Retirer une Limite'), sep(), txt('Sélectionnez la limite à retirer :')), new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('lr_limit_remove').setPlaceholder('Sélectionner').addOptions(opts).setMinValues(1).setMaxValues(opts.length)), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('lr_back').setEmoji('↩️').setLabel('Retour').setStyle(ButtonStyle.Secondary))], flags: FLAGS }).catch(()=>{});
        return;
      }
      if (i.customId === 'lr_clear') { await i.deferUpdate(); getLimits(guildId).forEach(l=>db.delete(`${PREFIX(guildId)}${l.roleId}`)); await refresh(); return; }
      if (i.customId === 'lr_back') { await i.deferUpdate(); await refresh(); return; }
      if (i.customId === 'lr_role_select') {
        const pendingRoleId = i.values[0];
        const role = message.guild.roles.cache.get(pendingRoleId);
        const modal = new ModalBuilder().setCustomId('lr_modal_limit').setTitle(`Limite pour ${role?.name||pendingRoleId}`).addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('limit_val').setLabel('Nombre maximum de membres').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 10').setRequired(true)));
        await i.showModal(modal);
        let submit;
        try { submit = await i.awaitModalSubmit({ filter: x => x.customId==='lr_modal_limit'&&x.user.id===message.author.id, time: 60000 }); } catch { return; }
        const limit = parseInt(submit.fields.getTextInputValue('limit_val'));
        if (isNaN(limit)||limit<0) { await submit.reply({ content: `${EMOJIS.ERROR||'❌'} Valeur invalide.`, ephemeral: true }); return; }
        db.set(`${PREFIX(guildId)}${pendingRoleId}`, limit);
        try { const me=message.guild.members.me, r=message.guild.roles.cache.get(pendingRoleId); if (r&&me.permissions.has('ManageRoles')&&!r.managed&&r.position<me.roles.highest.position) { const base=r.name.replace(/\s*\[\d+\/\d+\]$/,'').trim(), newName=`${base} [${r.members.size}/${limit}]`; if (newName.length<=100) await r.edit({name:newName}).catch(()=>{}); } } catch {}
        await submit.deferUpdate();
        await refresh(); return;
      }
      if (i.customId === 'lr_limit_remove') {
        await i.deferUpdate();
        for (const roleId of i.values) { try { const r=message.guild.roles.cache.get(roleId), me=message.guild.members.me; if (r&&me.permissions.has('ManageRoles')&&!r.managed&&r.position<me.roles.highest.position) { const base=r.name.replace(/\s*\[\d+\/\d+\]$/,'').trim(); if (base!==r.name) await r.edit({name:base}).catch(()=>{}); } } catch {} db.delete(`${PREFIX(guildId)}${roleId}`); }
        await refresh(); return;
      }
    });
    col.on('end', () => msg.edit({ components: [buildContent(message.guild)], flags: FLAGS }).catch(()=>{}));
  }
};
