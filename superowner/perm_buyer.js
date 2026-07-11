const { container, txt, sep, reply, errorContainer, row, btn, ButtonStyle } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
    name: 'perm_buyer',
    aliases: ['permbuyer', 'delpermbuyer', 'clearpermbuyers'],
    description: 'Gère les buyers (ajouter / retirer / vider)',
    category: 'superowner',
    level: 9,
    run: async (client, message, args) => {
        const isSuper = client.config.superadmin?.includes(message.author.id);
        if (!isSuper) return reply(message, errorContainer('**Permission insuffisante** — Superadmin requis.'));

        const prefix = client.config.prefix || '+';
        const rawCmd = message.content.trim().split(/\s+/)[0].slice(prefix.length).toLowerCase();

        const showUsage = () => reply(message, container(
            txt('## 🛡️ Gestion des Buyers'),
            sep(),
            txt([
                `**Ajouter un buyer :**\n\`${prefix}permbuyer <here|all> <@user>\``,
                `**Retirer un buyer :**\n\`${prefix}delpermbuyer <here|all> <@user>\``,
                `**Vider les buyers :**\n\`${prefix}clearpermbuyers <here|all>\``,
                '',
                '**Portée :**',
                '• `here` — Limité à ce serveur',
                '• `all` — Global (tous les serveurs)',
            ].join('\n'))
        ));

        if (rawCmd === 'clearpermbuyers') {
            const type = args[0];
            if (!['here', 'all'].includes(type)) return reply(message, errorContainer('**Usage :** `' + prefix + 'clearpermbuyers <here|all>`'));
            const pfx = type === 'all' ? 'buyer_global_' : `buyer_${message.guild.id}_`;
            const keys = db.all().filter(d => d.ID.startsWith(pfx));
            keys.forEach(k => db.delete(k.ID));
            return reply(message, container(
                txt('## ✅ Buyers Supprimés'),
                sep(),
                txt(`**${keys.length}** buyer${keys.length > 1 ? 's' : ''} supprimé${keys.length > 1 ? 's' : ''}\n**Portée :** ${type === 'all' ? 'Globale' : 'Locale (ce serveur)'}`)
            ));
        }

        if (rawCmd === 'perm_buyer') {
            return showUsage();
        }

        const type   = args[0];
        const target = message.mentions.users.first() || client.users.cache.get(args[1]);

        if (!target || !['here', 'all'].includes(type)) {
            return reply(message, errorContainer(
                `**Usage :** \`${prefix}permbuyer <here|all> <@user>\`\nou \`${prefix}delpermbuyer <here|all> <@user>\``
            ));
        }

        const key = type === 'all' ? `buyer_global_${target.id}` : `buyer_${message.guild.id}_${target.id}`;
        const scopeLabel = type === 'all' ? '🌍 Globale (tous serveurs)' : '🏠 Locale (ce serveur)';

        if (rawCmd === 'permbuyer') {
            db.set(key, true);
            return reply(message, container(
                txt('## ✅ Buyer Ajouté'),
                sep(),
                txt([
                    `**Utilisateur :** ${target.tag} (\`${target.id}\`)`,
                    `**Portée :** ${scopeLabel}`,
                    `**Clé DB :** \`${key}\``
                ].join('\n'))
            ));
        }

        if (rawCmd === 'delpermbuyer') {
            const existed = db.get(key);
            db.delete(key);
            return reply(message, container(
                txt(`## ${existed ? '✅ Buyer Retiré' : '⚠️ Buyer Non Trouvé'}`),
                sep(),
                txt([
                    `**Utilisateur :** ${target.tag} (\`${target.id}\`)`,
                    `**Portée :** ${scopeLabel}`,
                    existed ? '**Statut :** Buyer supprimé avec succès.' : '**Statut :** Cet utilisateur n\'était pas buyer avec cette portée.'
                ].join('\n'))
            ));
        }

        return showUsage();
    }
};
