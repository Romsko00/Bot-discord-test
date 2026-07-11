const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const Items = require('../../utils/items');
const Casino = require('../../utils/casino');
const db = require('../../utils/simpledb');

const SHOP_ROLE_KEY = (guildId) => `casino_shop_roles_${guildId}`;

module.exports = {
  name: 'cshop',
  aliases: ['shop'],
  description: 'Boutique du casino',
  usage: '+cshop | buy <objet> | info <objet> | addrole <@role> <prix> | delrole <@role>',
  category: 'casino',
  run: async (client, message, args) => {
    if (!message.guild) return;
    const sub = (args[0] || '').toLowerCase();
    const uid = message.author.id;
    const guildId = message.guild.id;

    if (!sub) {
      const list = Items.listItems();
      const roleshop = db.get(SHOP_ROLE_KEY(guildId)) || [];
      const itemLines = list.map(it => `• **${it.name}** — ${it.price} JTN\n  *${it.desc || ''}*`);
      const roleLines = roleshop.map(r => { const role = message.guild.roles.cache.get(r.id); return role ? `• ${role.name} (\`${role.id}\`) — ${r.price} JTN` : null; }).filter(Boolean);
      const content = [...itemLines, ...(roleLines.length ? ['', '**Rôles à vendre :**', ...roleLines] : [])].join('\n') || 'La boutique est vide.';
      return reply(message, container(txt('## 🛒 Boutique Casino'), sep(), txt(content)));
    }

    if (sub === 'buy') {
      const name = args.slice(1).join(' ').toLowerCase();
      if (!name) return reply(message, errorContainer('Usage: `+cshop buy <objet/role>`'));
      const roleshop = db.get(SHOP_ROLE_KEY(guildId)) || [];
      const roleEntry = roleshop.find(r => { const role = message.guild.roles.cache.get(r.id); return role && (role.name.toLowerCase() === name || role.id === name); });
      if (roleEntry) {
        const role = message.guild.roles.cache.get(roleEntry.id);
        if (!role) return reply(message, errorContainer('Rôle introuvable.'));
        if (message.member.roles.cache.has(role.id)) return reply(message, errorContainer('Vous avez déjà ce rôle.'));
        if (!Casino.hasEnoughCasino(uid, roleEntry.price)) return reply(message, errorContainer(`Fonds insuffisants. Solde: ${Casino.getCasinoBalance(uid)} JTN`));
        Casino.deductCasinoCredits(uid, roleEntry.price);
        await message.member.roles.add(role.id, 'Achat via le shop casino');
        return reply(message, container(txt('## ✅ Achat de Rôle'), sep(), txt(`Vous avez acheté le rôle **${role.name}** (\`${role.id}\`) pour **${roleEntry.price} JTN**.`)));
      }
      const r = Items.buy(uid, name);
      if (!r.ok) return reply(message, errorContainer(r.error || 'Achat impossible.'));
      return reply(message, container(txt('## ✅ Achat Effectué'), sep(), txt(`Vous avez acheté **${r.item.name}** pour **${r.item.price} JTN**.`)));
    }

    if (sub === 'info') {
      const name = args.slice(1).join(' ').toLowerCase();
      if (!name) return reply(message, errorContainer('Usage: `+cshop info <objet/role>`'));
      const roleshop = db.get(SHOP_ROLE_KEY(guildId)) || [];
      const roleEntry = roleshop.find(r => { const role = message.guild.roles.cache.get(r.id); return role && (role.name.toLowerCase() === name || role.id === name); });
      if (roleEntry) {
        const role = message.guild.roles.cache.get(roleEntry.id);
        return reply(message, container(txt(`## 🎭 ${role ? role.name : 'Rôle'}`), sep(), txt(`Prix: **${roleEntry.price} JTN**`)));
      }
      const it = Items.getItem(name);
      if (!it) return reply(message, errorContainer('Objet ou rôle introuvable.'));
      return reply(message, container(txt(`## 📦 ${it.name}`), sep(), txt([it.desc || '', `Prix: **${it.price} JTN**`].join('\n'))));
    }

    if (sub === 'addrole') {
      if (!message.member.permissions.has('ADMINISTRATOR')) return reply(message, errorContainer('Seuls les administrateurs peuvent ajouter des rôles au shop.'));
      const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
      const price = parseInt(args[2], 10);
      if (!role || isNaN(price) || price < 1) return reply(message, errorContainer('Usage: `+cshop addrole <@role> <prix>`'));
      let roleshop = db.get(SHOP_ROLE_KEY(guildId)) || [];
      if (roleshop.find(r => r.id === role.id)) return reply(message, errorContainer('Ce rôle est déjà en vente.'));
      roleshop.push({ id: role.id, price });
      db.set(SHOP_ROLE_KEY(guildId), roleshop);
      return reply(message, container(txt('## ✅ Rôle Ajouté'), sep(), txt(`Le rôle **${role.name}** (\`${role.id}\`) est en vente pour **${price} JTN**.`)));
    }

    if (sub === 'delrole') {
      if (!message.member.permissions.has('ADMINISTRATOR')) return reply(message, errorContainer('Seuls les administrateurs peuvent retirer des rôles du shop.'));
      const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
      if (!role) return reply(message, errorContainer('Usage: `+cshop delrole <@role>`'));
      let roleshop = db.get(SHOP_ROLE_KEY(guildId)) || [];
      roleshop = roleshop.filter(r => r.id !== role.id);
      db.set(SHOP_ROLE_KEY(guildId), roleshop);
      return reply(message, container(txt('## ✅ Rôle Retiré'), sep(), txt(`Le rôle **${role.name}** (\`${role.id}\`) n'est plus en vente.`)));
    }

    return reply(message, container(txt('## ℹ️ Aide — Boutique'), sep(), txt(['`+cshop` — Voir la liste', '`+cshop buy <objet/role>` — Acheter', '`+cshop info <objet/role>` — Détails', '`+cshop addrole <@role> <prix>` — Ajouter un rôle (admin)', '`+cshop delrole <@role>` — Retirer un rôle (admin)'].join('\n'))));
  }
};
