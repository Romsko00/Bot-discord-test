const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { container, txt, sep, row, btn, linkBtn, reply, errorContainer, paginationRow, FLAGS, ButtonStyle } = require('../../utils/v2');
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const EXPIRATIONS_PATH = path.join(__dirname, '../../data/buyer_expirations.json');
const RECOVERY_PATH    = path.join(__dirname, '../../data/recovery_keys.json');
const PER_PAGE = 3, TIMEOUT = 180_000;

function loadBuyers() { try { const p = path.join(__dirname, '../../data/buyers.json'); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) || {} : {}; } catch { return {}; } }
function saveBuyers(b) { try { fs.writeFileSync(path.join(__dirname, '../../data/buyers.json'), JSON.stringify(b, null, 2), 'utf8'); } catch {} }
function loadExpirations() { try { return fs.existsSync(EXPIRATIONS_PATH) ? JSON.parse(fs.readFileSync(EXPIRATIONS_PATH, 'utf8')) || {} : {}; } catch { return {}; } }
function loadRecoveryKeys() { try { return fs.existsSync(RECOVERY_PATH) ? JSON.parse(fs.readFileSync(RECOVERY_PATH, 'utf8')) || {} : {}; } catch { return {}; } }
function saveRecoveryKeys(d) { try { const dir = path.dirname(RECOVERY_PATH); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(RECOVERY_PATH, JSON.stringify(d, null, 2), 'utf8'); } catch {} }
function getDaysRemaining(token) { const e = loadExpirations()[token]; if (!e?.expiresAt) return null; const diff = e.expiresAt - Date.now(); return diff <= 0 ? 0 : Math.ceil(diff / 86400000); }
function getOwnedClients(userId) { const buyers = loadBuyers(), raw = buyers[userId]; if (!raw) return []; const tokens = Array.isArray(raw) ? raw : [raw]; const all = globalThis.allClients || []; return tokens.map(tkn => ({ token: tkn, client: all.find(c => c.botToken === tkn) || null })); }
function isOnline(b) { return !!(b.client?.readyAt); }
function inviteUrl(id) { return `https://discord.com/oauth2/authorize?client_id=${id}&permissions=8&scope=bot+applications.commands`; }
function daysStr(token) { const d = getDaysRemaining(token); if (d === null) return 'Permanent'; if (d === 0) return '🔴 Expiré'; return `✅ ${d} jour${d !== 1 ? 's' : ''} restants`; }
function generateRecoveryKey() { return crypto.randomBytes(16).toString('hex').toUpperCase().match(/.{4}/g).join('-'); }

module.exports = {
  name: 'mybots',
  aliases: ['mesbots', 'botsbuyer'],
  description: 'Gérez vos bots achetés',
  category: 'bot',
  level: 8,

  run: async (client, message) => {
    const buyers = loadBuyers();
    if (!buyers[message.author.id]) return reply(message, errorContainer('Cette commande est réservée aux **acheteurs**.'));
    const userId = message.author.id;
    let bots = getOwnedClients(userId);
    if (!bots.length) return reply(message, container(txt('## 🤖 Mes Bots'), sep(), txt('Aucun bot lié à votre compte.')));

    let page = 1;
    const totalPages = () => Math.max(1, Math.ceil(bots.length / PER_PAGE));

    const buildListPage = (p) => {
      const total = totalPages(), slice = bots.slice((p - 1) * PER_PAGE, p * PER_PAGE);
      const comps = [
        txt(`## 🤖 Mes Bots`),
        sep()
      ];

      slice.forEach((b, i) => {
        const gIdx = (p - 1) * PER_PAGE + i;
        const name = b.client?.user?.username || 'Bot hors ligne';
        const dot = isOnline(b) ? '🟢' : '🔴';
        const statusLabel = isOnline(b) ? 'En ligne' : 'Hors ligne';
        const botId = b.client?.user?.id;
        const exp = daysStr(b.token);

        comps.push(txt(`**${gIdx + 1}. ${name}** — ${exp}`));
        comps.push(txt(`Statut : ${dot} ${statusLabel}${botId ? ` | ID : \`${botId}\`` : ''}`));

        const rowBtns = [btn(`mb_select_${gIdx}`, '+ Plus d\'options', ButtonStyle.Secondary)];
        if (botId) rowBtns.push(linkBtn(inviteUrl(botId), 'Inviter 🔗'));
        comps.push(row(...rowBtns));
        comps.push(sep());
      });

      const db = require('../../utils/simpledb');
      const reviewKey = `mybots_review_${userId}_${client.user.id}`;
      const alreadyReviewed = db.get(reviewKey);

      const bottomBtns = [btn('mb_review', alreadyReviewed ? '⭐ Avis donné — Merci !' : '⭐ Je donne mon avis et je gagne 2 crédits', ButtonStyle.Success, null, !!alreadyReviewed)];
      comps.push(row(...bottomBtns));

      if (total > 1) {
        comps.push(paginationRow(p, total, 'mb_prev', 'mb_next', [btn('mb_refresh', '↺ Actualiser', ButtonStyle.Secondary)]));
      }

      return container(...comps);
    };

    const sent = await reply(message, buildListPage(page));

    const collector = sent.createMessageComponentCollector({ filter: i => i.user.id === userId, time: TIMEOUT });

    collector.on('collect', async interaction => {
      const id = interaction.customId;

      if (id === 'mb_review') {
        const db = require('../../utils/simpledb');
        const reviewKey = `mybots_review_${userId}_${client.user.id}`;
        if (db.get(reviewKey)) return interaction.reply({ content: '⭐ Vous avez déjà donné votre avis, merci !', ephemeral: true });
        db.set(reviewKey, true);
        const credKey = `credits_${message.guild?.id}_${userId}`;
        db.set(credKey, (db.get(credKey) || 0) + 2);
        await interaction.reply({ content: '⭐ Merci ! **+2 crédits** ajoutés.', ephemeral: true });
        await interaction.message.edit({ components: [buildListPage(page)], flags: FLAGS }).catch(() => {});
        return;
      }

      if (id === 'mb_prev') { page = Math.max(1, page - 1); await interaction.update({ components: [buildListPage(page)], flags: FLAGS }); return; }
      if (id === 'mb_next') { page = Math.min(totalPages(), page + 1); await interaction.update({ components: [buildListPage(page)], flags: FLAGS }); return; }
      if (id === 'mb_refresh') { bots = getOwnedClients(userId); await interaction.update({ components: [buildListPage(page)], flags: FLAGS }); return; }

      if (id.startsWith('mb_select_')) {
        const botIdx = parseInt(id.split('_')[2]);
        const b = bots[botIdx];
        if (!b) return interaction.deferUpdate();
        const name = b.client?.user?.username || 'Bot hors ligne';
        const dot = isOnline(b) ? '🟢' : '🔴';
        const botId = b.client?.user?.id;

        const manageC = container(
          txt(`## 🤖 ${name}`),
          sep(),
          txt([
            `**Statut :** ${dot} ${isOnline(b) ? 'En ligne' : 'Hors ligne'}`,
            `**Expiration :** ${daysStr(b.token)}`,
            botId ? `**ID :** \`${botId}\`` : ''
          ].filter(Boolean).join('\n')),
          sep(),
          txt('**Gestion du bot**'),
          row(
            btn(`mb_start_${botIdx}`, '▶ Démarrer', ButtonStyle.Success, null, isOnline(b)),
            btn(`mb_restart_${botIdx}`, '↺ Redémarrer', ButtonStyle.Primary, null, !isOnline(b)),
            btn(`mb_stop_${botIdx}`, '⏹ Arrêter', ButtonStyle.Danger, null, !isOnline(b))
          ),
          sep(),
          txt('**Modifier le bot**'),
          row(
            btn(`mb_edittoken_${botIdx}`, '⚙️ Modifier token', ButtonStyle.Secondary),
            ...(botId ? [linkBtn(inviteUrl(botId), 'Inviter 🔗')] : [])
          ),
          sep(),
          txt('**Maintenance**'),
          row(
            btn(`mb_viewkey_${botIdx}`, '🔑 Consulter clé', ButtonStyle.Secondary),
            btn(`mb_regenkey_${botIdx}`, '⚠️ Régénérer clé', ButtonStyle.Secondary),
            btn('mb_back', '↩ Retour', ButtonStyle.Secondary)
          )
        );
        await interaction.update({ components: [manageC], flags: FLAGS });
        return;
      }

      if (id === 'mb_back') {
        bots = getOwnedClients(userId);
        await interaction.update({ components: [buildListPage(page)], flags: FLAGS });
        return;
      }

      if (id.startsWith('mb_start_')) {
        await interaction.deferUpdate().catch(() => {});
        await interaction.followUp({ content: '▶ Démarrage en cours...', ephemeral: true });
        return;
      }

      if (id.startsWith('mb_restart_')) {
        const botIdx = parseInt(id.split('_')[2]);
        const b = bots[botIdx];
        await interaction.reply({ content: `↺ Redémarrage de **${b?.client?.user?.username || 'bot'}**...`, ephemeral: true });
        return;
      }

      if (id.startsWith('mb_stop_')) {
        const botIdx = parseInt(id.split('_')[2]);
        const b = bots[botIdx];
        await interaction.reply({ content: `⏹ Arrêt de **${b?.client?.user?.username || 'bot'}**...`, ephemeral: true });
        return;
      }

      if (id.startsWith('mb_edittoken_')) {
        const botIdx = parseInt(id.split('_')[2]);
        const modal = new ModalBuilder().setCustomId(`mb_modal_token_${botIdx}`).setTitle('Modifier le token');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('new_token').setLabel('Nouveau token').setStyle(TextInputStyle.Short).setRequired(true)));
        await interaction.showModal(modal);
        try {
          const submit = await interaction.awaitModalSubmit({ filter: i => i.customId === `mb_modal_token_${botIdx}` && i.user.id === userId, time: 120_000 });
          const newToken = submit.fields.getTextInputValue('new_token').trim();
          const buyersData = loadBuyers(), entry = buyersData[userId];
          const b = getOwnedClients(userId)[botIdx];
          if (Array.isArray(entry)) { const i2 = entry.indexOf(b?.token); if (i2 !== -1) entry[i2] = newToken; } else { buyersData[userId] = newToken; }
          saveBuyers(buyersData);
          await submit.reply({ content: '✅ Token mis à jour. Redémarrez le bot.', ephemeral: true });
        } catch {}
        return;
      }

      if (id.startsWith('mb_viewkey_')) {
        const botIdx = parseInt(id.split('_')[2]);
        const b = getOwnedClients(userId)[botIdx];
        const keys = loadRecoveryKeys();
        const key = keys[b?.token] || 'Aucune clé générée.';
        await interaction.reply({ content: `🔑 **Clé de récupération :** \`${key}\``, ephemeral: true });
        return;
      }

      if (id.startsWith('mb_regenkey_')) {
        const botIdx = parseInt(id.split('_')[2]);
        const b = getOwnedClients(userId)[botIdx];
        const keys = loadRecoveryKeys();
        const newKey = generateRecoveryKey();
        if (b?.token) keys[b.token] = newKey;
        saveRecoveryKeys(keys);
        await interaction.reply({ content: `✅ **Nouvelle clé :** \`${newKey}\``, ephemeral: true });
        return;
      }

      await interaction.deferUpdate().catch(() => {});
    });

    collector.on('end', () => sent.edit({ components: [] }).catch(() => {}));
  }
};
