const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { container, txt, sep, FLAGS } = require('../../utils/v2');
const { hasPermissionLevel } = require('../../utils/permissionUtils');
const db = require('../../utils/simpledb');

function buildStatus(g) {
  const get = (k, d = false) => { const v = db.get(`${k}_${g}`); return (v === null || v === undefined) ? d : v; };
  const on = '✅'; const off = '❌';
  const lines = [
    `${get('automod_spam') ? on : off} **Anti-Spam** — Limite: ${db.get(`automod_spam_limit_${g}`) ?? 6} msg/${Math.round((db.get(`automod_spam_window_ms_${g}`) ?? 7000)/1000)}s`,
    `${get('automod_insult') ? on : off} **Anti-Insulte**`,
    `${get('automod_caps') ? on : off} **Anti-Caps**`,
    `${get('automod_emoji') ? on : off} **Anti-Emoji**`,
    `${get('automod_mention') ? on : off} **Anti-Mention** — Limite: ${db.get(`automod_mention_limit_${g}`) || 5}`,
    `${get('automod_ghostping') ? on : off} **Anti-GhostPing**`,
    `${get('automod_invite') ? on : off} **Anti-Invite**`,
    `${get('automod_link') ? on : off} **Anti-Link** — Mode: ${db.get(`automod_link_mode_${g}`) || 'block_all'}`,
    `${get('automod_zalgo') ? on : off} **Anti-Zalgo**`,
    `${get('automod_attach') ? on : off} **Anti-Attach** — Limite: ${db.get(`automod_attach_limit_${g}`) || 3} PJ`,
    `${get('automod_long') ? on : off} **Anti-Long** — Max: ${db.get(`automod_long_limit_${g}`) || 1200} car.`,
    `${get('automod_massjoin') ? on : off} **Anti-MassJoin** — Max: ${db.get(`automod_massjoin_max_${g}`) || 5}/${Math.round((db.get(`automod_massjoin_window_ms_${g}`) || 10000)/1000)}s`,
    `${get('automod_antitoken') ? on : off} **Anti-Token** — Min: ${db.get(`automod_antitoken_min_days_${g}`) || 3}j`,
    `${get('automod_rolespam') ? on : off} **Anti-RoleSpam** — Max: ${db.get(`automod_rolespam_max_per_min_${g}`) || 10}/min`,
    `${get('automod_nickspam') ? on : off} **Anti-NickSpam** — Max: ${db.get(`automod_nickspam_max_per_10m_${g}`) || 3}/10m`,
    `${get('automod_selfbot') ? on : off} **Anti-Selfbot** — Seuil: ${db.get(`automod_selfbot_score_threshold_${g}`) || 3}`,
    `${get('automod_status') ? on : off} **Statut Suspect** — ${(db.get(`automod_status_blacklist_${g}`) || []).length} mots-clés`,
    `${get('automod_nsfwname') ? on : off} **NSFW Username** — ${(db.get(`automod_nsfwname_blacklist_${g}`) || []).length} mots-clés`,
  ];
  return container(txt('## 🛡️ AutoMod — Configuration'), sep(), txt(lines.join('\n')));
}

module.exports = {
  name: 'automod',
  aliases: [],
  description: 'Panneau de configuration AutoMod',

  run: async (client, message, args) => {
    const isOwner = message.guild.ownerId === message.author.id;
    const isBotOwner = client.config.owners?.includes(message.author.id);
    const isSuperadmin = client.config.superadmin?.includes(message.author.id);
    if (!isOwner && !isBotOwner && !isSuperadmin && !hasPermissionLevel(client, message, 6))
      return message.reply({ components: [require('../../utils/v2').errorContainer('Tu dois avoir la permission Gérer le serveur.')], flags: FLAGS });

    const g = message.guild.id;
    const base = (k) => `${k}_${g}`;

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('automod_toggle_spam').setStyle(ButtonStyle.Secondary).setLabel('Anti-Spam'),
      new ButtonBuilder().setCustomId('automod_toggle_insult').setStyle(ButtonStyle.Secondary).setLabel('Anti-Insulte'),
      new ButtonBuilder().setCustomId('automod_toggle_caps').setStyle(ButtonStyle.Secondary).setLabel('Anti-Caps')
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('automod_toggle_emoji').setStyle(ButtonStyle.Secondary).setLabel('Anti-Emoji'),
      new ButtonBuilder().setCustomId('automod_toggle_mention').setStyle(ButtonStyle.Secondary).setLabel('Anti-Mention'),
      new ButtonBuilder().setCustomId('automod_inc_mention').setStyle(ButtonStyle.Success).setLabel('+ Mention'),
      new ButtonBuilder().setCustomId('automod_dec_mention').setStyle(ButtonStyle.Danger).setLabel('- Mention'),
      new ButtonBuilder().setCustomId('automod_toggle_ghostping').setStyle(ButtonStyle.Secondary).setLabel('GhostPing')
    );
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('automod_toggle_invite').setStyle(ButtonStyle.Secondary).setLabel('Anti-Invite'),
      new ButtonBuilder().setCustomId('automod_toggle_link').setStyle(ButtonStyle.Secondary).setLabel('Anti-Link'),
      new ButtonBuilder().setCustomId('automod_link_mode').setStyle(ButtonStyle.Primary).setLabel('Mode Link'),
      new ButtonBuilder().setCustomId('automod_toggle_zalgo').setStyle(ButtonStyle.Secondary).setLabel('Anti-Zalgo')
    );
    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('automod_toggle_attach').setStyle(ButtonStyle.Secondary).setLabel('Anti-Attach'),
      new ButtonBuilder().setCustomId('automod_attach_inc').setStyle(ButtonStyle.Success).setLabel('+ PJ'),
      new ButtonBuilder().setCustomId('automod_attach_dec').setStyle(ButtonStyle.Danger).setLabel('- PJ'),
      new ButtonBuilder().setCustomId('automod_toggle_long').setStyle(ButtonStyle.Secondary).setLabel('Anti-Long'),
      new ButtonBuilder().setCustomId('automod_long_inc').setStyle(ButtonStyle.Success).setLabel('+ Long')
    );
    const row5 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('automod_toggle_massjoin').setStyle(ButtonStyle.Secondary).setLabel('MassJoin'),
      new ButtonBuilder().setCustomId('automod_toggle_antitoken').setStyle(ButtonStyle.Secondary).setLabel('Anti-Token'),
      new ButtonBuilder().setCustomId('automod_toggle_rolespam').setStyle(ButtonStyle.Secondary).setLabel('RoleSpam'),
      new ButtonBuilder().setCustomId('automod_toggle_nickspam').setStyle(ButtonStyle.Secondary).setLabel('NickSpam'),
      new ButtonBuilder().setCustomId('automod_toggle_selfbot').setStyle(ButtonStyle.Secondary).setLabel('Selfbot')
    );
    const row6 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('automod_toggle_status').setStyle(ButtonStyle.Secondary).setLabel('Statut Suspect'),
      new ButtonBuilder().setCustomId('automod_toggle_nsfwname').setStyle(ButtonStyle.Secondary).setLabel('NSFW Username'),
      new ButtonBuilder().setCustomId('automod_spam_limit_inc').setStyle(ButtonStyle.Success).setLabel('+ Spam Lim.'),
      new ButtonBuilder().setCustomId('automod_spam_limit_dec').setStyle(ButtonStyle.Danger).setLabel('- Spam Lim.')
    );
    const sanctionsOpts = [{ label: 'Timeout', value: 'timeout' }, { label: 'Kick', value: 'kick' }, { label: 'Ban', value: 'ban' }, { label: 'Derank', value: 'derank' }];
    const row7 = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_sanction_massjoin').setPlaceholder('Sanction MassJoin').setOptions(sanctionsOpts));
    const row8 = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_sanction_antitoken').setPlaceholder('Sanction Anti-Token').setOptions(sanctionsOpts));

    const controlRows = [row1, row2, row3, row4, row5, row6, row7, row8];
    const PER_PAGE = 4;
    const totalPages = Math.ceil(controlRows.length / PER_PAGE);
    let page = 0;
    const pageRows = (p) => controlRows.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
    const navRow = () => new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('automod_page_prev').setStyle(ButtonStyle.Secondary).setLabel('◀').setDisabled(page === 0),
      new ButtonBuilder().setCustomId('automod_page_info').setStyle(ButtonStyle.Secondary).setLabel(`${page + 1}/${totalPages}`).setDisabled(true),
      new ButtonBuilder().setCustomId('automod_page_next').setStyle(ButtonStyle.Secondary).setLabel('▶').setDisabled(page >= totalPages - 1)
    );

    const msg = await message.channel.send({ components: [buildStatus(g), navRow(), ...pageRows(page)], flags: FLAGS });

    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 120000 });

    collector.on('collect', async (i) => {
      if (i.customId === 'automod_page_prev') { page = Math.max(0, page - 1); }
      else if (i.customId === 'automod_page_next') { page = Math.min(totalPages - 1, page + 1); }
      else if (i.customId.startsWith('automod_toggle_')) {
        const key = i.customId.replace('automod_toggle_', 'automod_');
        db.set(base(key), !(db.get(base(key)) === true));
      } else if (i.customId === 'automod_inc_mention') { db.set(base('automod_mention_limit'), Math.min((db.get(base('automod_mention_limit')) || 5) + 1, 20)); }
      else if (i.customId === 'automod_dec_mention') { db.set(base('automod_mention_limit'), Math.max((db.get(base('automod_mention_limit')) || 5) - 1, 1)); }
      else if (i.customId === 'automod_link_mode') { const modes = ['block_all', 'allowlist', 'block_invites_only']; const cur = db.get(base('automod_link_mode')) || 'block_all'; db.set(base('automod_link_mode'), modes[(modes.indexOf(cur) + 1) % modes.length]); }
      else if (i.customId === 'automod_attach_inc') { db.set(base('automod_attach_limit'), Math.min((db.get(base('automod_attach_limit')) || 3) + 1, 10)); }
      else if (i.customId === 'automod_attach_dec') { db.set(base('automod_attach_limit'), Math.max((db.get(base('automod_attach_limit')) || 3) - 1, 0)); }
      else if (i.customId === 'automod_long_inc') { db.set(base('automod_long_limit'), Math.min((db.get(base('automod_long_limit')) || 1200) + 200, 6000)); }
      else if (i.customId === 'automod_spam_limit_inc') { db.set(base('automod_spam_limit'), Math.min((db.get(base('automod_spam_limit')) ?? 6) + 1, 30)); }
      else if (i.customId === 'automod_spam_limit_dec') { db.set(base('automod_spam_limit'), Math.max((db.get(base('automod_spam_limit')) ?? 6) - 1, 1)); }
      else if (i.isStringSelectMenu?.()) {
        const v = i.values?.[0]; if (!v) { await i.deferUpdate().catch(() => {}); return; }
        const map = { select_sanction_massjoin: 'automod_massjoin_sanction', select_sanction_antitoken: 'automod_antitoken_sanction', select_sanction_rolespam: 'automod_rolespam_sanction', select_sanction_nickspam: 'automod_nickspam_sanction', select_sanction_selfbot: 'automod_selfbot_sanction' };
        if (map[i.customId]) db.set(base(map[i.customId]), v);
      }
      try { await i.update({ components: [buildStatus(g), navRow(), ...pageRows(page)], flags: FLAGS }); } catch (_) {}
    });

    collector.on('end', () => msg.edit({ components: [buildStatus(g)], flags: FLAGS }).catch(() => {}));
  }
};
