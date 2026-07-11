const Discord = require('discord.js');
const db = require('../../utils/simpledb');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ms = require("ms");
const { container, txt, sep, row, FLAGS } = require('../../utils/v2');

function onoff(antiraid) {
  if (antiraid === null || antiraid === false) return "<a:_:1483497365863399536>";
  if (antiraid === true) return "<a:_:1483497369315315786>";
  return "<a:_:1483497365863399536>";
}

function wlbypass(antiraid) {
  if (antiraid === true) return "<a:_:1483497365863399536>";
  if (antiraid === null || antiraid === false) return "<a:_:1483497369315315786>";
  return "<a:_:1483497369315315786>";
}

// Helper pour construire le container des sous-menus de module
function subMenu(title, options = ['Modifier l\'activité', 'Modifier la sanction', 'Modifier la whitelist bypass']) {
  const lines = options.map((o, i) => `${['1️⃣','2️⃣','3️⃣','4️⃣'][i]} · ${o}`).join('\n');
  return container(txt(`## 🛡️ ${title}`), sep(), txt(lines));
}

module.exports = {
  name: 'antiraid',
  aliases: ["secur"],
  description: 'Protection anti-raid du serveur',
  run: async (client, message, args, prefix, color) => {
    async function on() {
      const msggg = await message.channel.send("Chargement...");
      db.set(`massban_${message.guild.id}`, true);
      db.set(`massbansanction_${message.guild.id}`, "ban");
      db.set(`massbanwl_${message.guild.id}`, true);
      db.set(`link_${message.guild.id}`, true);
      db.set(`webhook_${message.guild.id}`, true);
      db.set(`webhooksanction_${message.guild.id}`, "ban");
      db.set(`webhookwl_${message.guild.id}`, true);
      db.set(`rolescreate_${message.guild.id}`, true);
      db.set(`rolescreatesanction_${message.guild.id}`, "derank");
      db.set(`rolescreatewl_${message.guild.id}`, null);
      db.set(`rolesdel_${message.guild.id}`, true);
      db.set(`rolesdelsanction_${message.guild.id}`, "derank");
      db.set(`rolesdelwl_${message.guild.id}`, null);
      db.set(`rolesmod_${message.guild.id}`, true);
      db.set(`rolesmodsanction_${message.guild.id}`, "derank");
      db.set(`rolesmodwl_${message.guild.id}`, null);
      db.set(`rolesadd_${message.guild.id}`, true);
      db.set(`rolesaddsanction_${message.guild.id}`, "derank");
      db.set(`rolesaddwl_${message.guild.id}`, null);
      db.set(`channelscreate_${message.guild.id}`, true);
      db.set(`channelscreatesanction_${message.guild.id}`, "derank");
      db.set(`channelscreatewl_${message.guild.id}`, null);
      db.set(`channelsdel_${message.guild.id}`, true);
      db.set(`channelsdelsanction_${message.guild.id}`, "derank");
      db.set(`channelsdelwl_${message.guild.id}`, null);
      db.set(`channelsmod_${message.guild.id}`, true);
      db.set(`channelsmodsanction_${message.guild.id}`, "derank");
      db.set(`channelsmodwl_${message.guild.id}`, null);
      db.set(`update_${message.guild.id}`, true);
      db.set(`updatesanction_${message.guild.id}`, "derank");
      db.set(`updatewl_${message.guild.id}`, true);
      db.set(`bot_${message.guild.id}`, true);
      db.set(`botsanction_${message.guild.id}`, "ban");
      db.set(`botwl_${message.guild.id}`, true);
      db.set(`antideco_${message.guild.id}`, true);
      db.set(`antidecosanction_${message.guild.id}`, "derank");
      db.set(`antidecowl_${message.guild.id}`, true);
      db.set(`antitoken_${message.guild.id}`, true);
      db.set(`crealimit_${message.guild.id}`, true);
      db.set(`crealimittemps_${message.guild.id}`, ms("1d"));
      await msggg.edit("Tous les modules d'antiraid ont été activés");
    }

    function off() {
      message.channel.send("Chargement...").then((msggg) => {
        db.set(`massban_${message.guild.id}`, null);
        db.set(`webhook_${message.guild.id}`, null);
        db.set(`rolescreate_${message.guild.id}`, null);
        db.set(`rolesdel_${message.guild.id}`, null);
        db.set(`rolesmod_${message.guild.id}`, null);
        db.set(`rolesadd_${message.guild.id}`, null);
        db.set(`channelscreate_${message.guild.id}`, null);
        db.set(`channelsdel_${message.guild.id}`, null);
        db.set(`channelsmod_${message.guild.id}`, null);
        db.set(`update_${message.guild.id}`, null);
        db.set(`bot_${message.guild.id}`, null);
        db.set(`antideco_${message.guild.id}`, null);
        db.set(`antitoken_${message.guild.id}`, null);
        db.set(`crealimit_${message.guild.id}`, null);
        msggg.edit("Tous les modules d'antiraid ont été désactivés");
      });
    }

    function max() {
      message.channel.send("Chargement...").then((msggg) => {
        db.set(`massban_${message.guild.id}`, true); db.set(`massbansanction_${message.guild.id}`, "ban"); db.set(`massbanwl_${message.guild.id}`, true);
        db.set(`webhook_${message.guild.id}`, true); db.set(`webhooksanction_${message.guild.id}`, "ban"); db.set(`webhookwl_${message.guild.id}`, true);
        db.set(`rolescreate_${message.guild.id}`, true); db.set(`rolescreatesanction_${message.guild.id}`, "ban"); db.set(`rolescreatewl_${message.guild.id}`, true);
        db.set(`rolesdel_${message.guild.id}`, true); db.set(`rolesdelsanction_${message.guild.id}`, "ban"); db.set(`rolesdelwl_${message.guild.id}`, true);
        db.set(`rolesmod_${message.guild.id}`, true); db.set(`rolesmodsanction_${message.guild.id}`, "ban"); db.set(`rolesmodwl_${message.guild.id}`, true);
        db.set(`rolesadd_${message.guild.id}`, true); db.set(`rolesaddsanction_${message.guild.id}`, "ban"); db.set(`rolesaddwl_${message.guild.id}`, true);
        db.set(`channelscreate_${message.guild.id}`, true); db.set(`channelscreatesanction_${message.guild.id}`, "ban"); db.set(`channelscreatewl_${message.guild.id}`, true);
        db.set(`channelsdel_${message.guild.id}`, true); db.set(`channelsdelsanction_${message.guild.id}`, "ban"); db.set(`channelsdelwl_${message.guild.id}`, true);
        db.set(`channelsmod_${message.guild.id}`, true); db.set(`channelsmodsanction_${message.guild.id}`, "ban"); db.set(`channelsmodwl_${message.guild.id}`, true);
        db.set(`update_${message.guild.id}`, true); db.set(`updatesanction_${message.guild.id}`, "ban"); db.set(`updatewl_${message.guild.id}`, true);
        db.set(`bot_${message.guild.id}`, true); db.set(`botsanction_${message.guild.id}`, "ban"); db.set(`botwl_${message.guild.id}`, true);
        db.set(`antideco_${message.guild.id}`, true); db.set(`antidecosanction_${message.guild.id}`, "ban"); db.set(`antidecowl_${message.guild.id}`, true);
        db.set(`antitoken_${message.guild.id}`, true); db.set(`crealimit_${message.guild.id}`, true); db.set(`crealimittemps_${message.guild.id}`, ms("1d"));
        msggg.edit("Tous les modules d'antiraid ont été activés en mode maximum");
      });
    }

    if (
      client.config.superadmin.includes(message.author.id) ||
      client.config.owners.includes(message.author.id) ||
      db.get(`ownermd_${client.user.id}_${message.author.id}`) === true) {
      if (args[0] === "config" || !args[0]) {
        let p0 = 0, p1 = 3, page = 1;

        const msg = await message.channel.send(`Antiraid • ${client.config.name}`);

        setTimeout(() => { msg.edit({ components: [] }).catch(() => {}); }, 600000);

        updateembed1(msg);

        const collector = msg.createMessageComponentCollector({ time: 600000 });

        collector.on('collect', async (interaction) => {
          if (interaction.user.id !== message.author.id) {
            try { await interaction.reply({ content: '<:_:1483497503713394719> Cette interface est réservée au créateur.', ephemeral: true }); } catch (_) {}
            return;
          }
          await interaction.deferUpdate();
          const customId = interaction.customId;

          // ── Preset buttons ────────────────────────────────────────────────────
          if (customId === message.id + "on" || customId === message.id + "2on" || customId === message.id + "3on") { msg.delete().catch(() => {}); on(); return; }
          if (customId === message.id + "off" || customId === message.id + "2off" || customId === message.id + "3off") { msg.delete().catch(() => {}); off(); return; }
          if (customId === message.id + "max" || customId === message.id + "2max" || customId === message.id + "3max") { msg.delete().catch(() => {}); max(); return; }

          // ── Navigation buttons ────────────────────────────────────────────────
          if (customId === message.id + "return2") { p0 += 5; p1 += 5; page++; if (p1 > 23) return; updateembed2(msg); return; }
          if (customId === message.id + "return1") { p0 -= 5; p1 -= 5; page--; if (p0 < 0) return; updateembed1(msg); return; }
          if (customId === message.id + "return25") { p0 += 5; p1 += 5; page++; if (p1 > 23) return; updateembed3(msg); return; }
          if (customId === message.id + "return15") { p0 -= 5; p1 -= 5; page--; if (p0 < 0) return; updateembed2(msg); return; }

          // ── Module buttons ────────────────────────────────────────────────────
          // Helper to send sub-menu
          async function sendSubMenu(title, options, buttons) {
            const lines = options.map((o, i) => `${['1️⃣','2️⃣','3️⃣','4️⃣'][i]} · ${o}`).join('\n');
            const m = await message.channel.send({ components: [container(txt(`## 🛡️ ${title}`), sep(), txt(lines), row(...buttons))], flags: FLAGS });
            setTimeout(() => { m.delete().catch(() => {}); message.channel.send(`Temps écoulé`).then((mm) => setTimeout(() => mm.delete(), 3000)); }, 300000);
            return m;
          }

          async function askYesNo(question) {
            const q = await message.channel.send(question);
            try {
              const r = await message.channel.awaitMessages({ filter: (res) => res.author.id === message.author.id, max: 1, time: 30000, errors: ['time'] });
              const val = r.first().content.toLowerCase();
              q.delete().catch(() => {}); r.first().delete().catch(() => {});
              return val;
            } catch { q.delete().catch(() => {}); message.channel.send("Temps écoulé").then((mm) => setTimeout(() => mm.delete(), 3000)); return null; }
          }

          async function askText(question) {
            const q = await message.channel.send(question);
            try {
              const r = await message.channel.awaitMessages({ filter: (res) => res.author.id === message.author.id, max: 1, time: 30000, errors: ['time'] });
              const val = r.first().content.toLowerCase();
              q.delete().catch(() => {}); r.first().delete().catch(() => {});
              return val;
            } catch { q.delete().catch(() => {}); message.channel.send("Temps écoulé").then((mm) => setTimeout(() => mm.delete(), 3000)); return null; }
          }

          function makeModuleButtons(prefix, ids) {
            const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣'];
            return ids.map((id, i) => new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + id).setEmoji(i < emojis.length ? emojis[i] : '5️⃣'));
          }

          // ── ADDROLE ───────────────────────────────────────────────────────────
          if (customId === message.id + "addrole") {
            const buttons = [...makeModuleButtons('', ['addroleactif','sanctionaddrole','addrolewl']), new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "anuaddrole").setEmoji("<a:_:1483497365863399536>")];
            const m = await sendSubMenu('Ajout de rôle avec des permissions dangereuses', ['Modifier l\'activité','Modifier la sanction','Modifier la whitelist bypass'], buttons);
            const col = m.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, time: 300000 });
            col.on('collect', async (bi) => {
              await bi.deferUpdate();
              if (bi.customId === message.id + "anuaddrole") { m.delete().catch(() => {}); return; }
              if (bi.customId === message.id + "addroleactif") { const v = await askYesNo("Est ce que **je dois punir les personnes qui ajouteront des permissions à un membre ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`rolesadd_${message.guild.id}`, true); message.channel.send("Le module a été activé"); updateembed1(msg); } else if (v === "non") { db.set(`rolesadd_${message.guild.id}`, null); message.channel.send("Le module a été désactivé"); updateembed1(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "sanctionaddrole") { const v = await askText("Qu'est ce que je dois faire **quand quelqu'un ajoutera des permissions à un membre ?** (`ban`, `kick`, `derank`)"); if (v && (v === "ban" || v === "kick" || v === "derank" || v === "unrank")) { const s = v === "unrank" ? "derank" : v; db.set(`rolesaddsanction_${message.guild.id}`, s); message.channel.send(`Désormais quand quelqu'un **ajoutera des permissions à un membre** il se fera \`${s}\` `); updateembed1(msg); } else if (v !== null) message.channel.send("C'est soit `ban`, `kick` ou `derank` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "addrolewl") { const v = await askYesNo("Est ce que **je dois punir les personnes whitelist qui ajouteront des permissions à un membre ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`rolesaddwl_${message.guild.id}`, true); message.channel.send(`Les whitelists ne peuvent pas bypass le module`); updateembed1(msg); } else if (v === "non") { db.set(`rolesaddwl_${message.guild.id}`, null); message.channel.send(`Les whitelists peuvent maintenant bypass le module`); updateembed1(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
            });
          }

          // ── ROLEDEL ───────────────────────────────────────────────────────────
          else if (customId === message.id + "roledel") {
            const buttons = [...makeModuleButtons('', ['delroledel','delrolesanction','delrolewl']), new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "delroleanu").setEmoji("<a:_:1483497365863399536>")];
            const m = await sendSubMenu('Suppression de rôle', ['Modifier l\'activité','Modifier la sanction','Modifier la whitelist bypass'], buttons);
            const col = m.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, time: 300000 });
            col.on('collect', async (bi) => {
              await bi.deferUpdate();
              if (bi.customId === message.id + "delroleanu") { m.delete().catch(() => {}); return; }
              if (bi.customId === message.id + "delroledel") { const v = await askYesNo("Est ce que **je dois punir les personnes qui supprimeront des rôles ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`rolesdel_${message.guild.id}`, true); message.channel.send("Le module a été activé"); updateembed1(msg); } else if (v === "non") { db.set(`rolesdel_${message.guild.id}`, null); message.channel.send("Le module a été désactivé"); updateembed1(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "delrolesanction") { const v = await askText("Qu'est ce que je dois faire **quand quelqu'un supprimera un rôle ?** (`ban`, `kick`, `derank`)"); if (v && (v === "ban" || v === "kick" || v === "derank" || v === "unrank")) { const s = v === "unrank" ? "derank" : v; db.set(`rolesdelsanction_${message.guild.id}`, s); message.channel.send(`Désormais quand quelqu'un **supprimera un rôle** il se fera \`${s}\` `); updateembed1(msg); } else if (v !== null) message.channel.send("C'est soit `ban`, `kick` ou `derank` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "delrolewl") { const v = await askYesNo("Est ce que **je dois punir les personnes whitelist qui supprimeront des rôles ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`rolesdelwl_${message.guild.id}`, true); message.channel.send(`Les whitelists ne peuvent pas bypass le module`); updateembed1(msg); } else if (v === "non") { db.set(`rolesdelwl_${message.guild.id}`, null); message.channel.send(`Les whitelists peuvent maintenant bypass le module`); updateembed1(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
            });
          }

          // ── ROLEMODIF ─────────────────────────────────────────────────────────
          else if (customId === message.id + "rolemodif") {
            const buttons = [...makeModuleButtons('', ['modifrole','modpunrole','wlrolemod']), new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "delrolemod").setEmoji("<a:_:1483497365863399536>")];
            const m = await sendSubMenu('Modification de rôle', ['Modifier l\'activité','Modifier la sanction','Modifier la whitelist bypass'], buttons);
            const col = m.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, time: 300000 });
            col.on('collect', async (bi) => {
              await bi.deferUpdate();
              if (bi.customId === message.id + "delrolemod") { m.delete().catch(() => {}); return; }
              if (bi.customId === message.id + "modifrole") { const v = await askYesNo("Est ce que **je dois punir les personnes qui modifieront des rôles ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`rolesmod_${message.guild.id}`, true); message.channel.send("Le module a été activé"); updateembed1(msg); } else if (v === "non") { db.set(`rolesmod_${message.guild.id}`, null); message.channel.send("Le module a été désactivé"); updateembed1(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "modpunrole") { const v = await askText("Qu'est ce que je dois faire **quand quelqu'un modifiera un rôle ?** (`ban`, `kick`, `derank`)"); if (v && (v === "ban" || v === "kick" || v === "derank" || v === "unrank")) { const s = v === "unrank" ? "derank" : v; db.set(`rolesmodsanction_${message.guild.id}`, s); message.channel.send(`Désormais quand quelqu'un **modifiera un rôle** il se fera \`${s}\` `); updateembed1(msg); } else if (v !== null) message.channel.send("C'est soit `ban`, `kick` ou `derank` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "wlrolemod") { const v = await askYesNo("Est ce que **je dois punir les personnes whitelist qui modifieront des rôles ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`rolesmodwl_${message.guild.id}`, true); message.channel.send(`Les whitelists ne peuvent pas bypass le module`); updateembed1(msg); } else if (v === "non") { db.set(`rolesmodwl_${message.guild.id}`, null); message.channel.send(`Les whitelists peuvent maintenant bypass le module`); updateembed1(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
            });
          }

          // ── ROLECREATE ────────────────────────────────────────────────────────
          else if (customId === message.id + "rolecreate") {
            const buttons = [...makeModuleButtons('', ['rolecactif','rolecpun','rolecwl']), new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "rolecanu").setEmoji("<a:_:1483497365863399536>")];
            const m = await sendSubMenu('Création de rôle', ['Modifier l\'activité','Modifier la sanction','Modifier la whitelist bypass'], buttons);
            const col = m.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, time: 300000 });
            col.on('collect', async (bi) => {
              await bi.deferUpdate();
              if (bi.customId === message.id + "rolecanu") { m.delete().catch(() => {}); return; }
              if (bi.customId === message.id + "rolecactif") { const v = await askYesNo("Est ce que **je dois punir les personnes qui créeront des rôles ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`rolescreate_${message.guild.id}`, true); message.channel.send("Le module a été activé"); updateembed1(msg); } else if (v === "non") { db.set(`rolescreate_${message.guild.id}`, null); message.channel.send("Le module a été désactivé"); updateembed1(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "rolecpun") { const v = await askText("Qu'est ce que je dois faire **quand quelqu'un créera un rôle ?** (`ban`, `kick`, `derank`)"); if (v && (v === "ban" || v === "kick" || v === "derank" || v === "unrank")) { const s = v === "unrank" ? "derank" : v; db.set(`rolescreatesanction_${message.guild.id}`, s); message.channel.send(`Désormais quand quelqu'un **créera un rôle** il se fera \`${s}\` `); updateembed1(msg); } else if (v !== null) message.channel.send("C'est soit `ban`, `kick` ou `derank` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "rolecwl") { const v = await askYesNo("Est ce que **je dois punir les personnes whitelist qui créeront des rôles ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`rolescreatewl_${message.guild.id}`, true); message.channel.send(`Les whitelists ne peuvent pas bypass le module`); updateembed1(msg); } else if (v === "non") { db.set(`rolescreatewl_${message.guild.id}`, null); message.channel.send(`Les whitelists peuvent maintenant bypass le module`); updateembed1(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
            });
          }

          // ── WEBHOOK ───────────────────────────────────────────────────────────
          else if (customId === message.id + "webhook") {
            const buttons = [...makeModuleButtons('', ['actifwebhok','sanctionsweb','wlwebhook']), new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "delweb").setEmoji("<a:_:1483497365863399536>")];
            const m = await sendSubMenu('Anti-Webhook', ['Modifier l\'activité','Modifier la sanction','Modifier la whitelist bypass'], buttons);
            const col = m.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, time: 300000 });
            col.on('collect', async (bi) => {
              await bi.deferUpdate();
              if (bi.customId === message.id + "delweb") { m.delete().catch(() => {}); return; }
              if (bi.customId === message.id + "actifwebhok") { const v = await askYesNo("Est ce que **je dois punir les personnes qui créeront des webhooks ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`webhook_${message.guild.id}`, true); message.channel.send("Le module a été activé"); updateembed1(msg); } else if (v === "non") { db.set(`webhook_${message.guild.id}`, null); message.channel.send("Le module a été désactivé"); updateembed1(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "sanctionsweb") { const v = await askText("Qu'est ce que je dois faire **quand quelqu'un créera un webhook ?** (`ban`, `kick`, `derank`)"); if (v && (v === "ban" || v === "kick" || v === "derank" || v === "unrank")) { const s = v === "unrank" ? "derank" : v; db.set(`webhooksanction_${message.guild.id}`, s); message.channel.send(`Désormais quand quelqu'un **créera un webhook** il se fera \`${s}\` `); updateembed1(msg); } else if (v !== null) message.channel.send("C'est soit `ban`, `kick` ou `derank` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "wlwebhook") { const v = await askYesNo("Est ce que **je dois punir les personnes whitelist qui créeront des webhooks ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`webhookwl_${message.guild.id}`, true); message.channel.send(`Les whitelists ne peuvent pas bypass le module`); updateembed1(msg); } else if (v === "non") { db.set(`webhookwl_${message.guild.id}`, null); message.channel.send(`Les whitelists peuvent maintenant bypass le module`); updateembed1(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
            });
          }

          // ── UPDATE (Serveur Check) ─────────────────────────────────────────────
          else if (customId === message.id + "update") {
            const buttons = [...makeModuleButtons('', ['updateactif','sanctionupdate','updatewl']), new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "anuupdate").setEmoji("<a:_:1483497365863399536>")];
            const m = await sendSubMenu('Modification du serveur', ['Modifier l\'activité','Modifier la sanction','Modifier la whitelist bypass'], buttons);
            const col = m.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, time: 300000 });
            col.on('collect', async (bi) => {
              await bi.deferUpdate();
              if (bi.customId === message.id + "anuupdate") { m.delete().catch(() => {}); return; }
              if (bi.customId === message.id + "updateactif") { const v = await askYesNo("Est ce que **je dois punir les personnes qui modifieront le serveur ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`update_${message.guild.id}`, true); message.channel.send("Le module a été activé"); updateembed2(msg); } else if (v === "non") { db.set(`update_${message.guild.id}`, null); message.channel.send("Le module a été désactivé"); updateembed2(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "sanctionupdate") { const v = await askText("Qu'est ce que je dois faire **quand quelqu'un modifiera le serveur ?** (`ban`, `kick`, `derank`)"); if (v && (v === "ban" || v === "kick" || v === "derank" || v === "unrank")) { const s = v === "unrank" ? "derank" : v; db.set(`updatesanction_${message.guild.id}`, s); message.channel.send(`Désormais quand quelqu'un **modifiera le serveur** il se fera \`${s}\` `); updateembed2(msg); } else if (v !== null) message.channel.send("C'est soit `ban`, `kick` ou `derank` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "updatewl") { const v = await askYesNo("Est ce que **je dois punir les personnes whitelist qui modifieront le serveur ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`updatewl_${message.guild.id}`, true); message.channel.send(`Les whitelists ne peuvent pas bypass le module`); updateembed2(msg); } else if (v === "non") { db.set(`updatewl_${message.guild.id}`, null); message.channel.send(`Les whitelists peuvent maintenant bypass le module`); updateembed2(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
            });
          }

          // ── CHANNELCREATE ─────────────────────────────────────────────────────
          else if (customId === message.id + "channelcreate") {
            const buttons = [...makeModuleButtons('', ['channelcactif','channelcsanctions','channelscwl']), new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "channelcdel").setEmoji("<a:_:1483497365863399536>")];
            const m = await sendSubMenu('Création de salon', ['Modifier l\'activité','Modifier la sanction','Modifier la whitelist bypass'], buttons);
            const col = m.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, time: 300000 });
            col.on('collect', async (bi) => {
              await bi.deferUpdate();
              if (bi.customId === message.id + "channelcdel") { m.delete().catch(() => {}); return; }
              if (bi.customId === message.id + "channelcactif") { const v = await askYesNo("Est ce que **je dois punir les personnes qui créeront des salons ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`channelscreate_${message.guild.id}`, true); message.channel.send("Le module a été activé"); updateembed2(msg); } else if (v === "non") { db.set(`channelscreate_${message.guild.id}`, null); message.channel.send("Le module a été désactivé"); updateembed2(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "channelcsanctions") { const v = await askText("Qu'est ce que je dois faire **quand quelqu'un créera un salon ?** (`ban`, `kick`, `derank`)"); if (v && (v === "ban" || v === "kick" || v === "derank" || v === "unrank")) { const s = v === "unrank" ? "derank" : v; db.set(`channelscreatesanction_${message.guild.id}`, s); message.channel.send(`Désormais quand quelqu'un **créera un salon** il se fera \`${s}\` `); updateembed2(msg); } else if (v !== null) message.channel.send("C'est soit `ban`, `kick` ou `derank` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "channelscwl") { const v = await askYesNo("Est ce que **je dois punir les personnes whitelist qui créeront des salons ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`channelscreatewl_${message.guild.id}`, true); message.channel.send(`Les whitelists ne peuvent pas bypass le module`); updateembed2(msg); } else if (v === "non") { db.set(`channelscreatewl_${message.guild.id}`, null); message.channel.send(`Les whitelists peuvent maintenant bypass le module`); updateembed2(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
            });
          }

          // ── CHANNELMODIF ──────────────────────────────────────────────────────
          else if (customId === message.id + "channelmodif") {
            const buttons = [...makeModuleButtons('', ['channelmodifactif','channelmodifsanction','channelmodifwl']), new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "channelmodifanu").setEmoji("<a:_:1483497365863399536>")];
            const m = await sendSubMenu('Modification de salon', ['Modifier l\'activité','Modifier la sanction','Modifier la whitelist bypass'], buttons);
            const col = m.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, time: 300000 });
            col.on('collect', async (bi) => {
              await bi.deferUpdate();
              if (bi.customId === message.id + "channelmodifanu") { m.delete().catch(() => {}); return; }
              if (bi.customId === message.id + "channelmodifactif") { const v = await askYesNo("Est ce que **je dois punir les personnes qui modifieront des salons ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`channelsmod_${message.guild.id}`, true); message.channel.send("Le module a été activé"); updateembed2(msg); } else if (v === "non") { db.set(`channelsmod_${message.guild.id}`, null); message.channel.send("Le module a été désactivé"); updateembed2(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "channelmodifsanction") { const v = await askText("Qu'est ce que je dois faire **quand quelqu'un modifiera un salon ?** (`ban`, `kick`, `derank`)"); if (v && (v === "ban" || v === "kick" || v === "derank" || v === "unrank")) { const s = v === "unrank" ? "derank" : v; db.set(`channelsmodsanction_${message.guild.id}`, s); message.channel.send(`Désormais quand quelqu'un **modifiera un salon** il se fera \`${s}\` `); updateembed2(msg); } else if (v !== null) message.channel.send("C'est soit `ban`, `kick` ou `derank` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "channelmodifwl") { const v = await askYesNo("Est ce que **je dois punir les personnes whitelist qui modifieront des salons ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`channelsmodwl_${message.guild.id}`, true); message.channel.send(`Les whitelists ne peuvent pas bypass le module`); updateembed2(msg); } else if (v === "non") { db.set(`channelsmodwl_${message.guild.id}`, null); message.channel.send(`Les whitelists peuvent maintenant bypass le module`); updateembed2(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
            });
          }

          // ── CHANNELDEL ────────────────────────────────────────────────────────
          else if (customId === message.id + "channeldel") {
            const buttons = [...makeModuleButtons('', ['channeldelactif','channeldelsanction','channeldelwl']), new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "channeldelanu").setEmoji("<a:_:1483497365863399536>")];
            const m = await sendSubMenu('Suppression de salon', ['Modifier l\'activité','Modifier la sanction','Modifier la whitelist bypass'], buttons);
            const col = m.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, time: 300000 });
            col.on('collect', async (bi) => {
              await bi.deferUpdate();
              if (bi.customId === message.id + "channeldelanu") { m.delete().catch(() => {}); return; }
              if (bi.customId === message.id + "channeldelactif") { const v = await askYesNo("Est ce que **je dois punir les personnes qui supprimeront des salons ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`channelsdel_${message.guild.id}`, true); message.channel.send("Le module a été activé"); updateembed2(msg); } else if (v === "non") { db.set(`channelsdel_${message.guild.id}`, null); message.channel.send("Le module a été désactivé"); updateembed2(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "channeldelsanction") { const v = await askText("Qu'est ce que je dois faire **quand quelqu'un supprimera un salon ?** (`ban`, `kick`, `derank`)"); if (v && (v === "ban" || v === "kick" || v === "derank" || v === "unrank")) { const s = v === "unrank" ? "derank" : v; db.set(`channelsdelsanction_${message.guild.id}`, s); message.channel.send(`Désormais quand quelqu'un **supprimera un salon** il se fera \`${s}\` `); updateembed2(msg); } else if (v !== null) message.channel.send("C'est soit `ban`, `kick` ou `derank` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "channeldelwl") { const v = await askYesNo("Est ce que **je dois punir les personnes whitelist qui supprimeront des salons ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`channelsdelwl_${message.guild.id}`, true); message.channel.send(`Les whitelists ne peuvent pas bypass le module`); updateembed2(msg); } else if (v === "non") { db.set(`channelsdelwl_${message.guild.id}`, null); message.channel.send(`Les whitelists peuvent maintenant bypass le module`); updateembed2(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
            });
          }

          // ── ANTIBOT ───────────────────────────────────────────────────────────
          else if (customId === message.id + "antibot") {
            const buttons = [...makeModuleButtons('', ['antibotactif','antibotpuni','antibotwl']), new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "antibotanu").setEmoji("<a:_:1483497365863399536>")];
            const m = await sendSubMenu('Ajout de bot', ['Modifier l\'activité','Modifier la sanction','Modifier la whitelist bypass'], buttons);
            const col = m.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, time: 300000 });
            col.on('collect', async (bi) => {
              await bi.deferUpdate();
              if (bi.customId === message.id + "antibotanu") { m.delete().catch(() => {}); return; }
              if (bi.customId === message.id + "antibotactif") { const v = await askYesNo("Est ce que **je dois punir les personnes qui ajouteront des bots ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`bot_${message.guild.id}`, true); message.channel.send("Le module a été activé"); updateembed2(msg); } else if (v === "non") { db.set(`bot_${message.guild.id}`, null); message.channel.send("Le module a été désactivé"); updateembed2(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "antibotpuni") { const v = await askText("Qu'est ce que je dois faire **quand quelqu'un ajoutera un bot ?** (`ban`, `kick`, `derank`)"); if (v && (v === "ban" || v === "kick" || v === "derank" || v === "unrank")) { const s = v === "unrank" ? "derank" : v; db.set(`botsanction_${message.guild.id}`, s); message.channel.send(`Désormais quand quelqu'un **ajoutera un bot** il se fera \`${s}\` `); updateembed2(msg); } else if (v !== null) message.channel.send("C'est soit `ban`, `kick` ou `derank` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "antibotwl") { const v = await askYesNo("Est ce que **je dois punir les personnes whitelist qui ajouteront des bots ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`botwl_${message.guild.id}`, true); message.channel.send(`Les whitelists ne peuvent pas bypass le module`); updateembed2(msg); } else if (v === "non") { db.set(`botwl_${message.guild.id}`, null); message.channel.send(`Les whitelists peuvent maintenant bypass le module`); updateembed2(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
            });
          }

          // ── ANTIBAN ───────────────────────────────────────────────────────────
          else if (customId === message.id + "antiban") {
            const buttons = [...makeModuleButtons('', ['banactif','bansanction','banwl']), new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "bananu").setEmoji("<a:_:1483497365863399536>")];
            const m = await sendSubMenu('Anti Mass Ban', ['Modifier l\'activité','Modifier la sanction','Modifier la whitelist bypass'], buttons);
            const col = m.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, time: 300000 });
            col.on('collect', async (bi) => {
              await bi.deferUpdate();
              if (bi.customId === message.id + "bananu") { m.delete().catch(() => {}); return; }
              if (bi.customId === message.id + "banactif") { const v = await askYesNo("Est ce que **je dois punir les personnes qui banniront des membres ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`massban_${message.guild.id}`, true); message.channel.send("Le module a été activé"); updateembed3(msg); } else if (v === "non") { db.set(`massban_${message.guild.id}`, null); message.channel.send("Le module a été désactivé"); updateembed3(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "bansanction") { const v = await askText("Qu'est ce que je dois faire **quand quelqu'un bannira des membres ?** (`ban`, `kick`, `derank`)"); if (v && (v === "ban" || v === "kick" || v === "derank" || v === "unrank")) { const s = v === "unrank" ? "derank" : v; db.set(`massbansanction_${message.guild.id}`, s); message.channel.send(`Désormais quand quelqu'un **bannira des membres** il se fera \`${s}\` `); updateembed3(msg); } else if (v !== null) message.channel.send("C'est soit `ban`, `kick` ou `derank` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "banwl") { const v = await askYesNo("Est ce que **je dois punir les personnes whitelist qui banniront des membres ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`massbanwl_${message.guild.id}`, true); message.channel.send(`Les whitelists ne peuvent pas bypass le module`); updateembed3(msg); } else if (v === "non") { db.set(`massbanwl_${message.guild.id}`, null); message.channel.send(`Les whitelists peuvent maintenant bypass le module`); updateembed3(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
            });
          }

          // ── ANTILINK ──────────────────────────────────────────────────────────
          else if (customId === message.id + "antilink") {
            const buttons = [...makeModuleButtons('', ['linkactif','linkwl','linktype']), new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "linkanu").setEmoji("<a:_:1483497365863399536>")];
            const m = await sendSubMenu('Message contenant un lien', ['Modifier l\'activité','Modifier la whitelist bypass','Modifier le type'], buttons);
            const col = m.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, time: 300000 });
            col.on('collect', async (bi) => {
              await bi.deferUpdate();
              if (bi.customId === message.id + "linkanu") { m.delete().catch(() => {}); return; }
              if (bi.customId === message.id + "linkactif") { const v = await askYesNo("Est ce que **je dois punir les personnes qui enverront des liens ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`link_${message.guild.id}`, true); message.channel.send("Le module a été activé"); updateembed3(msg); } else if (v === "non") { db.set(`link_${message.guild.id}`, null); message.channel.send("Le module a été désactivé"); updateembed3(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "linktype") { const v = await askText("Quel est **le type de lien que je dois prendre en compte ?** (`invite`, `all`)"); if (v === "invite") { db.set(`linktype_${message.guild.id}`, "Invite"); message.channel.send("Je ne prendrai en compte que les liens d'invitation"); updateembed3(msg); } else if (v === "all") { db.set(`linktype_${message.guild.id}`, "All"); message.channel.send("Je prendrai en compte tous les types de liens"); updateembed3(msg); } else if (v !== null) message.channel.send("C'est soit `invite` ou `all` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "linkwl") { const v = await askYesNo("Est ce que **je dois punir les personnes whitelist qui enverront des liens ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`linkwl_${message.guild.id}`, true); message.channel.send(`Les whitelists ne peuvent pas bypass le module`); updateembed3(msg); } else if (v === "non") { db.set(`linkwl_${message.guild.id}`, null); message.channel.send(`Les whitelists peuvent maintenant bypass le module`); updateembed3(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
            });
          }

          // ── ANTIMASSJOIN ──────────────────────────────────────────────────────
          else if (customId === message.id + "antimassjoin") {
            const buttons = [
              new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "tokenactif").setEmoji("1️⃣"),
              new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "tokenlimit").setEmoji("2️⃣"),
              new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "tokenanu").setEmoji("<a:_:1483497365863399536>")
            ];
            const m = await sendSubMenu('Multiplication de join', ['Modifier l\'activité','Modifier la limite'], buttons);
            const col = m.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, time: 300000 });
            col.on('collect', async (bi) => {
              await bi.deferUpdate();
              if (bi.customId === message.id + "tokenanu") { m.delete().catch(() => {}); return; }
              if (bi.customId === message.id + "tokenactif") { const v = await askYesNo("Est ce que **je dois expulser les personnes qui rejoindront en même temps ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`antitoken_${message.guild.id}`, true); message.channel.send("Le module a été activé"); updateembed3(msg); } else if (v === "non") { db.set(`antitoken_${message.guild.id}`, null); message.channel.send("Le module a été désactivé"); updateembed3(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "tokenlimit") {
                const v1 = await askText("Au bout de combien **de joins je commence à expulser ?** (*ex: 2*)");
                if (v1 === null) { m.delete().catch(() => {}); return; }
                if (isNaN(v1)) { message.channel.send("Ceci n'est pas un nombre"); m.delete().catch(() => {}); return; }
                const v2 = await askText(`Au bout de combien **de temps je commence à expulser ?** (*ex: 10s*)`);
                if (v2 === null) { m.delete().catch(() => {}); return; }
                if (!ms(v2.replace("j", "d"))) { message.channel.send("Temps incorrect."); m.delete().catch(() => {}); return; }
                db.set(`antitokenlimmit1_${message.guild.id}`, v1);
                db.set(`antitokenlimmit2_${message.guild.id}`, v2);
                message.channel.send(`Si **${v1}** utilisateurs rejoignent en moins de **${v2}** ils se feront expulser !`);
                updateembed3(msg);
                m.delete().catch(() => {});
              }
            });
          }

          // ── ANTITOKEN (Anti Nouveau Compte) ────────────────────────────────────
          else if (customId === message.id + "antitoken") {
            const buttons = [
              new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "actiftoken").setEmoji("1️⃣"),
              new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "tokenlimitcrea").setEmoji("2️⃣"),
              new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "antitokenanu").setEmoji("<a:_:1483497365863399536>")
            ];
            const m = await sendSubMenu('Anti token (Nouveau Compte)', ['Modifier l\'activité','Modifier la limite d\'âge'], buttons);
            const col = m.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, time: 300000 });
            col.on('collect', async (bi) => {
              await bi.deferUpdate();
              if (bi.customId === message.id + "antitokenanu") { m.delete().catch(() => {}); return; }
              if (bi.customId === message.id + "actiftoken") { const v = await askYesNo("Est ce que **je dois expulser les comptes récents ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`crealimit_${message.guild.id}`, true); message.channel.send("Le module a été activé"); updateembed3(msg); } else if (v === "non") { db.set(`crealimit_${message.guild.id}`, null); message.channel.send("Le module a été désactivé"); updateembed3(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "tokenlimitcrea") { const v = await askText("Quel **âge minimum doit avoir un compte pour rejoindre ?** (*ex: 7d, 24h*)"); if (v === null) { m.delete().catch(() => {}); return; } const msVal = ms(v.replace("j", "d")); if (!msVal) { message.channel.send("Temps incorrect."); m.delete().catch(() => {}); return; } db.set(`crealimittemps_${message.guild.id}`, msVal); message.channel.send(`Les comptes de moins de **${v}** seront expulsés !`); updateembed3(msg); m.delete().catch(() => {}); }
            });
          }

          // ── ANTIDECO (Mass Kick/Deaf/Mute) ─────────────────────────────────────
          else if (customId === message.id + "antideco") {
            const buttons = [...makeModuleButtons('', ['antidecoactif','antidecosanc','antidecowl']), new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "antidecoanu").setEmoji("<a:_:1483497365863399536>")];
            const m = await sendSubMenu('Anti Mass Kick/Deaf/Mute', ['Modifier l\'activité','Modifier la sanction','Modifier la whitelist bypass'], buttons);
            const col = m.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, time: 300000 });
            col.on('collect', async (bi) => {
              await bi.deferUpdate();
              if (bi.customId === message.id + "antidecoanu") { m.delete().catch(() => {}); return; }
              if (bi.customId === message.id + "antidecoactif") { const v = await askYesNo("Est ce que **je dois punir les personnes qui kickeront/sourdineront des membres ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`antideco_${message.guild.id}`, true); message.channel.send("Le module a été activé"); updateembed3(msg); } else if (v === "non") { db.set(`antideco_${message.guild.id}`, null); message.channel.send("Le module a été désactivé"); updateembed3(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "antidecosanc") { const v = await askText("Qu'est ce que je dois faire **quand quelqu'un kickera/sourdine des membres ?** (`ban`, `kick`, `derank`)"); if (v && (v === "ban" || v === "kick" || v === "derank" || v === "unrank")) { const s = v === "unrank" ? "derank" : v; db.set(`antidecosanction_${message.guild.id}`, s); message.channel.send(`Désormais il se fera \`${s}\` `); updateembed3(msg); } else if (v !== null) message.channel.send("C'est soit `ban`, `kick` ou `derank` ! Recommence !"); m.delete().catch(() => {}); }
              if (bi.customId === message.id + "antidecowl") { const v = await askYesNo("Est ce que **je dois punir les personnes whitelist ?** (`oui` ou `non`)"); if (v === "oui") { db.set(`antidecowl_${message.guild.id}`, true); message.channel.send(`Les whitelists ne peuvent pas bypass le module`); updateembed3(msg); } else if (v === "non") { db.set(`antidecowl_${message.guild.id}`, null); message.channel.send(`Les whitelists peuvent maintenant bypass le module`); updateembed3(msg); } else if (v !== null) message.channel.send("C'est soit `oui` ou `non` ! Recommence !"); m.delete().catch(() => {}); }
            });
          }

        });

        collector.on('end', () => { msg.edit({ components: [] }).catch(() => {}); });

      }
    }

    // ── UPDATEEMBED FUNCTIONS (V2) ─────────────────────────────────────────────

    function getValues() {
      return {
        webhookCreate: db.get(`webhook_${message.guild.id}`),
        webhookCreate2: db.get(`webhooksanction_${message.guild.id}`) ?? "kick",
        webhookCreate3: db.get(`webhookwl_${message.guild.id}`),
        roleCreate: db.get(`rolescreate_${message.guild.id}`),
        roleCreate2: db.get(`rolescreatesanction_${message.guild.id}`) ?? "derank",
        roleCreate3: db.get(`rolescreatewl_${message.guild.id}`),
        roleDel: db.get(`rolesdel_${message.guild.id}`),
        roleDel2: db.get(`rolesdelsanction_${message.guild.id}`) ?? "derank",
        roleDel3: db.get(`rolesdelwl_${message.guild.id}`),
        roleMod: db.get(`rolesmod_${message.guild.id}`),
        roleMod2: db.get(`rolesmodsanction_${message.guild.id}`) ?? "derank",
        roleMod3: db.get(`rolesmodwl_${message.guild.id}`),
        roleAdd: db.get(`rolesadd_${message.guild.id}`),
        roleAdd2: db.get(`rolesaddsanction_${message.guild.id}`) ?? "derank",
        roleAdd3: db.get(`rolesaddwl_${message.guild.id}`),
        channelCreate: db.get(`channelscreate_${message.guild.id}`),
        channelCreate2: db.get(`channelscreatesanction_${message.guild.id}`) ?? "derank",
        channelDel: db.get(`channelsdel_${message.guild.id}`),
        channelDel2: db.get(`channelsdelsanction_${message.guild.id}`) ?? "derank",
        channelMod: db.get(`channelsmod_${message.guild.id}`),
        channelMod2: db.get(`channelsmodsanction_${message.guild.id}`) ?? "derank",
        update: db.get(`update_${message.guild.id}`),
        update2: db.get(`updatesanction_${message.guild.id}`) ?? "derank",
        ban: db.get(`massban_${message.guild.id}`),
        ban2: db.get(`massbansanction_${message.guild.id}`) ?? "derank",
        ban4: db.get(`massbannum_${message.guild.id}`) || "2",
        ban5: db.get(`massbantime_${message.guild.id}`) || "10s",
        deco: db.get(`antideco_${message.guild.id}`),
        deco2: db.get(`antidecosanction_${message.guild.id}`) ?? "derank",
        deco4: db.get(`antideconum_${message.guild.id}`) || "3",
        deco5: db.get(`antidecotime_${message.guild.id}`) || "10s",
        link: db.get(`link_${message.guild.id}`),
        link4: db.get(`linktype_${message.guild.id}`) || "Invite",
        bot: db.get(`bot_${message.guild.id}`),
        bot2: db.get(`botsanction_${message.guild.id}`) ?? "derank",
        antimassjoin: db.get(`antitoken_${message.guild.id}`),
        antimassjoin2: db.get(`antitokenlimmit1_${message.guild.id}`) || 10,
        antimassjoin3: db.get(`antitokenlimmit2_${message.guild.id}`) || "10s",
        antitoken: db.get(`crealimit_${message.guild.id}`),
        antitoken2: db.get(`crealimittemps_${message.guild.id}`) || "0s",
      };
    }

    function updateembed1(msg) {
      const v = getValues();
      const raidlogChannel = db.get(`${message.guild.id}.raidlog`);
      const raidlogText = raidlogChannel ? `Salon de raidlog: <#${raidlogChannel}>` : '';

      const desc = [
        `${onoff(v.webhookCreate)} **Anti Webhook Create**\n<:_:1483497382279643207> Sanction: \`${v.webhookCreate2}\``,
        `${onoff(v.roleCreate)} **Anti Rôle Create**\n<:_:1483497382279643207> Sanction: \`${v.roleCreate2}\``,
        `${onoff(v.roleMod)} **Anti Rôle Edit**\n<:_:1483497382279643207> Sanction: \`${v.roleMod2}\``,
        `${onoff(v.roleDel)} **Anti Rôle Delete**\n<:_:1483497382279643207> Sanction: \`${v.roleDel2}\``,
        `${onoff(v.roleAdd)} **Anti Rôle Add**\n<:_:1483497382279643207> Sanction: \`${v.roleAdd2}\``,
      ].join('\n\n');

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "webhook").setEmoji("1️⃣"),
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "rolecreate").setEmoji("2️⃣"),
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "rolemodif").setEmoji("3️⃣"),
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "roledel").setEmoji("4️⃣"),
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "addrole").setEmoji("5️⃣")
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Primary).setCustomId(message.id + "on").setLabel("Activer tous les modules"),
        new ButtonBuilder().setStyle(ButtonStyle.Danger).setCustomId(message.id + "off").setLabel("Désactiver tous les modules"),
        new ButtonBuilder().setStyle(ButtonStyle.Success).setCustomId(message.id + "max").setLabel("Activer en mode max")
      );
      const row3 = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "return2").setLabel("▶"));

      msg.edit({ content: raidlogText, components: [container(txt('## 🛡️ Configuration Anti-Raid'), sep(), txt(desc), sep(), txt('*Page 1/3*')), row1, row2, row3], flags: FLAGS }).catch(console.error);
    }

    function updateembed2(msg) {
      const v = getValues();
      const raidlogChannel = db.get(`${message.guild.id}.raidlog`);
      const raidlogText = raidlogChannel ? `Salon de raidlog: <#${raidlogChannel}>` : '';

      const desc = [
        `${onoff(v.update)} **Anti Serveur Check**\n<:_:1483497382279643207> Sanction: \`${v.update2}\``,
        `${onoff(v.channelCreate)} **Anti Salon Create**\n<:_:1483497382279643207> Sanction: \`${v.channelCreate2}\``,
        `${onoff(v.channelMod)} **Anti Salon Edit**\n<:_:1483497382279643207> Sanction: \`${v.channelMod2}\``,
        `${onoff(v.channelDel)} **Anti Salon Delete**\n<:_:1483497382279643207> Sanction: \`${v.channelDel2}\``,
        `${onoff(v.bot)} **Anti Bot Add**\n<:_:1483497382279643207> Sanction: \`${v.bot2}\``,
      ].join('\n\n');

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "update").setEmoji("1️⃣"),
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "channelcreate").setEmoji("2️⃣"),
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "channelmodif").setEmoji("3️⃣"),
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "channeldel").setEmoji("4️⃣"),
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "antibot").setEmoji("5️⃣")
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Primary).setCustomId(message.id + "2on").setLabel("Activer tous les modules"),
        new ButtonBuilder().setStyle(ButtonStyle.Danger).setCustomId(message.id + "2off").setLabel("Désactiver tous les modules"),
        new ButtonBuilder().setStyle(ButtonStyle.Success).setCustomId(message.id + "2max").setLabel("Activer en mode max")
      );
      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "return1").setLabel("◀"),
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "return25").setLabel("▶")
      );

      msg.edit({ content: raidlogText, components: [container(txt('## 🛡️ Configuration Anti-Raid'), sep(), txt(desc), sep(), txt('*Page 2/3*')), row1, row2, row3], flags: FLAGS }).catch(console.error);
    }

    function updateembed3(msg) {
      const v = getValues();
      const raidlogChannel = db.get(`${message.guild.id}.raidlog`);
      const raidlogText = raidlogChannel ? `Salon de raidlog: <#${raidlogChannel}>` : '';
      const antitokenMs = v.antitoken2 !== null && v.antitoken2 !== "0s" ? ms(v.antitoken2) : "0s";

      const desc = [
        `${onoff(v.ban)} **Anti Ban**\n<:_:1483497382279643207> Sanction: \`${v.ban2}\`\n<:_:1483497405696704674> Limite: \`${v.ban4}/${v.ban5}\``,
        `${onoff(v.antimassjoin)} **Anti Mass Join**\n<:_:1483497405696704674> Limite: \`${v.antimassjoin2}/${v.antimassjoin3}\``,
        `${onoff(v.antitoken)} **Anti Nouveau Compte**\n<:_:1483497405696704674> Temps: \`${antitokenMs}\``,
        `${onoff(v.deco)} **Anti Mass Kick/Deaf/Mute**\n<:_:1483497382279643207> Sanction: \`${v.deco2}\`\n<:_:1483497405696704674> Limite: \`${v.deco4}/${v.deco5}\``,
        `${onoff(v.link)} **Anti Link**\n<:_:1483497414575915268> Type de Lien: \`${v.link4}\``,
      ].join('\n\n');

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "antiban").setEmoji("1️⃣"),
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "antimassjoin").setEmoji("2️⃣"),
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "antitoken").setEmoji("3️⃣"),
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "antideco").setEmoji("4️⃣"),
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "antilink").setEmoji("5️⃣")
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Primary).setCustomId(message.id + "3on").setLabel("Activer tous les modules"),
        new ButtonBuilder().setStyle(ButtonStyle.Danger).setCustomId(message.id + "3off").setLabel("Désactiver tous les modules"),
        new ButtonBuilder().setStyle(ButtonStyle.Success).setCustomId(message.id + "3max").setLabel("Activer en mode max")
      );
      const row3 = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(message.id + "return15").setLabel("◀"));

      msg.edit({ content: raidlogText, components: [container(txt('## 🛡️ Configuration Anti-Raid'), sep(), txt(desc), sep(), txt('*Page 3/3*')), row1, row2, row3], flags: FLAGS }).catch(console.error);
    }
  }
};
