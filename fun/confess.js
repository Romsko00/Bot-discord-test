const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');
const { hasPermissionLevel, AccessLevels } = require('../../utils/permissionUtils');

function getConfessChannel(guildId, guild) { const id = db.get(`confess_channel_${guildId}`); return id ? guild.channels.cache.get(id) : null; }
function getLogChannel(guildId, guild) { const id = db.get(`confess_logs_channel_${guildId}`); return id ? guild.channels.cache.get(id) : null; }
function nextCount(guildId) { const n = (db.get(`confess_count_${guildId}`) || 0) + 1; db.set(`confess_count_${guildId}`, n); return n; }

function buildConfessButtons(confessId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`confess_reply_${confessId}`).setLabel('Répondre anonymement').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`confess_report_${confessId}`).setLabel('Signaler').setStyle(ButtonStyle.Danger)
  );
}

module.exports = {
  name: 'confess',
  aliases: ['confession'],
  description: 'Confession anonyme',
  run: async (client, message, args) => {
    const guildId = message.guild.id;

    if (args[0]?.toLowerCase() === 'set') {
      if (!hasPermissionLevel(client, message, 6)) return reply(message, errorContainer('Niveau 6 requis.'));
      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
      if (!channel || channel.type !== 0) return reply(message, errorContainer('Mentionnez un salon textuel.'));
      db.set(`confess_channel_${guildId}`, channel.id);
      return reply(message, container(txt('## ✅ Salon Configuré'), sep(), txt(`Confessions → ${channel}`)));
    }

    if (args[0]?.toLowerCase() === 'logs') {
      if (!hasPermissionLevel(client, message, 6)) return reply(message, errorContainer('Niveau 6 requis.'));
      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
      if (!channel || channel.type !== 0) return reply(message, errorContainer('Mentionnez un salon textuel.'));
      db.set(`confess_logs_channel_${guildId}`, channel.id);
      return reply(message, container(txt('## ✅ Logs Configurés'), sep(), txt(`Logs → ${channel}`)));
    }

    if (args[0]?.toLowerCase() === 'config') {
      const chanId = db.get(`confess_channel_${guildId}`);
      const logId = db.get(`confess_logs_channel_${guildId}`);
      const count = db.get(`confess_count_${guildId}`) || 0;
      return reply(message, container(
        txt('## 📋 Config Confessions'),
        sep(),
        txt([`**Salon :** ${chanId ? `<#${chanId}>` : 'Non configuré'}`, `**Logs :** ${logId ? `<#${logId}>` : 'Non configuré'}`, `**Total :** ${count}`].join('\n'))
      ));
    }

    return reply(message, container(
      txt('## 🤫 Confession Anonyme'),
      sep(),
      txt(['Utilisez `/confess` pour soumettre une confession anonyme.', '', '**Admin :** `!confess set #salon` | `!confess logs #salon` | `!confess config`'].join('\n'))
    ));
  },

  async handleInteraction(interaction, client) {
    const id = interaction.customId;

    if (id.startsWith('confess_reply_')) {
      const confessId = id.replace('confess_reply_', '');
      const entry = db.get(`confess_entry_${confessId}`);
      const parentCount = entry?.count || '?';
      const modalId = `confess_replymodal_${confessId}_${Date.now()}`;
      const modal = new ModalBuilder().setCustomId(modalId).setTitle(`Répondre — Confession #${String(parentCount).padStart(4, '0')}`);
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reply_text').setLabel('Votre réponse anonyme').setStyle(TextInputStyle.Paragraph).setMinLength(5).setMaxLength(3900).setRequired(true)));
      await interaction.showModal(modal);
      let submit;
      try { submit = await interaction.awaitModalSubmit({ filter: i => i.customId === modalId && i.user.id === interaction.user.id, time: 300_000 }); } catch { return; }
      const content = submit.fields.getTextInputValue('reply_text').trim();
      const guildId = interaction.guild.id;
      const replyNum = nextCount(guildId);
      const channel = entry?.channelId ? interaction.guild.channels.cache.get(entry.channelId) : getConfessChannel(guildId, interaction.guild);
      if (!channel) return submit.reply({ content: 'Salon introuvable.', ephemeral: true });
      db.set(`confess_entry_${guildId}_${replyNum}`, { count: replyNum, guildId, channelId: channel.id });
      await channel.send({ components: [container(txt(`## 💬 Réponse Anonyme ↳ #${String(parentCount).padStart(4, '0')}`), sep(), txt(`\`\`\`\n${content}\n\`\`\``)), buildConfessButtons(`${guildId}_${replyNum}`)], flags: FLAGS });
      const logChan = getLogChannel(guildId, interaction.guild);
      if (logChan) await logChan.send({ content: `**Log Réponse #${replyNum}** → Confession #${parentCount}\nAuteur: ${submit.user.tag} (${submit.user.id})\n\`\`\`${content.slice(0, 900)}\`\`\`` }).catch(() => {});
      await submit.reply({ content: '✅ Réponse anonyme publiée.', ephemeral: true });
      return true;
    }

    if (id.startsWith('confess_report_')) {
      const confessId = id.replace('confess_report_', '');
      const guildId = interaction.guild.id;
      const reportKey = `confess_report_${confessId}_${interaction.user.id}`;
      if (db.get(reportKey)) return interaction.reply({ content: 'Vous avez déjà signalé cette confession.', ephemeral: true });
      db.set(reportKey, true);
      const reportCount = (db.get(`confess_reportcount_${confessId}`) || 0) + 1;
      db.set(`confess_reportcount_${confessId}`, reportCount);
      const logChan = getLogChannel(guildId, interaction.guild);
      if (logChan) await logChan.send({ content: `🚨 **Signalement** — ${interaction.user.tag} a signalé la confession \`${confessId}\`. Total: ${reportCount}` }).catch(() => {});
      return interaction.reply({ content: '✅ Signalement envoyé aux modérateurs.', ephemeral: true });
    }

    return false;
  }
};
