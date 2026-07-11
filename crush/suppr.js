const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'suppr',
  aliases: ['supprprofil', 'deleteprofil', 'removeprofil'],
  description: 'Supprime le profil d\'un membre manuellement',
  category: 'crush',
  usage: '+suppr @user',
  run: async (client, message, args, prefix) => {
    if (!hasPermissionLevel(client, message, 6)) return reply(message, errorContainer('Permission insuffisante (niveau 6 requis).'));
    const target = message.mentions.users.first() || (args[0] && await client.users.fetch(args[0]).catch(() => null));
    if (!target) return reply(message, errorContainer(`**Usage :** \`${prefix}suppr @user\``));
    const guildId = message.guild.id;
    const key = `crush_profile_${guildId}_${target.id}`;
    const profile = db.get(key);
    if (!profile) return reply(message, errorContainer(`Aucun profil trouvé pour ${target}.`));
    db.delete(key);
    if (profile.messageId && profile.channelId) {
      try {
        const ch = await client.channels.fetch(profile.channelId).catch(() => null);
        if (ch) { const msg = await ch.messages.fetch(profile.messageId).catch(() => null); if (msg) await msg.delete().catch(() => {}); }
      } catch {}
    }
    return reply(message, container(txt('## ✅ Profil Supprimé'), sep(), txt(`Profil de **${target.tag}** supprimé avec succès.`)));
  }
};
