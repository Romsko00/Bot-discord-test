const { parseEmoji } = require('discord.js');
const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, successContainer, FLAGS } = require('../../utils/v2');

function getEmojiLimit(guild) {
  const tier = guild.premiumTier;
  if (typeof tier === 'number') { switch(tier){case 1:return 100;case 2:return 150;case 3:return 250;default:return 50;} }
  switch(tier){case'TIER_1':return 100;case'TIER_2':return 150;case'TIER_3':return 250;default:return 50;}
}

module.exports = {
  name: 'emoji',
  aliases: ['emote'],
  description: 'Gestion des emojis du serveur',
  category: 'gestion',
  run: async (client, message, args) => {
    let hasPerm = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!hasPerm) message.member.roles.cache.forEach(r => { if (db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`)) hasPerm = true; });
    if (!hasPerm) return reply(message, errorContainer('Permission refusée.'));

    const prefix = message.content.split(/\s+/)[0].replace(/\S+/,'') || '+';
    const sub = args[0]?.toLowerCase();

    if (!sub) {
      return reply(message, container(txt('## 🎭 Gestion des Emojis'), sep(), txt([`**Ajouter :** \`+emoji add <emoji> [nom]\``, `**Supprimer :** \`+emoji remove <emoji>\``, `**Lister :** \`+emoji list\``].join('\n'))));
    }

    if (sub === 'add') {
      if (!args[1]) return reply(message, errorContainer('Veuillez spécifier au moins un emoji personnalisé à ajouter.'));
      const tokens = args.slice(1);
      const groups = [];
      let current = null;
      for (const tok of tokens) {
        const parsed = parseEmoji(tok);
        if (parsed?.id) { if (current) groups.push(current); current = { parsed, nameParts: [] }; }
        else if (current) current.nameParts.push(tok);
      }
      if (current) groups.push(current);
      if (!groups.length) return reply(message, errorContainer('Aucun emoji personnalisé valide détecté.'));
      const emojiCount = message.guild.emojis.cache.size, emojiLimit = getEmojiLimit(message.guild);
      const remaining = Math.max(emojiLimit - emojiCount, 0);
      if (!remaining) return reply(message, errorContainer(`Limite d'emojis atteinte (${emojiCount}/${emojiLimit}).`));
      const toProcess = groups.slice(0, remaining), skippedCount = groups.length - toProcess.length;
      const loadMsg = await message.channel.send({ components: [container(txt(`## ⏳ Ajout en cours…`), sep(), txt(`Ajout de ${toProcess.length} emoji(s)...`))], flags: FLAGS });
      const successes = [], failures = [];
      for (const g of toProcess) {
        const e = g.parsed, ext = e.animated ? 'gif' : 'png', emojiUrl = `https://cdn.discordapp.com/emojis/${e.id}.${ext}?size=128`;
        let name = g.nameParts.join('_').replace(/[^a-zA-Z0-9_]/g,'') || e.name || `emoji_${e.id}`;
        if (name.length < 2 || name.length > 32) { failures.push({ input: `<${e.animated?'a:':':'}${e.name}:${e.id}>`, reason:'Nom invalide (2-32 car.)' }); continue; }
        try { const created = await message.guild.emojis.create({ attachment: emojiUrl, name }, `Ajouté par ${message.author.tag}`); successes.push(created); }
        catch (err) { let r='Erreur inconnue'; if (err.code===50035) r="Nom d'emoji invalide"; else if (err.message?.includes('Maximum number')) r='Limite atteinte'; failures.push({ input:`<${e.animated?'a:':':'}${e.name}:${e.id}>`, reason:r }); }
      }
      loadMsg.delete().catch(()=>{});
      const lines = [];
      if (successes.length) lines.push(`**Ajoutés (${successes.length}):** ${successes.map(e=>`${e} \`(${e.name})\``).join(' ')}`);
      if (failures.length) { lines.push(`**Échecs (${failures.length}):**`); failures.slice(0,10).forEach(f => lines.push(`• ${f.input} → ${f.reason}`)); if (failures.length>10) lines.push(`...et ${failures.length-10} de plus.`); }
      if (skippedCount) lines.push(`**Ignorés:** ${skippedCount} emoji(s) ignoré(s) (limite).`);
      return reply(message, container(txt(`## ${successes.length>0?'✅':'❌'} Résultat Ajout`), sep(), txt(lines.join('\n'))));
    }

    if (sub === 'remove') {
      if (!args[1]) return reply(message, errorContainer('Veuillez spécifier un emoji à supprimer.'));
      let emoji = null;
      if (/^\d+$/.test(args[1])) emoji = message.guild.emojis.cache.get(args[1]);
      else if (/<a?:(\w+):(\d+)>/.test(args[1])) { const m = args[1].match(/<a?:(\w+):(\d+)>/); emoji = message.guild.emojis.cache.get(m[2]); }
      else emoji = message.guild.emojis.cache.find(e => e.name === args[1]);
      if (!emoji) return reply(message, errorContainer('Emoji introuvable sur ce serveur.'));
      const emojiUrl = emoji.url, emojiName = emoji.name;
      try {
        await emoji.delete(`Supprimé par ${message.author.tag}`);
        return reply(message, container(txt('## ✅ Emoji Supprimé'), sep(), txt(`**Nom :** \`${emojiName}\`\n**ID :** ${emoji.id}`)));
      } catch { return reply(message, errorContainer("Impossible de supprimer cet emoji.")); }
    }

    if (sub === 'list') {
      const emojis = message.guild.emojis.cache;
      if (!emojis.size) return reply(message, container(txt('## 🎭 Emojis'), sep(), txt('Ce serveur n\'a aucun emoji personnalisé.')));
      const animated = emojis.filter(e => e.animated), statics = emojis.filter(e => !e.animated);
      const lines = [`**Emojis normaux (${statics.size}):**`, statics.size?statics.map(e=>e.toString()).join(' '):'Aucun', '', `**Emojis animés (${animated.size}):**`, animated.size?animated.map(e=>e.toString()).join(' '):'Aucun', '', `Total: **${emojis.size}** / Limite: **${getEmojiLimit(message.guild)}**`];
      return reply(message, container(txt(`## 🎭 Emojis — ${message.guild.name}`), sep(), txt(lines.join('\n'))));
    }

    return reply(message, errorContainer('Sous-commande invalide. Utilisez `add`, `remove` ou `list`.'));
  }
};
