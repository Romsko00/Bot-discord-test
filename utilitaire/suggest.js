const Discord = require('discord.js');
const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'suggest', aliases: [],
  description: 'Système de suggestions', level: 0,
  run: async (client, message, args) => {
    if (!message.member) { try { message.member = await message.guild.members.fetch(message.author.id); } catch {} }
    let perm = false;
    message.member?.roles?.cache?.forEach(r => { if (db.get(`modsp_${message.guild.id}_${r.id}`) || db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
    const canSuggest = db.get(`suggest_public_${message.guild.id}`) === true || perm || client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`);
    if (!canSuggest) return reply(message, errorContainer('Permission refusée pour les suggestions.'));
    const suggestion = args.join(' ');
    if (!suggestion) return reply(message, errorContainer('Veuillez fournir une suggestion.'));
    const channelId = db.get(`suggest_channel_${message.guild.id}`);
    if (!channelId) return reply(message, errorContainer('Aucun salon de suggestions configuré. Utilisez `+suggestsetup`.'));
    const channel = message.guild.channels.cache.get(channelId);
    if (!channel) return reply(message, errorContainer('Salon de suggestions introuvable.'));
    try {
      const suggestionMessage = await channel.send({ components: [container(txt('## 💡 Nouvelle Suggestion'), sep(), txt(suggestion), sep(), txt(`*Suggéré par ${message.author.tag} · ID: ${message.author.id}*`))], flags: FLAGS });
      await suggestionMessage.react('<a:_:1483497369315315786>');
      await suggestionMessage.react('<a:_:1483497365863399536>');
      await suggestionMessage.react('🤷');
      await reply(message, container(txt('✅ Votre suggestion a été envoyée !')));
      const suggestions = db.get(`suggestions_${message.guild.id}`) || [];
      suggestions.push({ id: suggestionMessage.id, author: message.author.id, content: suggestion, timestamp: Date.now(), votes: { up: 0, down: 0, neutral: 0 } });
      db.set(`suggestions_${message.guild.id}`, suggestions);
    } catch (e) { console.error(e); await reply(message, errorContainer("Erreur lors de l'envoi de la suggestion.")); }
  }
};
