const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { isBotOwner } = require('../../utils/permissionUtils');
const EMOJIS = require('../../utils/emojis');
const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, successContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'resetperm',
  description: 'Réinitialise toutes les permissions du serveur.',
  category: 'gestion',
  run: async (client, message) => {
    if (!isBotOwner(client, message)) return reply(message, errorContainer('Seuls les propriétaires du bot peuvent réinitialiser les permissions.'));
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('confirm_resetperm').setLabel('Confirmer').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('cancel_resetperm').setLabel('Annuler').setStyle(ButtonStyle.Secondary));
    const msg = await message.channel.send({ components: [container(txt('## ⚠️ Confirmation Requise'), sep(), txt(`${EMOJIS.WARNING||'⚠️'} Êtes-vous sûr de vouloir effacer **toutes** les permissions configurées sur ce serveur ?`)), row], flags: FLAGS });
    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id===message.author.id, time: 15000 });
    collector.on('collect', async i => {
      if (i.customId === 'confirm_resetperm') {
        await i.deferUpdate();
        const permissions = db.all().filter(d => d.ID.startsWith(`permlevel_${message.guild.id}_`));
        for (const perm of permissions) db.delete(perm.ID);
        await msg.edit({ components: [successContainer(`${permissions.length} niveaux de permissions réinitialisés.`)], flags: FLAGS }).catch(()=>{});
      } else {
        await i.deferUpdate();
        await msg.edit({ components: [container(txt('## ℹ️ Annulé'), sep(), txt('Opération annulée.'))], flags: FLAGS }).catch(()=>{});
      }
      collector.stop();
    });
    collector.on('end', async (collected) => { if (!collected.size) await msg.edit({ components: [errorContainer('Temps écoulé.')], flags: FLAGS }).catch(()=>{}); });
  }
};
