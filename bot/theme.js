const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'theme',
  aliases: ['color'],
  description: 'Change le thème/couleur d\'embed du bot',
  category: 'bot',
  level: 7,
  run: async (client, message, args) => {
    const isOwner = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`);
    if (!isOwner) return reply(message, errorContainer('**Permission insuffisante.**'));
    const currentColor = db.get(`color_${message.guild.id}`) || client.config.SETTINGS?.EMBED_COLOR || '#1a1a1a';
    if (!args[0]) return reply(message, container(txt('## 🎨 Thème'), sep(), txt(`**Couleur actuelle :** \`${currentColor}\`\nUtilisez \`!theme <couleur>\` pour la changer.`)));
    if (args.length > 1) return reply(message, errorContainer('Spécifiez une seule couleur. Exemple : `#FF0000`'));
    const newColor = args[0];
    const colorRegex = /^#([0-9A-F]{3}){1,2}$/i;
    const namedColors = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'ORANGE', 'PINK', 'WHITE', 'BLACK', 'GREY'];
    if (!colorRegex.test(newColor) && !namedColors.includes(newColor.toUpperCase())) return reply(message, errorContainer('Couleur invalide. Utilisez un format hexadécimal (`#FF0000`) ou un nom.'));
    const colorBar = (hex) => {
      const named = { RED: '#FF0000', BLUE: '#0000FF', GREEN: '#00FF00', YELLOW: '#FFFF00', PURPLE: '#800080', ORANGE: '#FFA500', PINK: '#FFC0CB', WHITE: '#FFFFFF', BLACK: '#000000', GREY: '#808080' };
      const h = named[hex.toUpperCase()] || hex;
      return `\`${h}\` ████████`;
    };

    try {
      db.set(`color_${message.guild.id}`, newColor);
      return reply(message, container(
        txt('## 🎨 Thème modifié'),
        sep(),
        txt([
          `**Couleur précédente :** \`${currentColor}\``,
          `**Nouvelle couleur :** \`${newColor}\``,
          `**Prévisualisation :** ${colorBar(newColor)}`
        ].join('\n'))
      ));
    } catch (e) { return reply(message, errorContainer(`Erreur : ${e.message}`)); }
  }
};
