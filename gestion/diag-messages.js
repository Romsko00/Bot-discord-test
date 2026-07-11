const db = require('../../utils/simpledb');
const { safeSend } = require('../../utils/safeSend');
const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');

module.exports = {
  name: 'diag-messages',
  aliases: ['diag', 'diag-msg', 'diagnose-messages'],
  description: 'Diagnostics des messages de bienvenue/départ/invites',
  category: 'gestion',
  run: async (client, message) => {
    let perm = client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!perm) message.member.roles.cache.forEach(role => { if (db.get(`ownerp_${message.guild.id}_${role.id}`)) perm = true; });
    if (!perm) return reply(message, errorContainer('Permission insuffisante.'));
    const guildId = message.guild.id;
    const configs = {
      welcome: { channelId: db.get(`joinchannelmessage_${guildId}`), message: db.get(`joinmessage_${guildId}`), embed: db.get(`joinmessageembed_${guildId}`) },
      invite: { channelId: db.get(`invitechannelmessage_${guildId}`), message: db.get(`invitemessage_${guildId}`), tracking: db.get(`invitetracking_${guildId}`) },
      leave: { channelId: db.get(`leavechannelmessage_${guildId}`), message: db.get(`leavemessage_${guildId}`), embed: db.get(`leavemessageembed_${guildId}`) }
    };
    const testMsg = async (cfg, type) => {
      const payload = cfg.embed ? { embeds: [cfg.embed] } : cfg.message ? { content: cfg.message } : null;
      if (!payload) return { ok: false, reason: 'Aucun message configuré' };
      try { await safeSend(client, message.guild, cfg.channelId, payload, !!cfg.embed, `DIAG-${type.toUpperCase()}`); return { ok: true }; } catch (e) { return { ok: false, reason: e.message }; }
    };
    const [rW, rI, rL] = await Promise.all([testMsg(configs.welcome,'welcome'), testMsg(configs.invite,'invite'), testMsg(configs.leave,'leave')]);
    const fmt = (name, cfg, r) => [`**${name} :** Salon: ${cfg.channelId ? `<#${cfg.channelId}>` : '❌ Non configuré'} | Contenu: ${(cfg.message||cfg.embed) ? '✅' : '❌'} | Test: ${r.ok ? '✅ Envoyé' : `❌ ${r.reason||'Non configuré'}`}`].join('\n');
    return reply(message, container(txt('## 🔍 Diagnostic des Messages'), sep(), txt([fmt('Welcome', configs.welcome, rW), fmt('Invite', configs.invite, rI), fmt('Leave', configs.leave, rL), '', '*Utilisez `+welcome`, `+leave` pour configurer.*'].join('\n'))));
  }
};
