const { ChannelType, AttachmentBuilder, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('../../utils/simpledb');
const admin = require('../../utils/casinoAdmin');
const Casino = require('../../utils/casino');
const Teams = require('../../utils/casinoTeams');
const Jobs = require('../../utils/jobs');
const Items = require('../../utils/items');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const { container, txt, sep, reply, errorContainer, successContainer, FLAGS } = require('../../utils/v2');

const SUBS_ALL = ['help','set','status','clear','setnotify','auditlog','suspend','unsuspend','flag','announce','metrics','simulate','vip','shop','buy','profile','settings','backup','export','grant','take','setbal','wipe','reset','xp','grantall','xpgrantall','logs','config','toggle','chistory','team','job','comp','item','shopadmin'];
const ADMIN_SUBS = ['set','clear','setnotify','auditlog','suspend','announce','metrics','simulate','shop','buy','settings','backup','export','grant','take','setbal','wipe','reset','xp','grantall','xpgrantall','logs','config','toggle','chistory','team','job','comp','item','shopadmin'];

module.exports = {
  name: 'casino',
  aliases: [],
  description: 'Commande principale du système casino',
  usage: '+casino <help|status|set|clear|setnotify|auditlog|suspend|announce|metrics|simulate|grant|take|setbal|wipe|backup|export|job|comp|item|shopadmin|team>',
  category: 'casino',
  run: async (client, message, args) => {
    if (!message.guild) return;
    const sub = (args[0] || '').toLowerCase();
    const isOwner = client.config.owners?.includes(message.author.id);
    const hasManage = hasPermissionLevel(client, message, 6);
    const err = (msg) => reply(message, errorContainer(msg));

    if (!SUBS_ALL.includes(sub)) return err(`Sous-commande inconnue.\nUsage: \`${module.exports.usage}\``);
    if (!isOwner && !hasManage && ADMIN_SUBS.includes(sub)) return err('Permission insuffisante (niveau 6 requis).');

    const guildId = message.guild.id;
    const categoryKey = `casino_category_${guildId}`;

    if (sub === 'help') {
      const dir = path.join(__dirname);
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
      const cmds = [];
      for (const f of files) {
        if (f === 'casino.js') continue;
        try { const mod = require(path.join(dir, f)); if (mod?.name) cmds.push({ name: mod.name, desc: mod.description || '' }); } catch {}
      }
      const pageSize = 8;
      const pages = [];
      for (let i = 0; i < cmds.length; i += pageSize) pages.push(cmds.slice(i, i + pageSize).map(c => `• \`+${c.name}\` — ${c.desc.slice(0, 80)}`).join('\n'));
      if (!pages.length) pages.push('Aucune commande.');
      let cur = 0;
      const build = () => container(txt(`## 🎰 Aide Casino (${cur+1}/${pages.length})`), sep(), txt(pages[cur]));
      const row = (c) => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ch_prev_${message.id}`).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(c === 0),
        new ButtonBuilder().setCustomId(`ch_close_${message.id}`).setLabel('✖ Fermer').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`ch_next_${message.id}`).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(c === pages.length - 1)
      );
      const msg = await message.channel.send({ components: [build(), row(cur)], flags: FLAGS });
      const coll = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
      coll.on('collect', async i => {
        if (i.user.id !== message.author.id) return i.reply({ content: 'Non autorisé.', ephemeral: true });
        if (i.customId.includes('close')) { coll.stop(); return i.update({ components: [build()], flags: FLAGS }); }
        if (i.customId.includes('prev')) cur = Math.max(0, cur - 1);
        if (i.customId.includes('next')) cur = Math.min(pages.length - 1, cur + 1);
        await i.update({ components: [build(), row(cur)], flags: FLAGS });
      });
      coll.on('end', () => msg.edit({ components: [build()], flags: FLAGS }).catch(() => {}));
      return;
    }

    if (sub === 'status') {
      const catId = db.get(categoryKey);
      const cat = catId ? message.guild.channels.cache.get(catId) : null;
      const notifyCh = db.get(`casino_notify_${guildId}`);
      return reply(message, container(txt('## ⚙️ Statut Casino'), sep(), txt([`**Catégorie :** ${cat ? `${cat.name} (${catId})` : 'Non configurée'}`, `**Notifications :** ${notifyCh ? `<#${notifyCh}>` : 'Non configuré'}`].join('\n'))));
    }

    if (sub === 'set') {
      const catId = args[1];
      if (!catId) return err('Usage: `+casino set <categoryId>`');
      const ch = message.guild.channels.cache.get(catId);
      if (!ch || ch.type !== ChannelType.GuildCategory) return err('ID invalide ou non-catégorie.');
      db.set(categoryKey, catId);
      return reply(message, successContainer(`Casino limité à la catégorie **${ch.name}** (${catId}).`));
    }

    if (sub === 'clear') { db.delete(categoryKey); return reply(message, successContainer('Restriction de catégorie supprimée.')); }

    if (sub === 'setnotify') {
      const chId = args[1]; if (!chId) return err('Usage: `+casino setnotify <channelId>`');
      const ch = message.guild.channels.cache.get(chId); if (!ch) return err('Salon introuvable.');
      db.set(`casino_notify_${guildId}`, chId);
      return reply(message, successContainer(`Notifications → <#${chId}>.`));
    }

    if (sub === 'auditlog') {
      const target = message.mentions.users.first() || (args[1] ? await message.client.users.fetch(args[1]).catch(() => null) : null);
      const list = admin.getAudit(guildId, { userId: target?.id, limit: 20 });
      if (!list.length) return err('Aucun log trouvé.');
      const lines = list.slice(0, 15).map(e => `• [${new Date(e.ts).toLocaleString('fr-FR')}] **${e.type || 'event'}**${e.userId ? ` <@${e.userId}>` : ''}${e.reason ? ` — ${e.reason}` : ''}`.slice(0, 200));
      return reply(message, container(txt('## 📋 Casino Audit Log'), sep(), txt(lines.join('\n'))));
    }

    if (sub === 'suspend') {
      const target = message.mentions.users.first() || (args[1] ? await message.client.users.fetch(args[1]).catch(() => null) : null);
      if (!target) return err('Usage: `+casino suspend @user [durée] [raison]`');
      let durationMs = 0;
      try { const ms = require('ms'); durationMs = args[2] && args[2] !== '0' ? (ms(args[2]) || 0) : 0; } catch {}
      const reason = args.slice(3).join(' ') || 'unspecified';
      const res = admin.suspendUser(guildId, target.id, reason, durationMs);
      return reply(message, container(txt('## 🚫 Utilisateur Suspendu'), sep(), txt([`**Utilisateur :** <@${target.id}>`, `**Raison :** ${res.reason}`, `**Jusqu\'au :** ${res.until === -1 ? 'indéfiniment' : new Date(res.until).toLocaleString('fr-FR')}`].join('\n'))));
    }

    if (sub === 'announce') {
      const msg = args.slice(1).join(' ').trim();
      if (!msg) return err('Usage: `+casino announce <message>`');
      return reply(message, container(txt('## 📢 Casino — Annonce'), sep(), txt(msg)));
    }

    if (sub === 'metrics') {
      const all = db.all();
      let totalChips = 0, players = 0;
      const top = [];
      const prefix = 'casino_credits_';
      for (const row of all) {
        const k = row.ID || row.key; if (!k?.startsWith(prefix)) continue;
        const bal = Number(row.data || row.value) || 0;
        totalChips += bal; players++;
        top.push({ uid: k.substring(prefix.length), bal });
      }
      top.sort((a, b) => b.bal - a.bal);
      const topLines = top.slice(0, 10).map((t, i) => `**#${i+1}** <@${t.uid}> — ${t.bal.toLocaleString()}`).join('\n') || 'Aucun';
      return reply(message, container(txt('## 📊 Casino Metrics'), sep(), txt([`**Joueurs :** ${players} | **JTN total :** ${totalChips.toLocaleString()} | **Jackpot :** ${Casino.getJackpot()}`,'', '**🏆 Top 10 :**', topLines].join('\n'))));
    }

    if (sub === 'simulate') {
      const game = (args[1] || '').toLowerCase();
      const n = Math.max(1, Math.min(100000, parseInt(args[2], 10) || 10000));
      let totalBet = 0, totalPayout = 0;
      const rnd = Math.random.bind(Math);
      const bet = 100;
      if (game === 'cflip') { for (let i = 0; i < n; i++) { totalBet += bet; if (rnd() < 0.5) totalPayout += Math.floor(bet * 1.9); } }
      else if (game === 'cdice') { for (let i = 0; i < n; i++) { totalBet += bet; if (rnd() < 0.495) totalPayout += bet * 2; } }
      else if (game === 'cslots') { for (let i = 0; i < n; i++) { totalBet += bet; totalPayout += Math.floor(bet * (0.6 + rnd() * 0.7)); } }
      else if (game === 'roulette') { for (let i = 0; i < n; i++) { totalBet += bet; if (rnd() < 18/37) totalPayout += bet * 2; } }
      else if (game === 'cwheel') { const dist = [{m:0,w:40},{m:0.5,w:30},{m:1,w:18},{m:2,w:8},{m:5,w:3},{m:10,w:1}]; const bag = []; dist.forEach(s => { for (let k=0;k<s.w;k++) bag.push(s); }); for (let i=0;i<n;i++) { totalBet+=bet; const p=bag[Math.floor(rnd()*bag.length)]; totalPayout+=Math.floor(bet*p.m); } }
      else if (game === 'cplinko') { const m=[{m:0,w:15},{m:0.5,w:22},{m:1,w:30},{m:2,w:20},{m:5,w:9},{m:10,w:4}]; const bag=[]; m.forEach(s=>{for(let k=0;k<s.w;k++)bag.push(s);}); for(let i=0;i<n;i++){totalBet+=bet;const p=bag[Math.floor(rnd()*bag.length)];totalPayout+=Math.floor(bet*p.m);} }
      else if (game === 'cslotsplus') { for(let i=0;i<n;i++){totalBet+=bet;const r=rnd();let mult=r<0.08?0:r<0.95?0.6+rnd()*0.8:r<0.995?5+rnd()*5:10+rnd()*10;totalPayout+=Math.floor(bet*mult);} }
      else return err('Jeu non supporté. Options: `cflip, cdice, cslots, roulette, cwheel, cplinko, cslotsplus`');
      const rtp = totalPayout / totalBet;
      return reply(message, container(txt(`## 🧪 Simulation — ${game} (${n} tours)`), sep(), txt([`**Misé total :** ${totalBet.toLocaleString()} | **Gain total :** ${totalPayout.toLocaleString()}`, `**RTP estimé :** ${(rtp*100).toFixed(2)}%`].join('\n'))));
    }

    if (sub === 'vip') {
      const vipRoleName = client.config.CASINO?.VIP_ROLE || 'VIP';
      const hasVipRole = message.member.roles.cache.some(r => r.name === vipRoleName);
      const dbVip = db.get(`casino_vip_${message.author.id}`);
      const active = hasVipRole || (!!dbVip && (dbVip === -1 || dbVip > Date.now()));
      return reply(message, container(txt('## 💠 Statut VIP'), sep(), txt([`**Statut :** ${active ? '✅ Actif' : '❌ Inactif'}`, `**Avantages :** +5% XP • +10% plafond de mise`, `*Obtiens le rôle ${vipRoleName} ou achète l\'item VIP dans la boutique*`].join('\n'))));
    }

    if (sub === 'shop') {
      const allItems = Items.listItems();
      const lines = allItems.length > 0 ? allItems.slice(0, 12).map(i => `• **${i.name}** — ${i.price} JTN${i.desc ? `\n  *${i.desc}*` : ''}`).join('\n') : 'Boutique vide.';
      return reply(message, container(txt('## 🛒 Boutique Casino'), sep(), txt(lines + (allItems.length > 12 ? `\n\n*...et ${allItems.length-12} autres. Utilise `+cshop` pour tout voir.*` : ''))));
    }

    if (sub === 'buy') {
      const item = (args[1] || '').toLowerCase();
      if (!item) return err('Usage: `+casino buy <item>`. Voir `+casino shop`');
      const catalog = { vip: { price: 5000 }, loot: { price: 800 }, boostxp: { price: 600 } };
      const it = catalog[item];
      if (!it) return err('Item inconnu. Options: `vip, loot, boostxp`');
      if (!Casino.hasEnoughCasino(message.author.id, it.price)) return err(`Fonds insuffisants (${Casino.getCasinoBalance(message.author.id)} JTN).`);
      Casino.deductCasinoCredits(message.author.id, it.price);
      if (item === 'vip') db.set(`casino_vip_${message.author.id}`, Date.now() + 7*24*60*60*1000);
      else if (item === 'loot') db.add(`casino_loot_${message.author.id}`, 1);
      else if (item === 'boostxp') db.set(`casino_xpboost_${message.author.id}`, Date.now() + 60*60*1000);
      admin.addAudit(guildId, { type: 'shop_buy', userId: message.author.id, item });
      return reply(message, successContainer(`Achat effectué : **${item}** pour **${it.price} JTN**.`));
    }

    if (sub === 'profile') {
      const uid = message.author.id;
      const bal = Casino.getCasinoBalance(uid), xp = Casino.getXp(uid), lvl = Casino.getLevel(uid);
      const stats = Casino.getStats(uid);
      const totalGames = Object.values(stats).reduce((a, b) => a + Number(b || 0), 0);
      const ach = Casino.getAchievements ? Casino.getAchievements(uid) : {};
      const streak = db.get(`casino_streak_${uid}`) || 0;
      const tickets = db.get(`casino_loot_${uid}`) || 0;
      const vipUntil = db.get(`casino_vip_${uid}`);
      const vipOn = !!vipUntil && (vipUntil === -1 || vipUntil > Date.now());
      return reply(message, container(txt(`## 🎲 Profil Casino — ${message.author.username}`), sep(), txt([`**Solde :** ${bal.toLocaleString()} JTN | **VIP :** ${vipOn ? '✅' : '❌'}`, `**Niveau :** ${lvl} | **XP :** ${xp} | **Streak :** ${streak}j | **Tickets :** ${tickets}`, `**Parties jouées :** ${totalGames} | **Succès :** ${Object.keys(ach).length}`].join('\n'))));
    }

    if (sub === 'config') return reply(message, errorContainer('Ce menu est obsolète. Utilisez `+cadmin` pour configurer le casino.'));

    if (sub === 'settings') {
      const what = (args[2] || '').toLowerCase(), val = args.slice(3).join(' ').trim();
      if (!['theme', 'emoji'].includes(what) || !val) return err('Usage: `+casino settings ui <theme|emoji> <valeur>`');
      if (what === 'theme') { db.set(`casino_ui_theme_${guildId}`, val); return reply(message, successContainer(`Thème UI défini : **${val}**`)); }
      if (what === 'emoji') { db.set(`casino_ui_emoji_${guildId}`, val); return reply(message, successContainer(`Emoji jeton défini : **${val}**`)); }
    }

    if (sub === 'backup') {
      try {
        const dbFile = path.join(__dirname, '..', '..', 'data', 'database.json');
        const archDir = path.join(__dirname, '..', '..', 'archives');
        if (!fs.existsSync(archDir)) fs.mkdirSync(archDir, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const out = path.join(archDir, `casino-backup-${ts}.json`);
        fs.copyFileSync(dbFile, out);
        return reply(message, successContainer(`Backup enregistré : \`${path.basename(out)}\``));
      } catch { return err('Erreur lors du backup.'); }
    }

    if (sub === 'export') {
      const what = (args[1] || '').toLowerCase();
      const all = db.all();
      if (what === 'balances') {
        const rows = [['userId','balance']];
        for (const item of all) { const m = /^casino_credits_(\d+)$/.exec(item.ID||item.key); if (m) rows.push([m[1], String(item.data||item.value||0)]); }
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
        return message.channel.send({ content: '📤 Export des soldes casino', files: [{ attachment: Buffer.from(csv,'utf8'), name: 'casino-balances.csv' }] });
      }
      if (what === 'xp') {
        const rows = [['userId','xp','level']]; const seen = new Set();
        for (const item of all) { const m = /^casino_xp_(\d+)$/.exec(item.ID||item.key); if (m && !seen.has(m[1])) { seen.add(m[1]); rows.push([m[1], String(db.get(`casino_xp_${m[1]}`)||0), String(db.get(`casino_level_${m[1]}`)||1)]); } }
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
        return message.channel.send({ content: '📤 Export XP casino', files: [{ attachment: Buffer.from(csv,'utf8'), name: 'casino-xp.csv' }] });
      }
      if (what === 'history') {
        const game = (args[2]||'').toLowerCase(); if (!game) return err('Usage: `+casino export history <jeu>`');
        const rows = [['userId','ts','bet','payout','win']];
        for (const item of all) { const m = new RegExp(`^casino_history_(\\d+)_${game}$`).exec(item.ID||item.key); if (m) { const list = db.get(item.ID||item.key)||[]; for (const e of list) rows.push([m[1], String(e.ts||''), String(e.bet||0), String(e.payout||0), String(e.win||false)]); } }
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
        return message.channel.send({ content: `📤 Export historique (${game})`, files: [{ attachment: Buffer.from(csv,'utf8'), name: `casino-history-${game}.csv` }] });
      }
      return err('Usage: `+casino export balances | xp | history <jeu>`');
    }

    if (sub === 'grant') {
      const user = message.mentions.users.first() || (args[1] ? await message.client.users.fetch(args[1]).catch(()=>null) : null);
      const amount = parseInt(args[2]||'0',10);
      if (!user || !Number.isFinite(amount) || amount <= 0) return err('Usage: `+casino grant <@user|id> <montant>`');
      Casino.addCasinoCredits(user.id, amount);
      admin.addAudit(guildId, { type: 'grant', userId: message.author.id, target: user.id, amount });
      return reply(message, successContainer(`Ajouté **${amount} JTN** à <@${user.id}>.`));
    }

    if (sub === 'take') {
      const user = message.mentions.users.first() || (args[1] ? await message.client.users.fetch(args[1]).catch(()=>null) : null);
      const amount = parseInt(args[2]||'0',10);
      if (!user || !Number.isFinite(amount) || amount <= 0) return err('Usage: `+casino take <@user|id> <montant>`');
      Casino.deductCasinoCredits(user.id, amount);
      admin.addAudit(guildId, { type: 'take', userId: message.author.id, target: user.id, amount });
      return reply(message, successContainer(`Retiré **${amount} JTN** à <@${user.id}>.`));
    }

    if (sub === 'setbal') {
      const user = message.mentions.users.first() || (args[1] ? await message.client.users.fetch(args[1]).catch(()=>null) : null);
      const amount = parseInt(args[2]||'0',10);
      if (!user || !Number.isFinite(amount) || amount < 0) return err('Usage: `+casino setbal <@user|id> <montant>`');
      const cur = Casino.getCasinoBalance(user.id); const diff = amount - cur;
      if (diff > 0) Casino.addCasinoCredits(user.id, diff); else if (diff < 0) Casino.deductCasinoCredits(user.id, -diff);
      admin.addAudit(guildId, { type: 'setbal', userId: message.author.id, target: user.id, amount });
      return reply(message, successContainer(`Solde de <@${user.id}> réglé à **${amount} JTN**.`));
    }

    if (sub === 'wipe') {
      const user = message.mentions.users.first() || (args[1] ? await message.client.users.fetch(args[1]).catch(()=>null) : null);
      if (!user) return err('Usage: `+casino wipe <@user|id>`');
      const cur = Casino.getCasinoBalance(user.id); if (cur > 0) Casino.deductCasinoCredits(user.id, cur);
      admin.addAudit(guildId, { type: 'wipe', userId: message.author.id, target: user.id });
      return reply(message, successContainer(`Solde de <@${user.id}> remis à zéro.`));
    }

    if (sub === 'job') {
      const action = (args[1]||'').toLowerCase();
      if (action === 'create') { const name=(args[2]||'').toLowerCase(),gain=parseInt(args[3]||'0',10),skill=(args[4]||'').toLowerCase(),bonus=args.slice(5).join(' '); if(!name||!gain||!skill) return err('Usage: `+casino job create <nom> <gain> <compétence> [bonus]`'); const r=Jobs.createJob({name,dailyMin:gain,dailyMax:gain,skill,bonus,desc:bonus}); if(!r.ok) return err(r.error||'Erreur'); admin.addAudit(guildId,{type:'job_create',userId:message.author.id,name}); return reply(message,successContainer(`Métier créé : **${name}**`)); }
      if (action === 'delete') { const name=(args[2]||'').toLowerCase(); if(!name) return err('Usage: `+casino job delete <nom>`'); const ok=Jobs.deleteJob(name); if(!ok) return err('Métier introuvable.'); admin.addAudit(guildId,{type:'job_delete',userId:message.author.id,name}); return reply(message,successContainer(`Métier supprimé : **${name}**`)); }
      if (action === 'force') { const user=message.mentions.users.first()||(args[2]?await message.client.users.fetch(args[2]).catch(()=>null):null),job=(args[3]||'').toLowerCase(); if(!user||!job) return err('Usage: `+casino job force <@user|id> <job>`'); const r=Jobs.setUserJob(user.id,job); if(!r.ok) return err(r.error||'Erreur'); return reply(message,successContainer(`Métier **${job}** forcé pour <@${user.id}>.`)); }
      return err('Usage: `+casino job create|delete|force ...`');
    }

    if (sub === 'comp') {
      const action = (args[1]||'').toLowerCase();
      if (action === 'set') { const user=message.mentions.users.first()||(args[2]?await message.client.users.fetch(args[2]).catch(()=>null):null),comp=(args[3]||'').toLowerCase(),lvl=parseInt(args[4]||'0',10); if(!user||!comp||!lvl) return err('Usage: `+casino comp set <@user|id> <comp> <niveau>`'); Jobs.setSkillLevel(user.id,comp,lvl); admin.addAudit(guildId,{type:'comp_set',userId:message.author.id,target:user.id,comp,lvl}); return reply(message,successContainer(`Compétence **${comp}** → **${lvl}** pour <@${user.id}>.`)); }
      return err('Usage: `+casino comp set <@user|id> <comp> <niveau>`');
    }

    if (sub === 'shopadmin') {
      const action = (args[1]||'').toLowerCase();
      if (action === 'add') { const name=(args[2]||'').toLowerCase(),price=parseInt(args[3]||'0',10),effect=args.slice(4).join(' ')||''; if(!name||!price) return err('Usage: `+casino shopadmin add <objet> <prix> <effet>`'); const r=Items.addItemDef({name,price,effect:{type:effect},desc:effect}); if(!r.ok) return err(r.error||'Erreur'); return reply(message,successContainer(`Objet ajouté : **${name}** (${price} JTN)`)); }
      if (action === 'remove') { const name=(args[2]||'').toLowerCase(); if(!name) return err('Usage: `+casino shopadmin remove <objet>`'); const ok=Items.removeItemDef(name); if(!ok) return err('Objet introuvable.'); return reply(message,successContainer(`Objet supprimé : **${name}**`)); }
      return err('Usage: `+casino shopadmin add|remove ...`');
    }

    if (sub === 'item') {
      const action = (args[1]||'').toLowerCase();
      if (action === 'give') { const user=message.mentions.users.first()||(args[2]?await message.client.users.fetch(args[2]).catch(()=>null):null),name=(args[3]||'').toLowerCase(),qty=parseInt(args[4]||'1',10); if(!user||!name) return err('Usage: `+casino item give <@user|id> <objet> [quantité]`'); Items.addToInventory(user.id,name,qty); admin.addAudit(guildId,{type:'item_give',userId:message.author.id,target:user.id,name,qty}); return reply(message,successContainer(`Donné **${qty}x ${name}** à <@${user.id}>.`)); }
      if (action === 'clear') { const user=message.mentions.users.first()||(args[2]?await message.client.users.fetch(args[2]).catch(()=>null):null); if(!user) return err('Usage: `+casino item clear <@user|id>`'); Items.setInventory(user.id,{}); return reply(message,successContainer(`Inventaire vidé pour <@${user.id}>.`)); }
      if (action === 'use') { const user=message.mentions.users.first()||(args[2]?await message.client.users.fetch(args[2]).catch(()=>null):null),name=(args[3]||'').toLowerCase(); if(!user||!name) return err('Usage: `+casino item use <@user|id> <objet>`'); const r=Items.use(user.id,name); if(!r.ok) return err(r.error||'Erreur'); return reply(message,successContainer(`Objet **${name}** utilisé pour <@${user.id}>.`)); }
      return err('Usage: `+casino item give|clear|use ...`');
    }

    if (sub === 'team') {
      const action = (args[1]||'').toLowerCase();
      if (!['delete','reset','logs','announce'].includes(action)) return err('Usage: `+casino team <delete|reset|logs|announce> ...`');
      if (action === 'delete') {
        const teamId = args[2]; if(!teamId) return err('Usage: `+casino team delete <teamID>`');
        const t = Teams.getTeam(teamId); if(!t) return err('Team introuvable.');
        try { if(t.channels){const tx=t.channels.textId&&message.guild.channels.cache.get(t.channels.textId);const vx=t.channels.voiceId&&message.guild.channels.cache.get(t.channels.voiceId);if(tx)await tx.delete('Admin');if(vx)await vx.delete('Admin');} } catch {}
        if (!Teams.deleteTeam(teamId)) return err('Échec de suppression.');
        admin.addAudit(guildId,{type:'team_delete',userId:message.author.id,teamId});
        return reply(message, successContainer(`Team **${teamId}** supprimée.`));
      }
      if (action === 'reset') {
        const teamId = args[2]; if(!teamId) return err('Usage: `+casino team reset <teamID>`');
        const t = Teams.getTeam(teamId); if(!t) return err('Team introuvable.');
        t.customize={banner:null,thumb:null,color:null,desc:'',emoji:null,tag:t.tag||null,visibility:'public'};t.officers=[];t.payroll=0;Teams.saveTeam(t);
        return reply(message, successContainer(`Team **${t.name}** réinitialisée.`));
      }
      if (action === 'logs') {
        const targetArg = args[2];
        let t = null;
        const mentionedUser = message.mentions.users.first();
        if (mentionedUser) { const tid=Teams.getUserTeamId(mentionedUser.id); if(tid) t=Teams.getTeam(tid); }
        else if (targetArg) { t=Teams.getTeam(targetArg); if(!t&&/^\d+$/.test(targetArg)){const tid=Teams.getUserTeamId(targetArg);if(tid)t=Teams.getTeam(tid);} }
        if (!t) return err('Team introuvable. Fournis un teamID ou mentionne un utilisateur.');
        const lines = (t.logs||[]).slice(0,15).map(e=>`• [${new Date(e.ts).toLocaleString('fr-FR')}] ${e.type}`.slice(0,200));
        return reply(message, container(txt(`## 📝 Logs Team — ${t.name}`), sep(), txt(lines.join('\n')||'Aucun log.')));
      }
      if (action === 'announce') {
        const teamId=args[2],msg=args.slice(3).join(' ').trim(); if(!teamId||!msg) return err('Usage: `+casino team announce <teamID> <message>`');
        const t=Teams.getTeam(teamId); if(!t) return err('Team introuvable.');
        const notifyChId=db.get(`casino_notify_${guildId}`); if(!notifyChId) return err('Aucun salon de notification configuré (`+casino setnotify <id>`).');
        const ch=message.guild.channels.cache.get(notifyChId); if(!ch?.isTextBased()) return err('Salon invalide.');
        await ch.send({ components: [container(txt(`## 📢 Annonce — ${t.customize?.emoji||'🔰'} ${t.name}`), sep(), txt(`${msg}\n\n*Par ${message.author.tag}*`))], flags: FLAGS });
        return reply(message, successContainer('Annonce envoyée.'));
      }
    }
  }
};
