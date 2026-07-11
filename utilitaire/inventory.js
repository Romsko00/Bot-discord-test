const db = require('../../utils/simpledb');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');

const ITEM_MAP = { coin: 'Pièce', gem: 'Gemme', key: 'Clé', potion: 'Potion', weapon: 'Arme', armor: 'Armure', food: 'Nourriture', material: 'Matériau', tool: 'Outil', quest_item: 'Objet de quête', rare_item: 'Objet rare', legendary_item: 'Objet légendaire' };
const EMOJI_MAP = { coin: '🪙', gem: '💎', key: '🔑', potion: '🧪', weapon: '⚔️', armor: '<:_:1483497431135162539>', food: '🍎', material: '📦', tool: '🛠️', quest_item: '<:_:1483497414575915268>', rare_item: '✨', legendary_item: '🌟' };
function formatItemName(n) { return ITEM_MAP[n] || n.charAt(0).toUpperCase() + n.slice(1); }
function getItemEmoji(n) { return EMOJI_MAP[n] || '📦'; }

module.exports = {
  name: 'inventory', description: 'Afficher votre inventaire', usage: 'inventory [@user]',
  category: 'coins', aliases: ['inv', 'bag', 'inventaire'],
  clientPermissions: ['EmbedLinks'], userPermissions: [], cooldown: 4, coinsOnly: true,

  run: async (client, message, args) => {
    try {
      let targetUser = message.author, targetMember = message.member;
      if (args[0]) { const u = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null); if (u) { targetUser = u; targetMember = await message.guild.members.fetch(u.id).catch(() => null); } }
      const inv = db.get(`inventory_${message.guild.id}_${targetUser.id}`) || [];
      const formattedInv = inv.length ? inv.map((item, i) => `**${i + 1}.** ${getItemEmoji(item.item)} **${formatItemName(item.item)}** • x\`${item.amount}\``).join('\n') : '📦 Inventaire vide';
      const total = inv.reduce((s, i) => s + i.amount, 0);
      const lines = [formattedInv];
      if (inv.length > 0) lines.push(`\n**Total d'objets :** ${total} • **Types :** ${inv.length}`);
      await reply(message, container(
        txt(`## 🎒 Inventaire de ${targetUser.username}`),
        sep(),
        txt(lines.join('\n'))
      ));
    } catch (e) { console.error(e); await reply(message, errorContainer("Erreur lors de l'affichage de l'inventaire.")); }
  }
};

async function addToInventory(client, guildId, userId, itemName, amount = 1) {
  try { let inv = db.get(`inventory_${guildId}_${userId}`) || []; const idx = inv.findIndex(i => i.item === itemName); if (idx !== -1) inv[idx].amount += amount; else inv.push({ item: itemName, amount }); db.set(`inventory_${guildId}_${userId}`, inv); return true; }
  catch { return false; }
}
async function removeFromInventory(client, guildId, userId, itemName, amount = 1) {
  try { let inv = db.get(`inventory_${guildId}_${userId}`) || []; const idx = inv.findIndex(i => i.item === itemName); if (idx !== -1) { if (inv[idx].amount <= amount) inv.splice(idx, 1); else inv[idx].amount -= amount; db.set(`inventory_${guildId}_${userId}`, inv); return true; } return false; }
  catch { return false; }
}
async function getItemQuantity(client, guildId, userId, itemName) { try { const inv = db.get(`inventory_${guildId}_${userId}`) || []; const item = inv.find(i => i.item === itemName); return item ? item.amount : 0; } catch { return 0; } }

module.exports.addToInventory = addToInventory;
module.exports.removeFromInventory = removeFromInventory;
module.exports.getItemQuantity = getItemQuantity;
module.exports.formatItemName = formatItemName;
module.exports.getItemEmoji = getItemEmoji;
