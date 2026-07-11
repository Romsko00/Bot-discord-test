const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const { container, txt, sep, reply, errorContainer, formatNumber, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

function buildPanel(target, credits, bankBal, level) {
  const reductionPercent = Math.round(Math.min(level * 0.04, 1.0) * 100);
  return container(
    txt(`## 💳 Portefeuille — ${target.user.username}`),
    sep(),
    txt([
      `**💰 Portefeuille :** ${formatNumber(credits)} crédits`,
      `**🏦 Banque :** ${formatNumber(bankBal)} crédits`,
      `**📊 Total :** ${formatNumber(credits + bankBal)} crédits`,
      `**⭐ Niveau :** ${level}`,
      `**🏷️ Réduction Shop :** ${reductionPercent}%`,
    ].join('\n'))
  );
}

function buildRow(isSelf) {
  const depositBtn = new ButtonBuilder()
    .setCustomId('balance_deposit')
    .setLabel('💳 Déposer')
    .setStyle(ButtonStyle.Success)
    .setDisabled(!isSelf);
  const withdrawBtn = new ButtonBuilder()
    .setCustomId('balance_withdraw')
    .setLabel('🏧 Retirer')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!isSelf);
  const closeBtn = new ButtonBuilder()
    .setCustomId('balance_close')
    .setLabel('Fermer')
    .setStyle(ButtonStyle.Secondary);
  return new ActionRowBuilder().addComponents(depositBtn, withdrawBtn, closeBtn);
}

module.exports = {
  name: 'balance',
  aliases: ['bal', 'money', 'credits'],
  description: 'Affiche votre solde de crédits',
  usage: '[@membre]',
  level: 1,
  run: async (client, message, args) => {
    try {
      const target = message.mentions.members.first() ||
        message.guild.members.cache.get(args[0]) || message.member;
      const isSelf = target.id === message.member.id;
      const userId = target.user.id;
      const guildId = message.guild.id;

      const getCredits = () =>
        client.CreditLevelSystem?.getUserCredits?.(userId, guildId) ||
        db.get(`credits_${guildId}_${userId}`) || 0;
      const getBankBal = () => db.get(`bank_balance_${userId}`) || 0;
      const getLevel = () => db.get(`guild_${guildId}_level_${userId}`) || 1;

      const panelMsg = await message.reply({
        components: [buildPanel(target, getCredits(), getBankBal(), getLevel()), buildRow(isSelf)],
        flags: FLAGS
      });

      if (!isSelf) return;

      const timeout = setTimeout(() => panelMsg.edit({ components: [] }).catch(() => {}), 300_000);

      const collector = panelMsg.createMessageComponentCollector({
        filter: i => i.user.id === message.author.id,
        time: 300_000
      });

      const refresh = async () => {
        await panelMsg.edit({
          components: [buildPanel(target, getCredits(), getBankBal(), getLevel()), buildRow(isSelf)],
          flags: FLAGS
        }).catch(() => {});
      };

      collector.on('collect', async interaction => {
        if (interaction.customId === 'balance_close') {
          clearTimeout(timeout);
          collector.stop();
          return interaction.update({ components: [] });
        }

        if (interaction.customId === 'balance_deposit' || interaction.customId === 'balance_withdraw') {
          const isDeposit = interaction.customId === 'balance_deposit';
          const available = isDeposit ? getCredits() : getBankBal();
          const label = isDeposit ? 'Déposer à la banque' : 'Retirer de la banque';

          const modal = new ModalBuilder()
            .setCustomId(`balance_modal_${isDeposit ? 'deposit' : 'withdraw'}`)
            .setTitle(label)
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('amount_input')
                  .setLabel(`Montant (disponible : ${formatNumber(available)})`)
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder('Ex: 1000 ou "tout"')
                  .setRequired(true)
                  .setMaxLength(20)
              )
            );

          await interaction.showModal(modal);

          try {
            const mInter = await interaction.awaitModalSubmit({ time: 60_000, filter: i => i.user.id === message.author.id });
            let rawInput = mInter.fields.getTextInputValue('amount_input').trim().toLowerCase();
            let amount = rawInput === 'tout' || rawInput === 'all' ? available : parseInt(rawInput.replace(/\s/g, ''), 10);

            if (isNaN(amount) || amount <= 0) {
              await mInter.reply({ content: '❌ Montant invalide.', ephemeral: true });
              return;
            }
            if (amount > available) {
              await mInter.reply({ content: `❌ Solde insuffisant. Vous avez **${formatNumber(available)}** crédits ${isDeposit ? 'dans votre portefeuille' : 'en banque'}.`, ephemeral: true });
              return;
            }

            const currentCredits = getCredits();
            const currentBank = getBankBal();

            if (isDeposit) {
              db.set(`credits_${guildId}_${userId}`, currentCredits - amount);
              db.set(`bank_balance_${userId}`, currentBank + amount);
            } else {
              db.set(`bank_balance_${userId}`, currentBank - amount);
              db.set(`credits_${guildId}_${userId}`, currentCredits + amount);
            }

            await mInter.deferUpdate();
            await refresh();
          } catch {}
          return;
        }
      });

      collector.on('end', () => {
        clearTimeout(timeout);
        panelMsg.edit({ components: [] }).catch(() => {});
      });

    } catch (error) {
      console.error('Erreur balance:', error);
      return reply(message, errorContainer('Impossible de récupérer le solde.'));
    }
  }
};
