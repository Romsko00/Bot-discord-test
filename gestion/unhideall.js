const { ChannelType, PermissionsBitField } = require('discord.js');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'unhideall',
  aliases: ['montrertout'],
  description: 'Montre tous les salons cachés',

  run: async (client, message) => {
    const isSuperOwner = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!isSuperOwner && !hasPermissionLevel(client, message, 6))
      return reply(message, errorContainer('**Permission refusée** — Admin (niveau 6) requis.'));

    const loading = await reply(message, container(txt('## ⏳ Révélation en cours...'), sep(), txt('Révélation de tous les salons cachés...')));

    try {
      const channels = message.guild.channels.cache.filter(ch => ch.type === ChannelType.GuildText && !ch.permissionsFor(message.guild.roles.everyone).has(PermissionsBitField.Flags.ViewChannel));
      let success = 0, failed = 0;
      for (const [, ch] of channels) {
        try { await ch.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: true }); success++; }
        catch { failed++; }
      }
      await loading.edit({ components: [container(txt('## ✅ Révélation Terminée'), sep(), txt([`**Salons révélés :** ${success}`, failed > 0 ? `**Erreurs :** ${failed}` : null, `**Modérateur :** ${message.author.tag}`].filter(Boolean).join('\n')))], flags: FLAGS });
      const logCh = message.guild.channels.cache.get(db.get(`${message.guild.id}.modlog`));
      if (logCh) logCh.send({ components: [container(txt(`## 👁️ Unhideall\n**Par :** ${message.author.tag}\n**Salons révélés :** ${success}`))], flags: FLAGS }).catch(() => {});
    } catch (e) {
      console.error('[unhideall]', e);
      loading.edit({ components: [errorContainer('Une erreur s\'est produite.')], flags: FLAGS }).catch(() => {});
    }
  }
};
