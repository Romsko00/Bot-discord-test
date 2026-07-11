const { container, txt, sep, row, btn, reply, errorContainer, FLAGS, ButtonStyle } = require('../../utils/v2');
const db = require('../../utils/simpledb');

const activityTypeMap = { play: 0, stream: 1, listen: 2, watch: 3, competing: 5 };
const activityTypeLabels = { 0: 'Joue à', 1: 'Streame', 2: 'Écoute', 3: 'Regarde', 5: 'Participe à' };
const statusMap = { dnd: 'dnd', idle: 'idle', online: 'online', offline: 'offline', invisible: 'invisible' };

module.exports = {
  name: 'botconfig',
  aliases: ['setprofil', 'botprofile'],
  description: 'Configure les paramètres du bot',
  category: 'bot',
  level: 7,
  run: async (client, message) => {
    const canUse = (client.config.superadmin?.includes(message.author.id)) || (client.config.owners?.includes(message.author.id)) || db.get(`ownermd_${client.user.id}_${message.author.id}`) === true;
    if (!canUse) return reply(message, errorContainer('**Permission insuffisante.**'));

    const buildMenu = () => {
      const currentActivity = client.user.presence?.activities?.[0];
      const actText = currentActivity ? `${activityTypeLabels[currentActivity.type] || ''} ${currentActivity.name}` : 'Aucune';
      const antijoin = db.get(`antijoinbot_${client.user.id}`) ? '✅ Activée' : '❌ Désactivée';
      return container(
        txt(`## ⚙️ Configuration — ${client.user.username}`),
        sep(),
        txt([
          `**1️⃣ Nom :** \`${client.user.username}\``,
          `**2️⃣ Avatar :** [Voir](${client.user.displayAvatarURL({ size: 4096 })})`,
          `**3️⃣ Activité :** ${actText}`,
          `**4️⃣ Présence :** \`${client.user.presence?.status || 'online'}\``,
          `**5️⃣ Anti-invitations :** ${antijoin}`
        ].join('\n')),
        row(
          btn('bc_name', '1️⃣ Nom', ButtonStyle.Secondary),
          btn('bc_avatar', '2️⃣ Avatar', ButtonStyle.Secondary),
          btn('bc_activity', '3️⃣ Activité', ButtonStyle.Secondary),
          btn('bc_status', '4️⃣ Présence', ButtonStyle.Secondary),
          btn('bc_antijoin', '5️⃣ Anti-invit', ButtonStyle.Secondary)
        ),
        row(btn('bc_cancel', '❌ Annuler', ButtonStyle.Danger))
      );
    };

    const sent = await reply(message, buildMenu());
    const collector = sent.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300000 });

    const ask = async (q) => {
      const qMsg = await message.channel.send(q).catch(() => null);
      try {
        const col = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 60000, errors: ['time'] });
        const resp = col.first();
        await resp.delete().catch(() => {});
        await qMsg?.delete().catch(() => {});
        return resp.content;
      } catch { await qMsg?.delete().catch(() => {}); throw new Error('Temps écoulé'); }
    };

    collector.on('collect', async interaction => {
      await interaction.deferUpdate().catch(() => {});
      try {
        if (interaction.customId === 'bc_cancel') { collector.stop(); return; }
        if (interaction.customId === 'bc_name') {
          const val = await ask('**Nouveau nom du bot** ? (2-32 caractères)');
          if (val.length < 2 || val.length > 32) throw new Error('Nom invalide (2-32 caractères).');
          await client.user.setUsername(val);
          await new Promise(r => setTimeout(r, 2000));
        }
        if (interaction.customId === 'bc_avatar') {
          const url = await ask('**Nouvelle URL d\'avatar** ?');
          if (!url.startsWith('http')) throw new Error('URL invalide.');
          await client.user.setAvatar(url);
          await new Promise(r => setTimeout(r, 2000));
        }
        if (interaction.customId === 'bc_activity') {
          const typeInput = await ask('**Type** ? (`play`, `stream`, `watch`, `listen`, `competing`)');
          const type = activityTypeMap[typeInput.toLowerCase()];
          if (type === undefined) throw new Error('Type invalide.');
          const name = await ask('**Texte de l\'activité** ?');
          const options = { type };
          if (type === 1) { const url = await ask('**URL du stream** ?'); if (url.startsWith('http')) options.url = url; }
          client.user.setActivity(name, options);
        }
        if (interaction.customId === 'bc_status') {
          const s = await ask('**Statut** ? (`online`, `idle`, `dnd`, `invisible`)');
          const mapped = statusMap[s.toLowerCase()];
          if (!mapped) throw new Error('Statut invalide.');
          client.user.setPresence({ status: mapped });
        }
        if (interaction.customId === 'bc_antijoin') {
          const cur = db.get(`antijoinbot_${client.user.id}`);
          db.set(`antijoinbot_${client.user.id}`, !cur);
        }
        await sent.edit({ components: [buildMenu()], flags: FLAGS }).catch(() => {});
      } catch (err) {
        if (err.message !== 'Temps écoulé') {
          const errMsg = await message.channel.send(`❌ Erreur : ${err.message}`).catch(() => null);
          if (errMsg) setTimeout(() => errMsg.delete().catch(() => {}), 3000);
        }
        await sent.edit({ components: [buildMenu()], flags: FLAGS }).catch(() => {});
      }
    });
    collector.on('end', () => sent.edit({ components: [buildMenu()], flags: FLAGS }).catch(() => {}));
  }
};
