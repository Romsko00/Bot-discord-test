const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, FLAGS } = require('../../utils/v2');
const Skins = require('../../utils/skins');

const SKIN_LIST = [
  { id: 'anime', name: '🎴 Anime', desc: 'Slots thème anime' },
  { id: 'cyber', name: '⚡ Cyberpunk', desc: 'Slots thème cyberpunk' },
  { id: 'fantasy', name: '🐉 Fantasy', desc: 'Slots thème fantasy' }
];

module.exports = {
  name: 'cskins',
  aliases: ['skins', 'skin'],
  description: 'Gère et équipe tes skins de jeux casino',
  usage: '+cskins',
  category: 'casino',
  run: async (client, message, args) => {
    const userId = message.author.id;
    const owned = Skins.getSkins(userId);
    const equipped = Skins.getEquippedSkin(userId);
    const skinLines = SKIN_LIST.map(s => `${s.name}${equipped === s.id ? ' **(équipé)**' : ''} — ${s.desc} — ${owned.includes(s.id) ? '✅ Débloqué' : '❌ Verrouillé'}`);
    const row = new ActionRowBuilder().addComponents(
      SKIN_LIST.map(s => new ButtonBuilder().setCustomId(`skin_equip_${s.id}`).setLabel(`Équiper ${s.name}`).setStyle(ButtonStyle.Primary).setDisabled(!owned.includes(s.id) || equipped === s.id))
    );
    const sent = await message.channel.send({ components: [container(txt('## 🎨 Skins Casino'), sep(), txt(skinLines.join('\n'))), row], flags: FLAGS });
    const collector = sent.createMessageComponentCollector({ time: 30000 });
    collector.on('collect', async i => {
      if (i.user.id !== userId) return i.reply({ content: 'Ce n\'est pas ton inventaire !', ephemeral: true });
      const skinId = i.customId.replace('skin_equip_', '');
      Skins.equipSkin(userId, skinId);
      return i.reply({ content: `Skin **${SKIN_LIST.find(s => s.id === skinId)?.name}** équipé !`, ephemeral: true });
    });
  }
};
