const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = async (client, member) => {
  try {
    const guildId = member.guild.id;
    const cfg = db.get(`captcha_${guildId}`);

    if (!cfg || !cfg.enabled || !cfg.channelId || !cfg.roleId) return;

    // Assigner le rôle quarantaine si configuré
    if (cfg.muteRoleId) {
      const muteRole = member.guild.roles.cache.get(cfg.muteRoleId);
      if (muteRole) {
        await member.roles.add(muteRole, '[CAPTCHA] Membre non-vérifié — quarantaine').catch(() => {});
      }
    }

    const channel = member.guild.channels.cache.get(cfg.channelId);
    if (!channel) return;

    const verifyBtn = new ButtonBuilder()
      .setCustomId(`captcha_verify_${member.user.id}`)
      .setLabel('✅ Je suis humain — Cliquez pour vous vérifier')
      .setStyle(ButtonStyle.Success);

    const lines = [
      `Bienvenue <@${member.user.id}> !`,
      'Pour accéder au serveur, cliquez sur le bouton ci-dessous.',
    ];
    if (cfg.muteRoleId) {
      lines.push('', '🔒 *Votre accès est restreint jusqu\'à votre vérification.*');
    }
    lines.push('', `*Ce bouton est uniquement destiné à <@${member.user.id}>.*`);

    const msgContent = container(
      txt(`## 🔐 Vérification — ${member.user.username}`),
      sep(),
      txt(lines.join('\n'))
    );

    const verifyMsg = await channel.send({
      components: [msgContent, new ActionRowBuilder().addComponents(verifyBtn)],
      flags: FLAGS
    });

    // Supprimer le message après 10 minutes s'il n'a pas été utilisé
    setTimeout(() => verifyMsg.delete().catch(() => {}), 10 * 60 * 1000);

  } catch (err) {
    console.error('[captcha] guildMemberAdd error:', err);
  }
};
