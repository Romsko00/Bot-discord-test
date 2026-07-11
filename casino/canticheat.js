const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const AntiCheat = require('../../utils/anticheat');

module.exports = {
  name: 'canticheat',
  aliases: ['anticheat', 'eco'],
  description: 'Outils anti-abus et économie saine casino',
  usage: '+canticheat <@user>',
  category: 'casino',
  run: async (client, message, args) => {
    const user = message.mentions.users.first();
    if (!user) return reply(message, errorContainer('Mentionne un utilisateur.'));
    const userId = user.id;
    const isSpam = AntiCheat.checkSpam(userId);
    const isWhale = AntiCheat.detectWhale(userId);
    return reply(message, container(
      txt('## 🛡️ Anti-Abus Casino'),
      sep(),
      txt([`**Utilisateur :** ${user}`, `**Spam détecté :** ${isSpam ? '⚠️ Oui' : '✅ Non'}`, `**Whale détecté :** ${isWhale ? '⚠️ Oui' : '✅ Non'}`].join('\n'))
    ));
  }
};
