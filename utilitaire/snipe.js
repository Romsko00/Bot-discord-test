const { container, txt, FLAGS } = require('../../utils/v2');

const INVITE_RE = /discord(?:app)?\.(?:gg|com\/invite)\/\w+/gi;

function maskInvites(str) {
  return str.replace(INVITE_RE, '`[lien masqué]`');
}

module.exports = {
  name: 'snipe',
  aliases: ['s', 'lastmessage'],
  description: 'Affiche le dernier message supprimé dans ce salon.',
  level: 0,

  run: async (client, message, args) => {
    const snipeMap = global._snipes || client.snipes;
    if (!snipeMap) return;

    const snipes = snipeMap.get(message.channel.id);
    if (!snipes || snipes.length === 0)
      return message.channel.send({ components: [container(txt('Aucun message supprimé récemment.'))], flags: FLAGS }).catch(() => {});

    const index = args[0] ? Math.max(0, Math.min(parseInt(args[0]) - 1 || 0, snipes.length - 1)) : 0;
    const msg = snipes[index];

    const lines = [];

    lines.push(`**${msg.author?.username || 'Inconnu'}** — <t:${Math.floor((msg.timestamp || Date.now()) / 1000)}:R>`);

    if (msg.content) {
      lines.push(maskInvites(msg.content).slice(0, 3800));
    }

    if (msg.stickers?.length > 0) {
      for (const s of msg.stickers) {
        lines.push(`🎭 **Sticker :** [${s.name}](${s.url})`);
      }
    }

    if (msg.attachments?.length > 0) {
      for (const att of msg.attachments) {
        const isImage = att.contentType?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(att.name || '');
        const label = isImage ? `🖼️ Image` : `📎 ${att.name || 'Fichier'}`;
        lines.push(`${label} → ${att.url}`);
      }
    }

    if (snipes.length > 1) {
      lines.push(`-# ${index + 1}/${snipes.length} — \`+snipe ${index + 2}\` pour le précédent`);
    }

    await message.channel.send({
      components: [container(txt(lines.join('\n')))],
      flags: FLAGS
    }).catch(() => {});
  }
};
