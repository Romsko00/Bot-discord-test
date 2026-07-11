const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
  name: 'serverinfo',
  aliases: ['si', 'server', 'guildinfo'],
  description: 'Affiche les informations détaillées du serveur',
  usage: '',
  level: 0,
  run: async (client, message) => {
    try {
      const guild = message.guild;
      await guild.members.fetch();

      const members       = guild.members.cache;
      const totalMembers  = members.size;
      const humans        = members.filter(m => !m.user.bot).size;
      const bots          = members.filter(m => m.user.bot).size;
      const online        = members.filter(m => m.presence?.status === 'online').size;

      const channels      = guild.channels.cache;
      const textChannels  = channels.filter(c => c.type === 0).size;
      const voiceChannels = channels.filter(c => c.type === 2).size;
      const categories    = channels.filter(c => c.type === 4).size;

      const roles         = guild.roles.cache.size - 1;
      const emojis        = guild.emojis.cache.size;
      const animatedEmojis= guild.emojis.cache.filter(e => e.animated).size;
      const staticEmojis  = emojis - animatedEmojis;

      const boostLevel    = guild.premiumTier;
      const boostCount    = guild.premiumSubscriptionCount || 0;
      const boostTiers    = { 0: 'Aucun', 1: 'Niveau 1', 2: 'Niveau 2', 3: 'Niveau 3' };

      const verificationLevels = { 0: 'Aucune', 1: 'Faible', 2: 'Moyenne', 3: 'Élevée', 4: 'Très élevée' };

      const featureNames = {
        'COMMUNITY': 'Communauté', 'VERIFIED': 'Vérifié', 'PARTNERED': 'Partenaire',
        'DISCOVERABLE': 'Découvrable', 'VANITY_URL': 'URL Personnalisée',
        'ANIMATED_ICON': 'Icône Animée', 'BANNER': 'Bannière',
        'WELCOME_SCREEN_ENABLED': 'Écran de bienvenue', 'NEWS': 'Annonces'
      };
      const features = guild.features.length > 0
        ? guild.features.slice(0, 5).map(f => featureNames[f] || f).join(', ')
        : 'Aucune';

      const lines = [
        `## ${guild.name}`,
        guild.description ? `*${guild.description}*` : '',
        '',
        '**Informations Générales**',
        `• **Propriétaire :** <@${guild.ownerId}>`,
        `• **ID :** ${guild.id}`,
        `• **Créé :** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
        `• **Région :** ${guild.preferredLocale || 'Non définie'}`,
        '',
        `**Membres (${totalMembers})**`,
        `• Humains : ${humans} | Bots : ${bots} | 🟢 En ligne : ${online}`,
        '',
        `**Salons (${channels.size})**`,
        `• Texte : ${textChannels} | Vocal : ${voiceChannels} | Catégories : ${categories}`,
        '',
        '**Boost**',
        `• Niveau : ${boostTiers[boostLevel]} | Boosts : ${boostCount} | Boosters : ${members.filter(m => m.premiumSince).size}`,
        '',
        '**Contenu**',
        `• Rôles : ${roles} | Emojis : ${emojis} (${staticEmojis} statiques, ${animatedEmojis} animés) | Stickers : ${guild.stickers.cache.size}`,
        '',
        '**Sécurité**',
        `• Vérification : ${verificationLevels[guild.verificationLevel]}`,
        `• Filtre : ${guild.explicitContentFilter === 2 ? 'Maximal' : guild.explicitContentFilter === 1 ? 'Membres sans rôle' : 'Désactivé'}`,
        `• 2FA Requis : ${guild.mfaLevel === 1 ? 'Oui' : 'Non'}`,
      ];

      if (features !== 'Aucune') lines.push('', `**Fonctionnalités**\n• ${features}`);
      if (guild.vanityURLCode) lines.push(`• URL : discord.gg/${guild.vanityURLCode}`);

      lines.push('', `*Créé il y a ${Math.floor((Date.now() - guild.createdTimestamp) / 86400000)} jours*`);

      await message.reply({
        components: [container(txt(lines.filter(l => l !== '').join('\n').replace(/\n{3,}/g, '\n\n')))],
        flags: FLAGS
      });

    } catch (error) {
      await message.reply({
        components: [container(txt('## ❌ Erreur\n\nImpossible de récupérer les informations du serveur.'))],
        flags: FLAGS
      });
    }
  }
};
