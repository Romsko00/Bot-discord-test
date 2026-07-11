const Discord = require('discord.js');
const axios = require('axios');
const db = require('../../utils/simpledb');
const { container, txt, sep, media, reply, errorContainer, FLAGS } = require('../../utils/v2');

const CATEGORIES = {
  ass: { name: '🍑 Ass', description: 'GIFs de fesses' }, gif: { name: '🎬 GIF', description: 'GIFs NSFW' },
  hentai: { name: '🎨 Hentai', description: 'GIFs hentai' }, milf: { name: '👩‍🦳 MILF', description: 'GIFs MILF' },
  oral: { name: '👄 Oral', description: 'Sexe oral' }, paizuri: { name: '🍒 Paizuri', description: 'Paizuri' },
  ecchi: { name: '💕 Ecchi', description: 'Ecchi' }, ero: { name: '🔥 Ero', description: 'Érotique' },
  blowjob: { name: '🥵 Blowjob', description: 'Fellation' }, lesbian: { name: '👭 Lesbian', description: 'Lesbien' },
  anal: { name: '🔞 Anal', description: 'Anal' },
};

module.exports = {
  name: 'porngif', aliases: ['nsfwgif', 'pgif', 'nsfw'],
  level: 1, category: 'nsfw', nsfw: true,
  description: 'Affiche des GIFs NSFW de différentes catégories',
  run: async (client, message, args, prefix) => {
    let perm = false;
    message.member.roles.cache.forEach(r => { if (db.get(`nsfwp_${message.guild.id}_${r.id}`) || db.get(`modsp_${message.guild.id}_${r.id}`) || db.get(`admin_${message.guild.id}_${r.id}`) || db.get(`ownerp_${message.guild.id}_${r.id}`)) perm = true; });
    const nsfwEnabled = db.get(`nsfw_${message.guild.id}`) === true;
    const canUseNSFW = nsfwEnabled || perm || client.config.superadmin?.includes(message.author.id) || client.config.owners?.includes(message.author.id) || db.get(`ownermd_${client.user.id}_${message.author.id}`);
    if (!message.channel.nsfw && !canUseNSFW) return reply(message, errorContainer('Cette commande nécessite un salon NSFW ou une autorisation spéciale.'));

    if (!args[0]) {
      const catMenu = new Discord.StringSelectMenuBuilder().setCustomId('nsfw_category').setPlaceholder('🎭 Choisissez une catégorie').addOptions(Object.entries(CATEGORIES).map(([key, v]) => ({ label: v.name, value: key, description: v.description.slice(0, 50) })));
      const row = new Discord.ActionRowBuilder().addComponents(catMenu);
      const catList = Object.entries(CATEGORIES).map(([k, v]) => `• **${k}** — ${v.description}`).join('\n');
      const sentMessage = await message.reply({ components: [container(txt('## 🎭 Catégories NSFW'), sep(), txt(catList)), row], flags: FLAGS });
      const col = sentMessage.createMessageComponentCollector({ time: 30_000 });
      col.on('collect', async interaction => {
        if (interaction.user.id !== message.author.id) { try { await interaction.reply({ content: 'Réservé au créateur.', ephemeral: true }); } catch {} return; }
        await interaction.deferUpdate();
        await getNSFWGif(client, interaction, interaction.values[0], message);
        col.stop();
      });
      col.on('end', () => sentMessage.edit({ components: [] }).catch(() => {}));
      return;
    }

    const category = args[0].toLowerCase();
    if (!CATEGORIES[category]) return reply(message, errorContainer(`Catégorie **${category}** invalide. Disponibles : ${Object.keys(CATEGORIES).join(', ')}`));
    await getNSFWGif(client, message, category, message);
  }
};

async function getNSFWGif(client, message, category, originalMessage) {
  try {
    await message.channel?.sendTyping?.();
    const apiMap = { hentai: 'hentai', ero: 'ero', lesbian: 'les', blowjob: 'bj' };
    const endpoint = apiMap[category] || category;
    const response = await axios.get(`https://nekos.life/api/v2/img/${endpoint}`, { timeout: 10000, headers: { 'User-Agent': 'Discord-NSFW-Bot/1.0' } });
    const imageUrl = response.data.url;
    if (!imageUrl || !imageUrl.startsWith('http')) throw new Error('URL invalide');

    const refreshBtn = new Discord.ActionRowBuilder().addComponents(new Discord.ButtonBuilder().setCustomId('refresh_nsfw').setLabel('Autre').setEmoji('🔄').setStyle(Discord.ButtonStyle.Secondary));
    const sentMessage = await message.channel.send({ components: [container(txt(`## 🔞 ${CATEGORIES[category]?.name || category}`), sep(), media(imageUrl), sep(), txt(`*Demandé par ${originalMessage.author.tag}*`)), refreshBtn], flags: FLAGS });
    const col = sentMessage.createMessageComponentCollector({ time: 60_000 });
    col.on('collect', async interaction => {
      if (interaction.user.id !== originalMessage.author.id) { try { await interaction.reply({ content: 'Réservé au créateur.', ephemeral: true }); } catch {} return; }
      await interaction.deferUpdate();
      await getNSFWGif(client, interaction, category, originalMessage);
    });
    col.on('end', () => sentMessage.edit({ components: [] }).catch(() => {}));
  } catch (e) {
    console.error('NSFW API Error:', e);
    const msg = e.response?.status === 429 ? 'Rate limit atteint' : 'API temporairement indisponible';
    message.channel.send({ components: [container(txt('## ❌ Erreur'), sep(), txt(`Impossible de récupérer le contenu.\n**Raison :** ${msg}`))], flags: FLAGS });
  }
}
