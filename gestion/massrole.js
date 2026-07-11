const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, successContainer, FLAGS } = require('../../utils/v2');

async function processMassRole(action, role, message, statusMessage) {
  const members = message.guild.members.cache.filter(m => action==='add' ? !m.roles.cache.has(role.id) : m.roles.cache.has(role.id));
  if (!members.size) { await statusMessage.edit({ components: [errorContainer(`Aucun membre à ${action==='add'?'ajouter':'retirer'} ce rôle.`)], flags: FLAGS }).catch(()=>{}); return; }
  let successCount = 0, failCount = 0, processed = 0;
  const total = members.size;
  await statusMessage.edit({ components: [container(txt(`## ⏳ ${action==='add'?'Ajout':'Retrait'} de rôle en masse`), sep(), txt(`**Rôle:** ${role}\n**Total:** ${total}\n**Progression:** 0/${total} (0%)\n**Réussites:** 0 | **Échecs:** 0`))], flags: FLAGS }).catch(()=>{});
  for (const member of members.values()) {
    processed++;
    try { if (action==='add') await member.roles.add(role, `Massrole par ${message.author.tag}`); else await member.roles.remove(role, `Massrole par ${message.author.tag}`); successCount++; }
    catch (e) { console.error(`Erreur avec ${member.user.tag}:`, e); failCount++; }
    if (processed % 10 === 0 || processed === total) {
      const pct = Math.round(processed/total*100);
      await statusMessage.edit({ components: [container(txt(`## ⏳ ${action==='add'?'Ajout':'Retrait'} de rôle en masse`), sep(), txt(`**Rôle:** ${role}\n**Progression:** ${processed}/${total} (${pct}%)\n**Réussites:** ${successCount} | **Échecs:** ${failCount}`))], flags: FLAGS }).catch(()=>{});
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  await statusMessage.edit({ components: [container(txt(`## ✅ Opération Terminée`), sep(), txt(`**Action:** ${action==='add'?'Ajout':'Retrait'}\n**Rôle:** ${role}\n**Total traité:** ${total}\n**Réussites:** ${successCount}\n**Échecs:** ${failCount}**Exécuté par:** ${message.author}`))], flags: FLAGS }).catch(()=>{});
}

module.exports = {
  name: 'massrole',
  aliases: [],
  description: 'Attribution de rôles en masse',
  category: 'gestion',
  run: async (client, message, args) => {
    let hasPerm = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!hasPerm) for (const role of message.member.roles.cache.values()) { if (db.get(`ownerp_${message.guild.id}_${role.id}`)) { hasPerm=true; break; } }
    if (!hasPerm) return reply(message, errorContainer("Vous n'avez pas la permission d'utiliser cette commande."));

    if (!args[0] || !['add','remove'].includes(args[0].toLowerCase())) {
      return reply(message, container(txt('## ℹ️ Massrole'), sep(), txt(`**Utilisation:** \`+massrole add|remove @rôle|role_id\`\nExemple: \`+massrole add @Membre\``)));
    }

    const action = args[0].toLowerCase();
    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
    if (!role) return reply(message, errorContainer(`Aucun rôle trouvé pour \`${args[1]||'rien'}\`.`));
    if (role.comparePositionTo(message.guild.members.me.roles.highest) >= 0) return reply(message, errorContainer('Je ne peux pas gérer ce rôle (au-dessus de mon rôle).'));

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('massrole_confirm').setLabel('Confirmer').setStyle(ButtonStyle.Danger).setEmoji('✅'),
      new ButtonBuilder().setCustomId('massrole_cancel').setLabel('Annuler').setStyle(ButtonStyle.Secondary).setEmoji('❌')
    );
    const confirmMsg = await message.channel.send({ components: [container(txt('## ⚠️ Confirmation Requise'), sep(), txt(`Êtes-vous sûr de vouloir **${action==='add'?'ajouter':'retirer'}** le rôle ${role} à **${message.guild.memberCount} membres** ?\n*Cette action peut prendre plusieurs minutes.*`)), confirmRow], flags: FLAGS });
    try {
      const confirmation = await confirmMsg.awaitMessageComponent({ filter: i => i.user.id===message.author.id, time: 30000 });
      if (confirmation.customId === 'massrole_confirm') {
        await confirmation.deferUpdate();
        await processMassRole(action, role, message, confirmMsg);
      } else {
        await confirmation.deferUpdate();
        await confirmMsg.edit({ components: [container(txt('## ❌ Annulé'), sep(), txt('Action annulée.'))], flags: FLAGS }).catch(()=>{});
      }
    } catch { await confirmMsg.edit({ components: [errorContainer('Temps de confirmation écoulé.')], flags: FLAGS }).catch(()=>{}); }
  }
};
