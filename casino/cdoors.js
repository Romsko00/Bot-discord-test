const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const Casino = require('../../utils/casino');
const admin = require('../../utils/casinoAdmin');
const db = require('../../utils/simpledb');
const config = require('../../config.json');

module.exports = {
  name: 'cdoors',
  aliases: ['doors'],
  description: 'Choisis la bonne porte — option Monty Hall (switch)',
  usage: '+cdoors <mise>',
  category: 'casino',
  run: async (client, message, args) => {
    if (!message.guild) return;
    const userId = message.author.id;
    const guildId = message.guild.id;
    if (admin.isSuspended(guildId, userId)) return reply(message, errorContainer('Accès casino suspendu.'));
    const allowedCatId = db.get(`casino_category_${guildId}`);
    if (allowedCatId && (!message.channel.parentId || message.channel.parentId !== allowedCatId)) return reply(message, errorContainer('Les jeux du casino sont limités à la catégorie configurée.'));
    const settings = config.CASINO?.DOORS || { MIN_BET: 10, MAX_BET: 1000, COOLDOWN_MS: 3000 };
    const rem = Casino.getCooldownRemaining(userId, 'doors');
    if (rem > 0) return reply(message, errorContainer(`Attends encore ${Casino.formatMs(rem)}.`));
    let bet = parseInt(args[0], 10);
    if (isNaN(bet)) bet = settings.MIN_BET;
    bet = Math.max(settings.MIN_BET, Math.min(settings.MAX_BET, bet));
    if (!Casino.hasEnoughCasino(userId, bet)) return reply(message, errorContainer(`Fonds insuffisants. Solde: ${Casino.getCasinoBalance(userId)} JTN`));
    Casino.deductCasinoCredits(userId, bet);
    const winDoor = Math.floor(Math.random() * 3);
    let picked = null, revealed = null, phase = 'pick', finished = false;

    const makeRow = (ids, labels, styles) => new ActionRowBuilder().addComponents(ids.map((id, i) => new ButtonBuilder().setCustomId(id).setLabel(labels[i]).setStyle(styles[i])));
    const pickRow = makeRow([`drs_p0_${message.id}`, `drs_p1_${message.id}`, `drs_p2_${message.id}`], ['🚪 Porte 1', '🚪 Porte 2', '🚪 Porte 3'], [ButtonStyle.Primary, ButtonStyle.Primary, ButtonStyle.Primary]);

    const msg = await message.channel.send({ components: [container(txt('## 🚪 Doors — Choisis une porte'), sep(), txt(`Mise: ${bet} JTN\nTrois portes. Une seule cache le gain.`)), pickRow], flags: FLAGS });

    const endGame = async (won, interaction = null) => {
      finished = true;
      const gain = won ? bet * 2 : 0;
      if (gain > 0) Casino.addCasinoCredits(userId, gain);
      Casino.setCooldown(userId, 'doors', settings.COOLDOWN_MS || 3000);
      try { Casino.grantGameXp(userId, { game: 'doors', bet, win: won, payout: gain }); } catch {}
      try { Casino.addHistory(userId, 'doors', { bet, payout: gain, win: won, picked, winDoor }); } catch {}
      const finalBal = Casino.getCasinoBalance(userId);
      const resultContainer = container(
        txt(`## 🚪 Doors — ${won ? '🎉 Gagné !' : '😞 Perdu'}`),
        sep(),
        txt([`La porte gagnante était la **${winDoor + 1}**.`, `Mise: ${bet} JTN | Gain: ${gain} JTN | Solde: ${finalBal} JTN`].join('\n'))
      );
      if (interaction) await interaction.update({ components: [resultContainer], flags: FLAGS });
      else await msg.edit({ components: [resultContainer], flags: FLAGS }).catch(() => {});
    };

    const collector = msg.createMessageComponentCollector({ time: 30000, filter: i => i.user.id === userId });
    collector.on('collect', async i => {
      try {
        if (finished) return i.deferUpdate().catch(() => {});
        if (!i.customId.endsWith(`_${message.id}`)) return i.deferUpdate().catch(() => {});
        if (phase === 'pick' && i.customId.startsWith('drs_p')) {
          picked = parseInt(i.customId.split('_')[1].substring(1), 10);
          const candidates = [0, 1, 2].filter(d => d !== picked && d !== winDoor);
          revealed = candidates[Math.floor(Math.random() * candidates.length)];
          phase = 'switch';
          const switchRow = makeRow([`drs_keep_${message.id}`, `drs_switch_${message.id}`], ['✅ Garder', '🔄 Changer'], [ButtonStyle.Success, ButtonStyle.Secondary]);
          return i.update({ components: [container(txt('## 🚪 Doors — Monty Hall'), sep(), txt(`La porte **${revealed + 1}** est perdante.\nVeux-tu garder la porte **${picked + 1}** ou changer ?`)), switchRow], flags: FLAGS });
        }
        if (phase === 'switch') {
          if (i.customId.startsWith('drs_keep_')) return endGame(picked === winDoor, i);
          if (i.customId.startsWith('drs_switch_')) { picked = [0, 1, 2].find(d => d !== picked && d !== revealed); return endGame(picked === winDoor, i); }
        }
        return i.deferUpdate().catch(() => {});
      } catch { try { await i.deferUpdate(); } catch {} }
    });
    collector.on('end', async () => { if (!finished) await msg.edit({ components: [container(txt('## ⏱️ Temps Écoulé'))], flags: FLAGS }).catch(() => {}); });
  }
};
