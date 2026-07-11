const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const fs = require('fs'), path = require('path');
const CONFIG_PATH = path.join(process.cwd(), 'config.json');

function isSuperAdmin(client, userId) { return Array.isArray(client.config?.superadmin) && client.config.superadmin.includes(userId); }
function saveConfig(config) { try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8'); } catch {} }

module.exports = {
  name: 'superadmin',
  aliases: ['sadmin', 'sa'],
  description: 'Gère les superadmins du bot',
  usage: '[@user | remove @user | list]',
  category: 'bot',
  level: 9,
  run: async (client, message, args) => {
    if (!isSuperAdmin(client, message.author.id)) return reply(message, errorContainer('**Permission insuffisante** — Superadmin requis.'));
    const sub = args[0]?.toLowerCase();

    const { row: vrow, btn, ButtonStyle } = require('../../utils/v2');

    const syncAllClients = (list) => {
      if (Array.isArray(globalThis.allClients)) globalThis.allClients.forEach(c => { if (c.config) c.config.superadmin = list; });
    };

    const removeFromConfig = (userId) => {
      try {
        const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        if (Array.isArray(raw.superadmin)) raw.superadmin = raw.superadmin.filter(id => id !== userId);
        saveConfig(raw);
        syncAllClients(raw.superadmin || []);
        client.config.superadmin = raw.superadmin || [];
      } catch (e) { throw new Error(`Sauvegarde échouée : ${e.message}`); }
    };

    const addToConfig = (userId) => {
      try {
        const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        if (!Array.isArray(raw.superadmin)) raw.superadmin = [];
        if (!raw.superadmin.includes(userId)) raw.superadmin.push(userId);
        saveConfig(raw);
        syncAllClients(raw.superadmin);
        client.config.superadmin = raw.superadmin;
      } catch (e) { throw new Error(`Sauvegarde échouée : ${e.message}`); }
    };

    if (sub === 'remove' || sub === 'retirer' || sub === 'del') {
      const target = message.mentions.users.first() || (args[1] && /^\d{17,20}$/.test(args[1]) && await client.users.fetch(args[1]).catch(() => null));
      if (!target) return reply(message, errorContainer('**Utilisateur introuvable.**'));
      if (target.id === message.author.id) return reply(message, errorContainer('Vous ne pouvez pas vous retirer vous-même.'));
      if (!client.config.superadmin?.includes(target.id)) return reply(message, errorContainer(`**${target.tag}** n'est pas superadmin.`));
      try { removeFromConfig(target.id); } catch (e) { return reply(message, errorContainer(e.message)); }
      return reply(message, container(txt('## 👑 SuperAdmin Retiré'), sep(), txt([`**Utilisateur :** ${target.tag} (\`${target.id}\`)`, `**Retiré par :** ${message.author.tag}`].join('\n'))));
    }

    if (sub === 'add') {
      const target = message.mentions.users.first() || (args[1] && /^\d{17,20}$/.test(args[1]) && await client.users.fetch(args[1]).catch(() => null));
      if (!target) return reply(message, errorContainer('**Usage :** `!superadmin add @user`'));
      if (target.bot) return reply(message, errorContainer('Impossible d\'ajouter un bot comme superadmin.'));
      if (client.config.superadmin?.includes(target.id)) return reply(message, errorContainer(`**${target.tag}** est déjà superadmin.`));
      try { addToConfig(target.id); } catch (e) { return reply(message, errorContainer(e.message)); }
      return reply(message, container(txt('## 👑 Nouveau SuperAdmin'), sep(), txt([`**Utilisateur :** ${target.tag} (\`${target.id}\`)`, `**Ajouté par :** ${message.author.tag}`, `**Total superadmins :** ${client.config.superadmin.length}`].join('\n'))));
    }

    const PAGE_SIZE = 5;
    let page = 0;
    const getSAList = () => client.config.superadmin || [];

    const buildPage = (p) => {
      const list = getSAList();
      const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
      const slice = list.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);

      const comps = [
        txt('## 👑 SuperAdmins'),
        txt(`Page ${p + 1}/${totalPages} • **${list.length}** SuperAdmin${list.length > 1 ? 's' : ''}`),
        sep()
      ];

      slice.forEach((id, i) => {
        const idx = p * PAGE_SIZE + i;
        const addedDate = idx === 0 ? 'Fondateur' : `Entrée ${idx + 1}`;
        comps.push(txt(`**${idx + 1}.** <@${id}> (ID: ${id}) — ${addedDate}`));
        comps.push(vrow(btn(`sa_remove_${id}`, 'Retirer', ButtonStyle.Danger)));
        comps.push(sep());
      });

      if (list.length === 0) comps.push(txt('*Aucun superadmin enregistré.*'));

      const navBtns = [
        btn('sa_prev', '‹', ButtonStyle.Secondary, null, p === 0),
        btn('sa_pageinfo', `${p + 1}/${totalPages}`, ButtonStyle.Secondary, null, true),
        btn('sa_next', '›', ButtonStyle.Secondary, null, p >= totalPages - 1),
        btn('sa_add', '+ Ajouter un SA', ButtonStyle.Success)
      ];
      comps.push(vrow(...navBtns));

      return container(...comps);
    };

    const sent = await reply(message, buildPage(page));
    const collector = sent.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300000 });

    collector.on('collect', async i => {
      if (i.customId === 'sa_prev') { page = Math.max(0, page - 1); return i.update({ components: [buildPage(page)], flags: require('../../utils/v2').FLAGS }); }
      if (i.customId === 'sa_next') { page = Math.min(Math.ceil(getSAList().length / PAGE_SIZE) - 1, page + 1); return i.update({ components: [buildPage(page)], flags: require('../../utils/v2').FLAGS }); }

      if (i.customId === 'sa_add') {
        return i.reply({ content: '**Ajouter un SuperAdmin :** Utilisez `!superadmin add @user`', ephemeral: true });
      }

      if (i.customId.startsWith('sa_remove_')) {
        const uid = i.customId.replace('sa_remove_', '');
        if (uid === message.author.id) return i.reply({ content: 'Vous ne pouvez pas vous retirer vous-même.', ephemeral: true });
        try { removeFromConfig(uid); } catch (e) { return i.reply({ content: `❌ ${e.message}`, ephemeral: true }); }
        page = Math.min(page, Math.max(0, Math.ceil(getSAList().length / PAGE_SIZE) - 1));
        return i.update({ components: [buildPage(page)], flags: require('../../utils/v2').FLAGS });
      }
    });

    collector.on('end', () => sent.edit({ components: [buildPage(page)], flags: require('../../utils/v2').FLAGS }).catch(() => {}));
    return;
  }
};
