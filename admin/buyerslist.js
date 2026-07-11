const fs = require('fs');
const path = require('path');
const { container, txt, sep, section, row, btn, reply, errorContainer, FLAGS, ButtonStyle } = require('../../utils/v2');
const { loadExpirations } = require('../../utils/buyerExpirationChecker');

module.exports = {
  name: 'buyerslist',
  aliases: ['listbuyers', 'buyers'],
  description: 'Liste tous les buyers et l\'état de leurs bots',
  category: 'admin',
  level: 9,
  run: async (client, message) => {
    if (!client.config.superadmin || !client.config.superadmin.includes(message.author.id)) {
      return reply(message, errorContainer('**Permission insuffisante** — Superadmin requis.'));
    }

    const buyersPath = path.resolve(__dirname, '../../data/buyers.json');
    let buyers = {};
    try {
      if (fs.existsSync(buyersPath)) buyers = JSON.parse(fs.readFileSync(buyersPath, 'utf8')) || {};
    } catch { return reply(message, errorContainer('Impossible de lire `buyers.json`')); }

    const allClients = globalThis.allClients && Array.isArray(globalThis.allClients) ? globalThis.allClients : [client];
    const buyerEntries = Object.entries(buyers);

    if (buyerEntries.length === 0) {
      return reply(message, container(
        txt('## 👥 Liste des Buyers'),
        sep(),
        txt('Aucun buyer enregistré dans le système.')
      ));
    }

    let expirations = {};
    try { expirations = loadExpirations() || {}; } catch {}

    const PAGE_SIZE = 4;
    let page = 0;
    const totalPages = Math.ceil(buyerEntries.length / PAGE_SIZE);

    let totalTokens = 0, onlineCount = 0;
    const buyerData = buyerEntries.map(([userId, entry], index) => {
      const tokens = Array.isArray(entry) ? entry : [entry];
      totalTokens += tokens.length;
      const botClient = allClients.find(c => tokens.includes(c.botToken));
      const online = !!(botClient && botClient.user);
      if (online) onlineCount++;
      const botTag = botClient?.user?.tag || 'Bot hors ligne';

      let daysLeft = null;
      let expireStr = 'Permanent';
      for (const tkn of tokens) {
        const exp = expirations[tkn];
        if (exp?.expiresAt) {
          const days = Math.ceil((exp.expiresAt - Date.now()) / 86400000);
          daysLeft = days;
          expireStr = days > 0 ? `Expire : <t:${Math.floor(exp.expiresAt / 1000)}:d> • ${days} jours restants` : '⚠️ Expiré';
          break;
        }
      }

      return { userId, tokens, botTag, online, expireStr, daysLeft, index };
    });

    const buildPage = (p) => {
      const slice = buyerData.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
      const components = [
        txt(`## 👥 Liste des Buyers`),
        txt(`Page ${p + 1}/${totalPages} • **${buyerEntries.length}** buyer${buyerEntries.length > 1 ? 's' : ''} • **${onlineCount}** en ligne`),
        sep()
      ];

      for (const b of slice) {
        const statusIcon = b.online ? '🟢' : '🔴';
        const statusLabel = b.online ? 'En ligne' : 'Hors ligne';
        components.push(section(
          `**${b.index + 1}. <@${b.userId}>**\nBot : ${b.botTag} • ${b.expireStr}\nStatut : ${statusIcon} ${statusLabel}`,
          btn(`bl_opt_${b.userId}`, 'Options', ButtonStyle.Primary)
        ));
        components.push(sep());
      }

      if (totalPages > 1) {
        components.push(row(
          btn('bl_prev', '‹', ButtonStyle.Secondary, null, p === 0),
          btn('bl_pageinfo', `Page ${p + 1}/${totalPages}`, ButtonStyle.Secondary, null, true),
          btn('bl_next', '›', ButtonStyle.Secondary, null, p === totalPages - 1)
        ));
      }

      return container(...components);
    };

    const buildOptions = (b) => container(
      txt(`## ⚙️ Options — <@${b.userId}>`),
      sep(),
      txt([
        `**Bot :** ${b.botTag}`,
        `**Statut :** ${b.online ? '🟢 En ligne' : '🔴 Hors ligne'}`,
        `**Expiration :** ${b.expireStr}`
      ].join('\n')),
      sep(),
      row(
        btn(`bl_revoke_${b.userId}`, '🗑️ Révoquer', ButtonStyle.Danger),
        btn('bl_back', '↩️ Retour', ButtonStyle.Secondary)
      )
    );

    const sent = await reply(message, buildPage(0));

    const collector = sent.createMessageComponentCollector({
      filter: i => i.user.id === message.author.id,
      time: 300000
    });

    collector.on('collect', async i => {
      if (i.customId === 'bl_prev') { page = Math.max(0, page - 1); return i.update({ components: [buildPage(page)], flags: FLAGS }); }
      if (i.customId === 'bl_next') { page = Math.min(totalPages - 1, page + 1); return i.update({ components: [buildPage(page)], flags: FLAGS }); }
      if (i.customId === 'bl_back') { return i.update({ components: [buildPage(page)], flags: FLAGS }); }

      if (i.customId.startsWith('bl_opt_')) {
        const uid = i.customId.replace('bl_opt_', '');
        const b = buyerData.find(x => x.userId === uid);
        if (!b) return i.update({ components: [errorContainer('Buyer introuvable.')], flags: FLAGS });
        return i.update({ components: [buildOptions(b)], flags: FLAGS });
      }

      if (i.customId.startsWith('bl_revoke_')) {
        const uid = i.customId.replace('bl_revoke_', '');
        return i.update({
          components: [container(
            txt(`## ⚠️ Révoquer <@${uid}>`),
            sep(),
            txt('Confirmer la révocation de ce buyer ? Son bot sera déconnecté.'),
            sep(),
            row(
              btn(`bl_revoke_confirm_${uid}`, 'Confirmer', ButtonStyle.Danger),
              btn('bl_back', 'Annuler', ButtonStyle.Secondary)
            )
          )],
          flags: FLAGS
        });
      }

      if (i.customId.startsWith('bl_revoke_confirm_')) {
        const uid = i.customId.replace('bl_revoke_confirm_', '');
        try {
          const content = fs.existsSync(buyersPath) ? JSON.parse(fs.readFileSync(buyersPath, 'utf8')) : {};
          delete content[uid];
          fs.writeFileSync(buyersPath, JSON.stringify(content, null, 2), 'utf8');
          const idx = buyerData.findIndex(x => x.userId === uid);
          if (idx !== -1) buyerData.splice(idx, 1);
        } catch {}
        return i.update({
          components: [container(
            txt('## ✅ Buyer révoqué'),
            sep(),
            txt(`<@${uid}> a été retiré de la liste des buyers.`)
          )],
          flags: FLAGS
        });
      }
    });

    collector.on('end', () => sent.edit({ components: [buildPage(page)], flags: FLAGS }).catch(() => {}));
  }
};
