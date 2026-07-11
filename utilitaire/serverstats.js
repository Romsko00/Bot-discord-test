const { ChannelType } = require('discord.js');
const db = require('../../utils/simpledb');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'serverstats',
  aliases: ['stats', 'serverinfo'],
  description: 'Statistiques du serveur',
  level: 0,
  run: async (client, message, args, prefix) => {
    let perm = false;
    message.member.roles.cache.forEach((role) => {
      if (db.get(`modsp_${message.guild.id}_${role.id}`)) perm = true;
      if (db.get(`admin_${message.guild.id}_${role.id}`)) perm = true;
      if (db.get(`ownerp_${message.guild.id}_${role.id}`)) perm = true;
    });

    if (!perm && !(client.config.superadmin && client.config.superadmin.includes(message.author.id)) && !(client.config.owners && client.config.owners.includes(message.author.id)) && !db.get(`ownermd_${client.user.id}_${message.author.id}`) && !db.get(`channelpublic_${message.guild.id}_${message.channel.id}`)) {
      return message.reply({
        components: [container(txt('## ❌ Permission refusée\n\nPermissions insuffisantes.'))],
        flags: FLAGS
      });
    }

    const loading = await message.reply({
      components: [container(txt('## 📊 Statistiques du Serveur\n\n⏳ Calcul des statistiques en cours...'))],
      flags: FLAGS
    });

    try {
      const guild = message.guild;
      await guild.members.fetch();
      await guild.channels.fetch();

      const totalMembers = guild.memberCount;
      const bots    = guild.members.cache.filter((m) => m.user.bot).size;
      const humans  = totalMembers - bots;
      const online  = guild.members.cache.filter((m) => m.presence?.status === 'online').size;
      const idle    = guild.members.cache.filter((m) => m.presence?.status === 'idle').size;
      const offline = guild.members.cache.filter((m) => !m.presence || m.presence.status === 'offline').size;

      const channels      = guild.channels.cache;
      const textChannels  = channels.filter((c) => c.type === ChannelType.GuildText).size;
      const voiceChannels = channels.filter((c) => c.type === ChannelType.GuildVoice).size;
      const cats          = channels.filter((c) => c.type === ChannelType.GuildCategory).size;

      const roles      = guild.roles.cache.size;
      const boostLevel = guild.premiumTier;
      const boosts     = guild.premiumSubscriptionCount;
      const createdAt  = guild.createdAt;
      const owner      = await guild.fetchOwner();

      const lines = [
        `## 📊 Statistiques — ${guild.name}`,
        '',
        '**Membres**',
        `• Total : ${totalMembers} | Humains : ${humans} | Bots : ${bots}`,
        '',
        '**Statuts**',
        `• 🟢 En ligne : ${online} | 🌙 Absents : ${idle} | ⚫ Hors ligne : ${offline}`,
        '',
        '**Salons**',
        `• Textuels : ${textChannels} | Vocaux : ${voiceChannels} | Catégories : ${cats}`,
        '',
        '**Rôles**',
        `• ${roles} rôles`,
        '',
        '**Boosts**',
        `• Niveau ${boostLevel} | ${boosts} boosts`,
        '',
        '**Propriétaire**',
        `• ${owner.user.tag}`,
        '',
        '**Création**',
        `• <t:${Math.floor(createdAt.getTime() / 1000)}:R>`,
        '',
        `**ID Serveur :** \`${guild.id}\``
      ];

      await loading.edit({
        components: [container(txt(lines.join('\n')))],
        flags: FLAGS
      });

    } catch (error) {
      console.error('Server stats error:', error);
      await message.reply({
        components: [container(txt('## ❌ Erreur\n\nImpossible de générer les statistiques.'))],
        flags: FLAGS
      });
    }
  }
};
