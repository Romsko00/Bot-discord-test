const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, errorContainer, FLAGS } = require('../../utils/v2');
const { btn, row } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'derank',
  aliases: [],
  description: 'Retire tous les rôles d\'un utilisateur',
  usage: '<@membre>',

  run: async (client, message, args) => {
    try {
      const isSuperOwner = (client.config.superadmin?.includes(message.author.id)) || (client.config.owners?.includes(message.author.id)) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
      let hasPermission = isSuperOwner;
      if (!hasPermission) message.member.roles.cache.forEach(r => { if (db.get(`ownerp_${message.guild.id}_${r.id}`)) hasPermission = true; });
      if (!hasPermission) return message.reply({ components: [errorContainer('**Permission refusée.**')], flags: FLAGS });
      if (!args[0]) return message.reply({ components: [errorContainer('**Usage :** `!derank @membre`')], flags: FLAGS });

      const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
      if (!target) return message.reply({ components: [errorContainer('**Membre introuvable.**')], flags: FLAGS });
      if (target.id === message.author.id) return message.reply({ components: [errorContainer('Vous ne pouvez pas vous derank vous-même.')], flags: FLAGS });
      if (target.id === client.user.id) return message.reply({ components: [errorContainer('Je ne peux pas me derank moi-même.')], flags: FLAGS });
      if ((client.config.superadmin?.includes(target.id)) || (client.config.owners?.includes(target.id))) return message.reply({ components: [errorContainer('Impossible de derank un owner du bot.')], flags: FLAGS });
      if (!isSuperOwner && target.roles.highest.position >= message.member.roles.highest.position) return message.reply({ components: [errorContainer('**Hiérarchie insuffisante.**')], flags: FLAGS });
      if (target.roles.highest.position >= message.guild.members.me.roles.highest.position) return message.reply({ components: [errorContainer('Ma hiérarchie est trop basse.')], flags: FLAGS });
      if (target.roles.cache.size === 1) return message.reply({ components: [errorContainer('Ce membre n\'a déjà aucun rôle à retirer.')], flags: FLAGS });

      const roleCount = target.roles.cache.size - 1;
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('derank_confirm').setLabel('✅ Confirmer').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('derank_cancel').setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary)
      );

      const sent = await message.channel.send({
        components: [container(
          txt('## ⚠️ Confirmation Derank'),
          sep(),
          txt(`Retirer **${roleCount} rôle(s)** de ${target.user.tag} ?`)
        ), confirmRow],
        flags: FLAGS
      });

      const col = sent.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, max: 1, time: 30000 });
      col.on('collect', async i => {
        if (i.customId === 'derank_confirm') {
          await target.roles.set([], `Derank par ${message.author.tag}`);
          await i.update({ components: [container(txt('## ✅ Derank Effectué'), sep(), txt(`**${target.user.tag}** a été derank avec succès.`))], flags: FLAGS });
          const logCh = message.guild.channels.cache.get(db.get(`logmod_${message.guild.id}`));
          if (logCh) logCh.send({ content: `**Derank** : ${message.author.tag} a derank ${target.user.tag}` }).catch(() => {});
        } else {
          await i.update({ components: [container(txt('## ❌ Derank Annulé'), sep(), txt('Opération annulée.'))], flags: FLAGS });
        }
      });
      col.on('end', collected => { if (!collected.size) sent.edit({ components: [container(txt('⏱️ Temps écoulé, derank annulé.'))], flags: FLAGS }).catch(() => {}); });
    } catch (err) {
      console.error('[derank]', err);
      message.reply({ components: [errorContainer('Une erreur est survenue.')], flags: FLAGS }).catch(() => {});
    }
  }
};
