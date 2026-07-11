const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'custom',
  description: 'Commandes personnalisées du serveur',
  category: 'bot',
  level: 7,
  run: async (client, message, args) => {
    const isOwner = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`);
    if (!isOwner) return reply(message, errorContainer('**Permission insuffisante.**'));

    if (args[0] === 'list') {
      const commands = db.all().filter(d => d.ID.startsWith('customcmd'));
      if (!commands.length) return reply(message, container(txt('## 📋 Commandes Personnalisées'), sep(), txt('Aucune commande personnalisée.')));
      const PER_PAGE = 15;
      const totalPages = Math.max(1, Math.ceil(commands.length / PER_PAGE));
      let page = 1;

      const buildPage = (p) => {
        const slice = commands.slice((p - 1) * PER_PAGE, p * PER_PAGE);
        const lines = slice.map((cmd, i) => {
          const cmdName = cmd.ID.split('_')[1];
          const isEmbed = cmd.ID.startsWith('customcmdembed');
          return `${(p - 1) * PER_PAGE + i + 1}. **${cmdName}** (${isEmbed ? 'Embed' : 'Message'})`;
        }).join('\n');
        return container(txt('## 📋 Commandes Personnalisées'), sep(), txt(lines), sep(), txt(`Page ${p}/${totalPages}`),
          ...(totalPages > 1 ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cst_prev').setLabel('‹').setStyle(ButtonStyle.Primary).setDisabled(p === 1), new ButtonBuilder().setCustomId('cst_page').setLabel(`${p}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true), new ButtonBuilder().setCustomId('cst_next').setLabel('›').setStyle(ButtonStyle.Primary).setDisabled(p === totalPages))] : [])
        );
      };

      const sent = await reply(message, buildPage(1));
      if (totalPages <= 1) return;
      const collector = sent.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300000 });
      collector.on('collect', async i => {
        if (i.customId === 'cst_prev') page = Math.max(1, page - 1);
        else if (i.customId === 'cst_next') page = Math.min(totalPages, page + 1);
        await i.update({ components: [buildPage(page)], flags: FLAGS });
      });
      return;
    }

    if (args[0] === 'delete') {
      const cmd = args[1];
      if (!cmd) return reply(message, errorContainer('**Usage :** `!custom delete <nom>`'));
      if (!db.get(`customcmd_${cmd}`) && !db.get(`customcmdembed_${cmd}`)) return reply(message, errorContainer(`Commande \`${cmd}\` introuvable.`));
      db.delete(`customcmd_${cmd}`);
      db.delete(`customcmdembed_${cmd}`);
      return reply(message, container(txt('## ✅ Commande Supprimée'), sep(), txt(`Commande **${cmd}** supprimée.`)));
    }

    if (!args[0]) return reply(message, errorContainer('**Usage :** `!custom <list|delete|<nom>>` pour créer une commande.'));

    const cmd = args[0];
    if (db.get(`customcmd_${cmd}`) || db.get(`customcmdembed_${cmd}`)) return reply(message, errorContainer(`Une commande **${cmd}** existe déjà.`));

    db.set(`customstyle_${message.guild.id}`, 'message');
    db.set(`customcmdname_${message.guild.id}`, cmd);

    const buildMenu = () => {
      const isEmbed = db.get(`customstyle_${message.guild.id}`) === 'embed';
      const hasMsg = !!db.get(`custommsg_${message.guild.id}`);
      const hasEmb = !!db.get(`customembed_${message.guild.id}`);
      return container(
        txt('## ⚙️ Configuration Commande Personnalisée'),
        sep(),
        txt([`**Nom :** \`${db.get(`customcmdname_${message.guild.id}`) || cmd}\``, `**Style :** ${isEmbed ? 'Embed' : 'Message'}`, `**Statut :** ${(isEmbed ? hasEmb : hasMsg) ? '✅ Configuré' : '❌ Non configuré'}`].join('\n')),
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId('custom_menu').setPlaceholder('Sélectionner une option').addOptions(
            isEmbed ? [
              new StringSelectMenuOptionBuilder().setLabel('Style Message').setValue('style_message').setEmoji('📑'),
              new StringSelectMenuOptionBuilder().setLabel('Modifier le nom').setValue('modify_name').setEmoji('🏷️'),
              new StringSelectMenuOptionBuilder().setLabel('Modifier le message').setValue('modify_message').setEmoji('💬')
            ] : [
              new StringSelectMenuOptionBuilder().setLabel('Style Embed').setValue('style_embed').setEmoji('📑'),
              new StringSelectMenuOptionBuilder().setLabel('Modifier le nom').setValue('modify_name').setEmoji('🏷️'),
              new StringSelectMenuOptionBuilder().setLabel('Modifier le message').setValue('modify_message').setEmoji('💬')
            ]
          )
        ),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('validate_custom').setLabel('✅ Valider').setStyle(ButtonStyle.Success))
      );
    };

    const sent = await reply(message, buildMenu());

    const ask = async (q) => {
      const qMsg = await message.channel.send(q).catch(() => null);
      try {
        const col = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 60000, errors: ['time'] });
        const resp = col.first();
        await resp.delete().catch(() => {});
        await qMsg?.delete().catch(() => {});
        return resp.content;
      } catch { await qMsg?.delete().catch(() => {}); return null; }
    };

    const collector = sent.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300000 });

    collector.on('collect', async interaction => {
      await interaction.deferUpdate().catch(() => {});

      if (interaction.isStringSelectMenu()) {
        const val = interaction.values[0];
        if (val === 'style_embed') db.set(`customstyle_${message.guild.id}`, 'embed');
        else if (val === 'style_message') db.set(`customstyle_${message.guild.id}`, 'message');
        else if (val === 'modify_name') {
          const name = await ask('**🏷️ Nouveau nom de la commande ?**');
          if (name) { db.set(`customcmdname_${message.guild.id}`, name); }
        } else if (val === 'modify_message') {
          const msg = await ask('**💬 Entrez le message :**\nVariables : `{user}` `{user:id}` `{guild:name}` `{guild:member}`');
          if (msg) { db.set(`custommsg_${message.guild.id}`, msg); db.set(`customembed_${message.guild.id}`, null); }
        }
        await sent.edit({ components: [buildMenu()], flags: FLAGS }).catch(() => {});
        return;
      }

      if (interaction.customId === 'validate_custom') {
        const name = db.get(`customcmdname_${message.guild.id}`) || cmd;
        const embedData = db.get(`customembed_${message.guild.id}`);
        const messageContent = db.get(`custommsg_${message.guild.id}`);
        if (messageContent) {
          db.set(`customcmd_${name}`, messageContent);
          collector.stop();
          await sent.edit({ components: [container(txt('## ✅ Commande Créée'), sep(), txt(`Commande **${name}** créée (message).`))], flags: FLAGS }).catch(() => {});
        } else if (embedData) {
          db.set(`customcmdembed_${name}`, embedData);
          collector.stop();
          await sent.edit({ components: [container(txt('## ✅ Commande Créée'), sep(), txt(`Commande **${name}** créée (embed).`))], flags: FLAGS }).catch(() => {});
        } else {
          await message.channel.send('❌ Configurez un message avant de valider.').then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
        }
        return;
      }
    });
    collector.on('end', () => sent.edit({ components: [] }).catch(() => {}));
  }
};
