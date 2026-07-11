const { ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const { buildActionRow, buildBackRow } = require('../../utils/uiHelper');
const db = require('../../utils/simpledb');
const EMOJIS = require('../../utils/emojis');

const MAX    = 25;
const PREFIX = (g) => `wlmd_${g}_`;

function getIds(guildId) {
  return db.all().filter(e => e.ID.startsWith(PREFIX(guildId))).map(e => e.ID.replace(PREFIX(guildId), ''));
}

function buildContainer(guild) {
  const ids   = getIds(guild.id);
  const valid = ids.filter(id => guild.members.cache.has(id));
  const lines = valid.length ? valid.map(id => `${EMOJIS.USER || '👤'} <@${id}>`) : ['*Aucun membre whitelisté*'];
  return container(
    txt('## 🛡️ Whitelist du Serveur'),
    sep(),
    txt(lines.slice(0, 20).join('\n') + (lines.length > 20 ? `\n*...et ${lines.length - 20} de plus*` : '')),
    sep(),
    txt(`**${valid.length}/${MAX}** membres whitelistés`)
  );
}

module.exports = {
  name:    'whitelist',
  aliases: ['wl'],
  description: 'Gestion de la whitelist',

  run: async (client, message) => {
    if (
      !client.config.superadmin?.includes(message.author.id) &&
      !client.config.owners?.includes(message.author.id) &&
      !db.get(`ownermd_${client.user.id}_${message.author.id}`)
    ) return reply(message, errorContainer(`Seuls les owners peuvent gérer la whitelist.`));

    const guildId = message.guild.id;
    await message.guild.members.fetch().catch(() => {});

    const msg = await message.reply({
      components: [buildContainer(message.guild), buildActionRow('wl_add', 'wl_remove', 'wl_clear', getIds(guildId).length, MAX)],
      flags: FLAGS,
      allowedMentions: { repliedUser: false },
    });

    async function refresh() {
      await msg.edit({ components: [buildContainer(message.guild), buildActionRow('wl_add', 'wl_remove', 'wl_clear', getIds(guildId).length, MAX)], flags: FLAGS }).catch(() => {});
    }

    const col = msg.createMessageComponentCollector({ time: 300_000, filter: i => i.user.id === message.author.id });

    col.on('collect', async (i) => {
      if (i.customId === 'wl_add') {
        await i.deferUpdate();
        const free = MAX - getIds(guildId).length;
        await msg.edit({ components: [container(txt(`Quels membres ajouter à la whitelist ? (max ${free})`)), new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('wl_user_add').setPlaceholder('Sélectionner des membres').setMinValues(1).setMaxValues(Math.min(free, 25))), buildBackRow('wl_back')], flags: FLAGS }).catch(() => {});
        return;
      }
      if (i.customId === 'wl_remove') {
        await i.deferUpdate();
        const count = getIds(guildId).length;
        if (!count) { await refresh(); return; }
        await msg.edit({ components: [container(txt('Quels membres retirer de la whitelist ?')), new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('wl_user_remove').setPlaceholder('Sélectionner des membres').setMinValues(1).setMaxValues(Math.min(count, 25))), buildBackRow('wl_back')], flags: FLAGS }).catch(() => {});
        return;
      }
      if (i.customId === 'wl_clear') { await i.deferUpdate(); getIds(guildId).forEach(id => db.delete(`${PREFIX(guildId)}${id}`)); await refresh(); return; }
      if (i.customId === 'wl_back') { await i.deferUpdate(); await refresh(); return; }
      if (i.customId === 'wl_user_add') {
        await i.deferUpdate();
        let added = 0;
        for (const uid of i.values) { if (!db.get(`${PREFIX(guildId)}${uid}`) && getIds(guildId).length < MAX) { db.set(`${PREFIX(guildId)}${uid}`, true); added++; } }
        await refresh();
        return;
      }
      if (i.customId === 'wl_user_remove') {
        await i.deferUpdate();
        let removed = 0;
        for (const uid of i.values) { if (db.get(`${PREFIX(guildId)}${uid}`)) { db.delete(`${PREFIX(guildId)}${uid}`); removed++; } }
        await refresh();
        return;
      }
    });

    col.on('end', () => msg.edit({ components: [buildContainer(message.guild)], flags: FLAGS }).catch(() => {}));
  },

  isWhitelisted(guildId, userId) { return db.get(`wlmd_${guildId}_${userId}`) === true; },
};
