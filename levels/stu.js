const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, formatNumber, progress, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

const XP_PER_LEVEL = 500;

function getStats(guildId, userId, client) {
  const xpPerLevel = client.config?.LEVELS?.XP_REQUIRED_PER_LEVEL || XP_PER_LEVEL;
  const xp = parseInt(db.get(`guild_${guildId}_xp_${userId}`)) || 0;
  const level = parseInt(db.get(`guild_${guildId}_level_${userId}`)) || 1;
  const messages = parseInt(db.get(`msg_${guildId}_${userId}`)) || 0;
  const vocalMin = parseInt(db.get(`vocal_time_${guildId}_${userId}`)) || 0;
  const xpNeeded = level * xpPerLevel;
  const bar = progress(xp, xpNeeded, 12);
  const credits = parseInt(db.get(`credits_${guildId}_${userId}`)) || 0;
  return { xp, level, messages, vocalMin, xpNeeded, bar, credits };
}

function buildPage(page, target, guildId, client) {
  const s = getStats(guildId, target.user.id, client);
  const pages = {
    0: container(
      txt(`## 📊 Niveau — ${target.user.username}`),
      sep(),
      txt([`**⭐ Niveau :** ${s.level}`, `**XP :** ${formatNumber(s.xp)} / ${formatNumber(s.xpNeeded)}`, s.bar, `**💬 Messages :** ${formatNumber(s.messages)}`, `**💰 Crédits :** ${formatNumber(s.credits)}`].join('\n'))
    ),
    1: container(
      txt(`## 💬 Messages — ${target.user.username}`),
      sep(),
      txt([`**Total :** ${formatNumber(s.messages)} messages`, `**Niveau actuel :** ${s.level}`].join('\n'))
    ),
    2: container(
      txt(`## 🎙️ Vocal — ${target.user.username}`),
      sep(),
      txt([`**Temps total :** ${Math.floor(s.vocalMin / 60)}h ${s.vocalMin % 60}m`].join('\n'))
    ),
    3: container(
      txt(`## 📅 Profil — ${target.user.username}`),
      sep(),
      txt([
        `**Compte créé :** <t:${Math.floor(target.user.createdAt.getTime() / 1000)}:D>`,
        `**A rejoint :** <t:${Math.floor((target.joinedAt?.getTime() || 0) / 1000)}:D>`,
        `**Rôles :** ${target.roles.cache.size - 1}`
      ].join('\n'))
    )
  };
  return pages[page] || pages[0];
}

function getButtons(page, userId) {
  const labels = ['Vue d\'ensemble', 'Messages', 'Vocal', 'Profil'];
  const row1 = new ActionRowBuilder();
  for (let i = 0; i < 4; i++) {
    row1.addComponents(new ButtonBuilder().setCustomId(`stu_${i}_${userId}`).setLabel(labels[i]).setStyle(page === i ? ButtonStyle.Primary : ButtonStyle.Secondary));
  }
  return [row1];
}

module.exports = {
  name: 'stu',
  aliases: ['lvl', 'xp', 'niveau', 'stats', 'level'],
  description: 'Affiche votre progression et statistiques sur le serveur',
  usage: '[@membre]',
  level: 0,
  run: async (client, message, args) => {
    try {
      const target = message.mentions.members?.first() || message.guild.members.cache.get(args[0]) || message.member;
      const guildId = message.guild.id;
      const userId = target.user.id;
      let currentPage = 0;

      const msg = await reply(message, buildPage(0, target, guildId, client));
      await msg.edit({ components: [buildPage(0, target, guildId, client), ...getButtons(0, userId)], flags: FLAGS });

      const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 120000 });
      collector.on('collect', async interaction => {
        const parts = interaction.customId.split('_');
        if (parts[0] !== 'stu') return;
        if (parts[1] === 'refresh') {
          await interaction.update({ components: [buildPage(currentPage, target, guildId, client), ...getButtons(currentPage, userId)], flags: FLAGS });
          return;
        }
        currentPage = parseInt(parts[1]);
        await interaction.update({ components: [buildPage(currentPage, target, guildId, client), ...getButtons(currentPage, userId)], flags: FLAGS });
      });
      collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
    } catch (error) {
      console.error('Erreur stu:', error);
      return reply(message, errorContainer('Impossible de récupérer les statistiques.'));
    }
  }
};
