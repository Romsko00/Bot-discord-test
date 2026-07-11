const { ChannelType, PermissionsBitField } = require('discord.js');
const { container, txt, sep, row, btn, reply, errorContainer, FLAGS, ButtonStyle } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'server',
  description: 'Informations et gestion des serveurs',
  category: 'bot',
  level: 7,
  run: async (client, message, args) => {
    const isOwner = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!isOwner) return reply(message, errorContainer('**Permission insuffisante.**'));

    if (args[0] === 'leave') {
      const guildId = args[1];
      const guildName = args.slice(1).join(' ').toLowerCase();
      const guild = guildId ? (client.guilds.cache.get(guildId) || client.guilds.cache.find(g => g.name.toLowerCase().includes(guildName))) : message.guild;
      if (!guild) return reply(message, errorContainer(`Serveur introuvable : \`${args.slice(1).join(' ') || 'actuel'}\``));
      try {
        await guild.leave();
        return reply(message, container(txt('## ✅ Serveur Quitté'), sep(), txt(`J'ai quitté **${guild.name}**.`)));
      } catch (e) { return reply(message, errorContainer(`Erreur : ${e.message}`)); }
    }

    if (args[0] === 'invite') {
      const guildId = args[1], guildName = args.slice(1).join(' ').toLowerCase();
      if (!args[1]) return reply(message, errorContainer('**Usage :** `!server invite <id|nom>`'));
      const guild = client.guilds.cache.get(guildId) || client.guilds.cache.find(g => g.name.toLowerCase().includes(guildName));
      if (!guild) return reply(message, errorContainer(`Serveur introuvable.`));
      const textChannel = guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.permissionsFor(guild.members.me)?.has(PermissionsBitField.Flags.CreateInstantInvite));
      if (!textChannel) return reply(message, errorContainer('Impossible de créer une invitation.'));
      try {
        const invite = await textChannel.createInvite({ temporary: false, maxAge: 0, reason: `Généré par ${message.author.tag}` });
        return reply(message, container(txt('## 📨 Invitation'), sep(), txt([`**Serveur :** ${guild.name}`, `**Lien :** ${invite.url}`].join('\n'))));
      } catch (e) { return reply(message, errorContainer(`Erreur : ${e.message}`)); }
    }

    if (args[0] === 'list') {
      const guilds = client.guilds.cache;
      const PER_PAGE = 15, totalPages = Math.max(1, Math.ceil(guilds.size / PER_PAGE));
      let page = 0;

      const buildPage = (p) => {
        const pageGuilds = Array.from(guilds.values()).slice(p * PER_PAGE, (p + 1) * PER_PAGE);
        const lines = pageGuilds.map((g, i) => `${p * PER_PAGE + i + 1}. **${g.name}** (${g.id}) — ${g.memberCount} membres`).join('\n');
        return container(
          txt(`## 🌐 Serveurs (${guilds.size})`),
          sep(),
          txt(lines || 'Aucun serveur.'),
          sep(),
          txt(`Page ${p + 1}/${totalPages}`),
          ...(totalPages > 1 ? [row(btn('srv_prev', '‹', ButtonStyle.Primary, null, p === 0), btn('srv_page', `${p + 1}/${totalPages}`, ButtonStyle.Secondary, null, true), btn('srv_next', '›', ButtonStyle.Primary, null, p >= totalPages - 1))] : [])
        );
      };

      const sent = await reply(message, buildPage(0));
      if (totalPages <= 1) return;
      const collector = sent.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300000 });
      collector.on('collect', async i => {
        if (i.customId === 'srv_prev') page = Math.max(0, page - 1);
        else if (i.customId === 'srv_next') page = Math.min(totalPages - 1, page + 1);
        await i.update({ components: [buildPage(page)], flags: FLAGS });
      });
      collector.on('end', () => sent.edit({ components: [] }).catch(() => {}));
      return;
    }

    return reply(message, errorContainer('**Usage :** `!server <leave|invite|list> [serveur]`'));
  }
};
