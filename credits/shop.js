const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType } = require('discord.js');
const { container, txt, sep, row, btn, reply, errorContainer, FLAGS, ButtonStyle, formatNumber } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

function getDefaultShopConfig() {
  return { title: '🛒 Boutique', description: 'Configurez votre boutique avec `!shop edit`.', embedColor: '#00ff00', placeholder: 'Choisissez une option', footer: '', products: [] };
}

module.exports = {
  name: 'shop',
  aliases: ['boutique'],
  description: 'Affiche la boutique du serveur',
  usage: '[edit]',
  level: 1,
  run: async (client, message, args, prefix) => {
    let hasPermission = false;
    message.member.roles.cache.forEach(role => {
      if (db.get(`ownerp_${message.guild.id}_${role.id}`)) hasPermission = true;
      if (db.get(`admin_${message.guild.id}_${role.id}`)) hasPermission = true;
    });
    const isAdmin = hasPermission || hasPermissionLevel(client, message, 4);

    if (args[0] === 'edit' && isAdmin) {
      return showShopEditor(client, message, prefix);
    }

    const shopConfig = db.get(`shop_config_${message.guild.id}`) || getDefaultShopConfig();
    if (!shopConfig.products || shopConfig.products.length === 0) {
      return reply(message, container(
        txt(`## ${shopConfig.title || '🛒 Boutique'}`),
        sep(),
        txt('Aucun produit configuré. Utilisez `!shop edit` pour configurer la boutique.')
      ));
    }

    const lines = shopConfig.products.map((p, i) =>
      `**${i + 1}.** ${p.emoji || '📦'} **${p.name}** — ${p.price}\n↳ ${p.description || ''}`
    ).join('\n\n');

    return reply(message, container(
      txt(`## ${shopConfig.title || '🛒 Boutique'}`),
      sep(),
      txt(`${shopConfig.description || ''}\n\n${lines}`)
    ));
  }
};

async function showShopEditor(client, message, prefix) {
  const shopConfig = db.get(`shop_config_${message.guild.id}`) || getDefaultShopConfig();

  const buildEditorContainer = () => container(
    txt('## ⚙️ Éditeur de Boutique'),
    sep(),
    txt([
      `**Produits :** ${shopConfig.products.length}`,
      `**Titre :** ${shopConfig.title || 'Défaut'}`,
      `**Couleur :** ${shopConfig.embedColor || 'Défaut'}`
    ].join('\n'))
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId('shop_editor_menu').setPlaceholder('Options d\'édition')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Ajouter Produit').setValue('add_product').setEmoji('➕'),
      new StringSelectMenuOptionBuilder().setLabel('Supprimer Produit').setValue('delete_product').setEmoji('🗑️'),
      new StringSelectMenuOptionBuilder().setLabel('Configurer Apparence').setValue('configure_appearance').setEmoji('🎨'),
      new StringSelectMenuOptionBuilder().setLabel('Sauvegarder').setValue('save_config').setEmoji('💾')
    );
  const rowMenu = new ActionRowBuilder().addComponents(menu);
  const sentMessage = await message.reply({ components: [buildEditorContainer(), rowMenu], flags: FLAGS });

  const collector = sentMessage.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 300000 });
  collector.on('collect', async interaction => {
    if (interaction.user.id !== message.author.id) return interaction.deferUpdate();
    await interaction.deferUpdate();
    const choice = interaction.values[0];

    if (choice === 'save_config') {
      db.set(`shop_config_${message.guild.id}`, shopConfig);
      await sentMessage.edit({ components: [container(txt('## ✅ Boutique Sauvegardée'), sep(), txt('Configuration mise à jour avec succès.')), rowMenu], flags: FLAGS });
    } else if (choice === 'delete_product') {
      if (!shopConfig.products.length) return;
      shopConfig.products.pop();
      await sentMessage.edit({ components: [buildEditorContainer(), rowMenu], flags: FLAGS });
    } else if (choice === 'configure_appearance') {
      await interaction.followUp({ content: 'Envoyez le nouveau titre de la boutique:', ephemeral: true });
      const resp = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 30000 }).catch(() => null);
      if (resp?.first()) { shopConfig.title = resp.first().content; resp.first().delete().catch(() => {}); }
      await sentMessage.edit({ components: [buildEditorContainer(), rowMenu], flags: FLAGS });
    } else if (choice === 'add_product') {
      await interaction.followUp({ content: 'Envoyez les infos du produit (format: `nom|prix|description`):', ephemeral: true });
      const resp = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 60000 }).catch(() => null);
      if (resp?.first()) {
        const [nom, prix, desc] = resp.first().content.split('|');
        if (nom && prix) shopConfig.products.push({ name: nom.trim(), price: prix.trim(), description: (desc || '').trim(), type: 'credits', visible: true });
        resp.first().delete().catch(() => {});
      }
      await sentMessage.edit({ components: [buildEditorContainer(), rowMenu], flags: FLAGS });
    }
  });
}
