const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'setsop',
  description: 'Configurer le système SOP (réactions + thread public pour images).',
  category: 'gestion',
  usage: 'setsop <enable|disable|channel|message|reactions|threadname|status|test> [args] ',
  run: async (client, message, args) => {
    if (!hasPermissionLevel(client, message, 6)) return message.reply('Vous n\'avez pas la permission.');
    const sub = args[0]?.toLowerCase();
    if (!sub) return message.reply('Usage: setsop <enable|disable|channel|message|reactions|threadname|status|test>');

    const guildId = message.guild.id;

    if (sub === 'enable') {
      db.set(`sop_enabled_${guildId}`, true);
      return message.reply('<a:_:1483497369315315786> SOP activé.');
    }

    if (sub === 'disable') {
      db.delete(`sop_enabled_${guildId}`);
      return message.reply('<a:_:1483497369315315786> SOP désactivé.');
    }

    if (sub === 'channel') {
      const ch = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
      if (!ch) return message.reply('Salon invalide. Mentionnez le salon ou donnez l\'ID.');
      db.set(`sop_channel_${guildId}`, ch.id);
      return message.reply(`<a:_:1483497369315315786> Salon SOP configuré: ${ch}`);
    }

    if (sub === 'message') {
      const text = args.slice(1).join(' ');
      if (!text) return message.reply('Veuillez fournir le message à envoyer dans le thread.');
      db.set(`sop_message_${guildId}`, text);
      return message.reply('<a:_:1483497369315315786> Message SOP configuré. Utilisez {user} et {channel} comme placeholders.');
    }

    if (sub === 'reactions') {
      const e1 = args[1];
      const e2 = args[2];
      if (!e1) return message.reply('Syntaxe: setsop reactions <emoji1> [emoji2]');
      db.set(`sop_reactions_${guildId}`, [e1, e2 || null]);
      return message.reply(`<a:_:1483497369315315786> Réactions configurées: ${e1}${e2 ? ' ' + e2 : ''}`);
    }

    if (sub === 'threadname') {
      const name = args.slice(1).join(' ');
      if (!name) return message.reply('Veuillez fournir un nom de thread (utilisez {user} et {channel} si besoin).');
      db.set(`sop_threadname_${guildId}`, name);
      return message.reply(`<a:_:1483497369315315786> Nom de thread enregistré: ${name}`);
    }

    if (sub === 'status') {
      const enabled = db.get(`sop_enabled_${guildId}`) === true;
      const channel = db.get(`sop_channel_${guildId}`) ? `<#${db.get(`sop_channel_${guildId}`)}>` : 'Non configuré';
      const reactions = db.get(`sop_reactions_${guildId}`) || [];
      const messageConf = db.get(`sop_message_${guildId}`) || 'Non configuré';
      const threadname = db.get(`sop_threadname_${guildId}`) || 'Non configuré';
      return message.reply(`SOP: ${enabled ? 'Activé' : 'Désactivé'}\nSalon: ${channel}\nRéactions: ${reactions.join(' ')}\nMessage: ${messageConf}\nThread: ${threadname}`);
    }

    if (sub === 'test') {
      // Try to run handler against the last message in the channel or a provided message ID
      const { handleSop } = require('../../CODE_SOP_AUTOMOD');
      await message.reply('🔍 Test en cours...');
      const target = args[1] ? await message.channel.messages.fetch(args[1]).catch(() => null) : message.channel.lastMessage;
      const m = target || message;
      const ok = await handleSop(client, m);
      return message.reply(ok ? '<a:_:1483497369315315786> Test réussi (actions exécutées).' : '<a:_:1483497365863399536> Test: aucune action réalisée (probablement pas de photo ou configuration manquante).');
    }

    return message.reply('Sous-commande inconnue. Usage: setsop <enable|disable|channel|message|reactions|threadname|status|test>');
  }
};