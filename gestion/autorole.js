const { RoleSelectMenuBuilder } = require('discord.js');
const db = require('../../utils/simpledb');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, row, btn, reply, errorContainer, FLAGS, ButtonStyle } = require('../../utils/v2');

const DB_KEY = (g) => `autorole_${g}`;

function buildContainer(guild) {
  const roleId = db.get(DB_KEY(guild.id));
  const role = roleId ? guild.roles.cache.get(roleId) : null;
  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId('ar_role_select')
    .setPlaceholder('Sélectionner un rôle')
    .setMinValues(1).setMaxValues(1);

  return container(
    txt('## 🎭 Rôle Automatique à l\'Arrivée'),
    sep(),
    txt(`**Rôle configuré :** ${role ? `${role.name} (\`${roleId}\`)` : '*Aucun*'}`),
    sep(),
    row(roleSelect),
    row(btn('ar_remove', '✖ Retirer le rôle', ButtonStyle.Danger, null, !roleId))
  );
}

module.exports = {
  name: 'autorole',
  aliases: ['joinrole'],
  description: 'Configure le rôle attribué automatiquement aux nouveaux membres.',
  category: 'gestion',
  run: async (client, message) => {
    if (!hasPermissionLevel(client, message, 6)) return reply(message, errorContainer('Permission insuffisante.'));
    const guildId = message.guild.id;
    await message.guild.roles.fetch().catch(() => {});

    const msg = await message.channel.send({ components: [buildContainer(message.guild)], flags: FLAGS });
    const refresh = () => msg.edit({ components: [buildContainer(message.guild)], flags: FLAGS }).catch(() => {});

    const col = msg.createMessageComponentCollector({ time: 300_000, filter: i => i.user.id === message.author.id });
    col.on('collect', async i => {
      await i.deferUpdate().catch(() => {});

      if (i.customId === 'ar_role_select') {
        const roleId = i.values[0];
        const role = message.guild.roles.cache.get(roleId);
        if (role && role.position >= message.guild.members.me.roles.highest.position) {
          await msg.edit({ components: [container(
            txt('## ❌ Hiérarchie insuffisante'),
            sep(),
            txt('Je ne peux pas attribuer ce rôle (ma position est trop basse).'),
            row(btn('ar_back', '↩ Retour', ButtonStyle.Secondary))
          )], flags: FLAGS }).catch(() => {});
          return;
        }
        db.set(DB_KEY(guildId), roleId);
        await refresh(); return;
      }

      if (i.customId === 'ar_remove') { db.delete(DB_KEY(guildId)); await refresh(); return; }
      if (i.customId === 'ar_back') { await refresh(); return; }
    });

    col.on('end', () => msg.edit({ components: [container(txt('⏰ Menu expiré.'))], flags: FLAGS }).catch(() => {}));
  }
};
