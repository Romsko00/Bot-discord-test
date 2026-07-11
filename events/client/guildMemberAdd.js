const db = require('../../utils/simpledb');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = async (client, member) => {
  // Dedup cross-clients : un seul bot traite chaque arrivee
  if (!global._handledMemberAdd) global._handledMemberAdd = new Set();
  const memberKey = `${member.guild.id}:${member.id}`;
  if (global._handledMemberAdd.has(memberKey)) return;
  // Ne pas re-add ici (deja fait par invite/guildMemberAdd.js) mais verifier quand meme

  // ── 🔨 Blacklist globale — reban automatique ────────────────────────────────
  // Si le membre est dans la BL globale, on le reban immédiatement
  // même s'il a été débannis manuellement sur ce serveur.
  try {
    const blData = db.get(`bl_global_${member.id}`);
    if (blData) {
      const me = member.guild.members.me;
      if (me?.permissions.has(PermissionFlagsBits.BanMembers)) {
        await member.ban({
          reason: `[BL GLOBAL AUTO] ${blData.reason || 'Blacklist globale'} — par ${blData.modTag || blData.mod}`,
          deleteMessageSeconds: 0,
        }).catch(() => {});

        // Log dans le salon de logs du serveur si configuré
        const logChanId = db.get(`logchannel_${member.guild.id}`);
        if (logChanId) {
          const logCh = member.guild.channels.cache.get(logChanId);
          if (logCh) {
            await logCh.send({ embeds: [
              new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('🔨 Reban automatique — Blacklist Globale')
                .addFields(
                  { name: '👤 Utilisateur', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
                  { name: '📋 Raison BL',   value: blData.reason || 'Non spécifiée',         inline: true },
                  { name: '🛡️ Banni par',   value: blData.modTag || blData.mod || '?',       inline: true },
                )
                .setTimestamp(),
            ]}).catch(() => {});
          }
        }
        return; // Ne pas continuer avec le reste (ghostping, captcha, etc.)
      }
    }
  } catch (e) {
    console.error('[guildMemberAdd] Erreur BL globale:', e);
  }

  // ── Ghost ping ────────────────────────────────────────────────────────────
  try {
    const channelIds = db.get(`ghostping_channels_${member.guild.id}`) || [];
    for (const channelId of channelIds) {
      const channel = member.guild.channels.cache.get(channelId);
      if (!channel) continue;
      try {
        const msg = await channel.send({ content: `<@${member.id}>` });
        setTimeout(() => msg.delete().catch(() => {}), 500);
      } catch {}
    }
  } catch {}

  // ── Captcha ───────────────────────────────────────────────────────────────
  try {
    const g = member.guild.id;
    const enabled = db.get(`captcha_enabled_${g}`) === true;
    if (!enabled) return;
    const channelId = db.get(`captcha_channel_${g}`);
    const roleId = db.get(`captcha_role_${g}`);
    if (!channelId || !roleId) return;
    const verifyChannel = member.guild.channels.cache.get(channelId);
    if (!verifyChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#00cc66')
      .setTitle('Vérification requise')
      .setDescription(`${member}, clique sur le bouton pour te vérifier et obtenir l'accès au serveur.`)
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`captcha_verify_${member.id}`).setLabel('Vérifier').setStyle(ButtonStyle.Success)
    );
    await verifyChannel.send({ content: `${member}`, embeds: [embed], components: [row] });
  } catch (_) {}
};
