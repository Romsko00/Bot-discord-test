const Discord = require('discord.js');
const db = require('../../utils/simpledb');
const { container, txt, sep, reply, FLAGS } = require('../../utils/v2');

// masseembed: builds Discord embeds as the product to be sent.
// Product embeds (amshow/amsend) stay as raw EmbedBuilder (the embed IS the output).
// Status replies (amtitle, amdesc…) use plain text.
module.exports = {
  name: 'masseembed',
  aliases: ['amtitle', 'amdescription', 'amdesc', 'amcolor', 'amfooter', 'amimage', 'amimg', 'amurl', 'amshow', 'amsend'],
  category: 'utilitaire',
  description: 'Suite de commandes pour créer et envoyer des embeds',
  run: async (client, message, args) => {
    const prefix = client.config.prefix;
    const cmdUsed = message.content.slice(prefix.length).split(/ +/)[0].toLowerCase();
    const userId = message.author.id;
    let draft = db.get(`embed_draft_${userId}`) || {};
    const save = () => db.set(`embed_draft_${userId}`, draft);
    const content = args.join(' ');
    switch (cmdUsed) {
      case 'amtitle':       draft.title = content; save(); message.reply('✅ Titre défini.'); break;
      case 'amdescription':
      case 'amdesc':        draft.description = content; save(); message.reply('✅ Description définie.'); break;
      case 'amcolor':       draft.color = content; save(); message.reply('✅ Couleur définie.'); break;
      case 'amfooter':      draft.footer = content; save(); message.reply('✅ Footer défini.'); break;
      case 'amimage':
      case 'amimg':         draft.image = message.attachments.size > 0 ? message.attachments.first().url : content; save(); message.reply('✅ Image définie.'); break;
      case 'amurl':         draft.url = content; save(); message.reply('✅ URL définie.'); break;
      case 'amsend': {
        const targetChannel = message.mentions.channels.first() || message.channel;
        const finalEmbed = new Discord.EmbedBuilder();
        if (draft.title) finalEmbed.setTitle(draft.title);
        if (draft.description) finalEmbed.setDescription(draft.description);
        if (draft.color) { try { finalEmbed.setColor(draft.color); } catch { finalEmbed.setColor('#000000'); } }
        if (draft.footer) finalEmbed.setFooter({ text: draft.footer });
        if (draft.image) finalEmbed.setImage(draft.image);
        if (draft.url) finalEmbed.setURL(draft.url);
        try { await targetChannel.send({ embeds: [finalEmbed] }); message.reply(`✅ Embed envoyé dans ${targetChannel.toString()}.`); }
        catch { message.reply("❌ Erreur lors de l'envoi (Permissions ?)."); }
        break;
      }
      case 'amshow':
      case 'masseembed':
      default: {
        const showEmbed = new Discord.EmbedBuilder();
        if (draft.title) showEmbed.setTitle(draft.title); else showEmbed.setTitle('Aperçu du brouillon');
        if (draft.description) showEmbed.setDescription(draft.description);
        if (draft.color) { try { showEmbed.setColor(draft.color); } catch {} }
        if (draft.footer) showEmbed.setFooter({ text: draft.footer });
        if (draft.image) showEmbed.setImage(draft.image);
        if (draft.url) showEmbed.setURL(draft.url);
        message.reply({ content: 'Voici votre brouillon actuel :', embeds: [showEmbed] });
        break;
      }
    }
  }
};
