const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { container, txt, sep, reply, errorContainer, FLAGS } = require('../../utils/v2');
const db = require('../../utils/simpledb');

module.exports = {
  name: 'marry',
  aliases: ['proposal'],
  description: 'Demande en mariage RP',
  run: async (client, message) => {
    const target = message.mentions.users.first();
    if (!target) return reply(message, errorContainer('Tu dois mentionner un utilisateur.'));
    if (target.id === message.author.id) return reply(message, errorContainer('Tu ne peux pas te marier avec toi-même !'));
    const aKey = `partner_${message.author.id}`, bKey = `partner_${target.id}`;
    if (db.get(aKey)) return reply(message, errorContainer('Tu es déjà en couple. Utilise `divorce` pour rompre.'));
    if (db.get(bKey)) return reply(message, errorContainer(`${target} est déjà en couple.`));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('marry_accept').setLabel('Accepter 💍').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('marry_decline').setLabel('Refuser 💔').setStyle(ButtonStyle.Danger)
    );

    const msg = await message.channel.send({
      components: [container(txt('## 💍 Demande en Mariage'), sep(), txt(`${message.author} demande ${target} en mariage ! Acceptes-tu ?`)), row],
      flags: FLAGS
    });

    const filter = i => ['marry_accept', 'marry_decline'].includes(i.customId) && i.user.id === target.id;
    try {
      const interaction = await msg.awaitMessageComponent({ filter, time: 60_000 });
      if (interaction.customId === 'marry_accept') {
        db.set(aKey, target.id); db.set(bKey, message.author.id);
        try {
          const ab = db.get(`badges_${message.author.id}`) || []; if (!ab.includes('💍')) db.set(`badges_${message.author.id}`, [...ab, '💍']);
          const bb = db.get(`badges_${target.id}`) || []; if (!bb.includes('💍')) db.set(`badges_${target.id}`, [...bb, '💍']);
        } catch {}
        await interaction.update({ components: [container(txt('## 🎉 Mariage !'), sep(), txt(`${target} a accepté ! Félicitations à ${message.author} et ${target} ! 💍`))], flags: FLAGS });
      } else {
        await interaction.update({ components: [container(txt('## 💔 Refus'), sep(), txt(`${target} a refusé la demande de ${message.author}.`))], flags: FLAGS });
      }
    } catch {
      await msg.edit({ components: [container(txt('## ⏱️ Expiré'), sep(), txt('La demande n\'a pas reçu de réponse.'))], flags: FLAGS }).catch(() => {});
    }
  }
};
