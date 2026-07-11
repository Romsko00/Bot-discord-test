const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, FLAGS } = require('../../utils/v2');
const Guilds = require('../../utils/guilds');

module.exports = {
  name: 'cguild',
  aliases: ['guild', 'guilde'],
  description: 'Gestion avancée de ta guilde casino',
  usage: '+cguild',
  category: 'casino',
  run: async (client, message) => {
    const guildId = message.guild.id;
    const data = Guilds.getGuildData(guildId);
    const quests = (data.quests && data.quests.length > 0) ? data.quests.map(q => `• ${q.name} (${q.progress}/${q.goal})`).join('\n') : 'Aucune quête active.';
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('guild_join').setLabel('👥 Rejoindre').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('guild_quest').setLabel('📋 Ajouter Quête').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('guild_war').setLabel('⚔️ Déclarer Guerre').setStyle(ButtonStyle.Danger)
    );
    const sent = await message.channel.send({ components: [container(txt('## 👥 Guilde Casino'), sep(), txt([`**Niveau :** ${data.level} | **XP :** ${data.xp} | **Membres :** ${data.members.length}`, '', '**Quêtes :**', quests].join('\n'))), row], flags: FLAGS });
    const collector = sent.createMessageComponentCollector({ time: 30000 });
    collector.on('collect', async i => {
      if (i.customId === 'guild_join') { Guilds.addMember(guildId, i.user.id); return i.reply({ content: '✅ Tu as rejoint la guilde !', ephemeral: true }); }
      if (i.customId === 'guild_quest') { Guilds.addQuest(guildId, { name: 'Gagner 10k JTN', progress: 0, goal: 10000 }); return i.reply({ content: '✅ Quête ajoutée !', ephemeral: true }); }
      if (i.customId === 'guild_war') { Guilds.startWar(guildId, 'opponent_guild_id'); return i.reply({ content: '⚔️ Guerre lancée !', ephemeral: true }); }
    });
  }
};
