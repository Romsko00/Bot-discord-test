const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, successContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'public',
  aliases: [],
  description: 'Rend un salon accessible aux commandes publiques',
  category: 'gestion',
  run: async (client, message, args) => {
    const isOwner = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`);
    if (!isOwner) return reply(message, errorContainer("Vous n'avez pas la permission d'utiliser cette commande."));
    const sub = args[0]?.toLowerCase();
    switch (sub) {
      case 'add': {
        if (!args[1]) return reply(message, errorContainer('Utilisation: `+public add #salon`'));
        const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
        if (!channel) return reply(message, errorContainer('Salon invalide.'));
        if (!channel.isTextBased()) return reply(message, errorContainer('Le salon doit être textuel.'));
        const key = `channelpublic_${message.guild.id}_${channel.id}`;
        if (db.get(key)) return reply(message, container(txt('## ⚠️ Déjà Activé'), sep(), txt(`Les commandes publiques sont déjà activées dans ${channel}.`)));
        db.set(key, true);
        return reply(message, successContainer(`Commandes publiques activées dans ${channel}.`));
      }
      case 'remove': case 'delete': {
        if (!args[1]) return reply(message, errorContainer('Utilisation: `+public remove #salon`'));
        const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
        if (!channel) return reply(message, errorContainer('Salon invalide.'));
        const key = `channelpublic_${message.guild.id}_${channel.id}`;
        if (!db.get(key)) return reply(message, errorContainer(`Les commandes publiques ne sont pas activées dans ${channel}.`));
        db.delete(key);
        return reply(message, successContainer(`Commandes publiques désactivées dans ${channel}.`));
      }
      case 'list': {
        const publicChannels = db.all().filter(d => d.ID.startsWith(`channelpublic_${message.guild.id}_`) && d.data===true);
        const valid = publicChannels.filter(d => message.guild.channels.cache.has(d.ID.split('_')[2]));
        if (!valid.length) return reply(message, container(txt('## 📋 Salons Publics'), sep(), txt('Aucun salon public configuré sur ce serveur.')));
        let page = 0;
        const PER_PAGE = 10, totalPages = Math.ceil(valid.length / PER_PAGE);
        const buildPage = (p) => {
          const slice = valid.slice(p*PER_PAGE, (p+1)*PER_PAGE);
          const lines = slice.map((d,i) => { const chId=d.ID.split('_')[2], ch=message.guild.channels.cache.get(chId); return `**${p*PER_PAGE+i+1}.** ${ch||chId}`; });
          return container(txt(`## 📋 Salons Publics (${valid.length})`), sep(), txt(lines.join('\n') + `\n\n*Page ${p+1}/${totalPages}*`));
        };
        const buildNav = (p) => new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('pub_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(p<=0), new ButtonBuilder().setCustomId('pub_close').setLabel('Fermer').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('pub_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(p>=totalPages-1));
        const listMsg = await message.channel.send({ components: [buildPage(page), buildNav(page)], flags: FLAGS });
        const col = listMsg.createMessageComponentCollector({ time: 300000, filter: i => i.user.id===message.author.id });
        col.on('collect', async i => {
          await i.deferUpdate();
          if (i.customId==='pub_prev') page=Math.max(0,page-1);
          else if (i.customId==='pub_next') page=Math.min(totalPages-1,page+1);
          else if (i.customId==='pub_close') { col.stop(); await listMsg.edit({ components:[buildPage(page)], flags:FLAGS }).catch(()=>{}); return; }
          await listMsg.edit({ components:[buildPage(page), buildNav(page)], flags:FLAGS }).catch(()=>{});
        });
        col.on('end', () => listMsg.edit({ components:[buildPage(page)], flags:FLAGS }).catch(()=>{}));
        return;
      }
      default:
        return reply(message, container(txt('## 🛠️ Aide — Public'), sep(), txt(['**`+public add #salon`** — Activer les commandes publiques dans un salon', '**`+public remove #salon`** — Désactiver les commandes publiques', '**`+public list`** — Lister tous les salons publics'].join('\n'))));
    }
  }
};
