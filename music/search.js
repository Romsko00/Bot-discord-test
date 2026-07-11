const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const yts = require('yt-search');
const { getQueue, connectToChannel, playNext, addSong } = require('../../utils/musicQueue');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
    name: 'search',
    aliases: ['find', 'recherche'],
    description: 'Recherche interactive de musiques',
    usage: '+search <query>',
    category: 'music',
    run: async (client, message, args) => {
        try {
            const voiceChannel = message.member?.voice?.channel;
            if (!voiceChannel) return message.reply({ content: '<a:_:1483497365863399536> Vous devez être dans un salon vocal.', allowedMentions: { repliedUser: false } });

            const query = args.join(' ').trim();
            if (!query) return message.reply({ content: '<a:_:1483497365863399536> Merci d\'indiquer un terme de recherche.', allowedMentions: { repliedUser: false } });

            const searchMsg = await message.channel.send({
                components: [container(txt('## 🔍 Recherche en cours...'), sep(), txt(`Recherche de **${query}**...`))],
                flags: FLAGS
            });

            const results = await yts(query);
            const videos = results.videos.slice(0, 10);

            if (!videos.length) {
                return searchMsg.edit({ components: [container(txt('## ❌ Aucun résultat'), sep(), txt(`Aucun résultat pour **${query}**.`))], flags: FLAGS });
            }

            const options = videos.map((video, index) => ({
                label: video.title.length > 100 ? video.title.substring(0, 97) + '...' : video.title,
                description: `${video.author.name} • ${video.timestamp}`,
                value: index.toString(),
                emoji: '🎵'
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('search_select')
                .setPlaceholder('Sélectionnez une musique')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const listLines = videos.map((v, i) => `\`${i + 1}.\` ${v.title} \`[${v.timestamp}]\``).join('\n').slice(0, 3500);

            await searchMsg.edit({
                components: [
                    container(
                        txt('## 🔍 Résultats de Recherche'),
                        sep(),
                        txt(`**Recherche :** ${query}\n**Résultats :** ${videos.length}`),
                        sep(),
                        txt(listLines)
                    ),
                    row
                ],
                flags: FLAGS
            });

            const collector = searchMsg.createMessageComponentCollector({ time: 60000 });
            collector.on('collect', async (interaction) => {
                if (interaction.user.id !== message.author.id) {
                    try { await interaction.reply({ content: '<:_:1483497503713394719> Cette interface est réservée au créateur.', ephemeral: true }); } catch {}
                    return;
                }
                try {
                    if (interaction.customId === 'search_select') {
                        const selectedIndex = parseInt(interaction.values[0]);
                        const selected = videos[selectedIndex];

                        const queue = getQueue(message.guild.id);
                        queue.textChannel = message.channel;
                        queue.voiceChannel = voiceChannel;

                        addSong(queue, {
                            title: selected.title,
                            url: selected.url,
                            duration: selected.duration?.seconds || null,
                            requestedBy: message.author
                        });

                        await interaction.update({
                            components: [container(
                                txt('## ✅ Musique Ajoutée'),
                                sep(),
                                txt([
                                    `**[${selected.title}](${selected.url})**`,
                                    `**Durée :** ${selected.timestamp}`,
                                    `**Artiste :** ${selected.author.name}`,
                                    `**Position :** ${queue.songs.length}`
                                ].join('\n'))
                            )],
                            flags: FLAGS
                        });

                        if (!queue.playing) {
                            try {
                                await connectToChannel(queue, message.guild.id, voiceChannel, message.guild);
                                await playNext(queue, async (finishedSong, err) => {
                                    if (err) await message.channel.send({ content: `<:_:1483497503713394719> Erreur sur '${finishedSong?.title || 'inconnu'}'.` }).catch(() => {});
                                });
                            } catch (error) {
                                console.error('[SEARCH] Erreur lecture:', error);
                                await message.channel.send({ content: '<a:_:1483497365863399536> Erreur lors de la lecture.' }).catch(() => {});
                            }
                        }
                        collector.stop();
                    }
                } catch (error) {
                    console.error('[SEARCH] Erreur interaction:', error);
                    if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '<a:_:1483497365863399536> Une erreur est survenue.', ephemeral: true }).catch(() => {});
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') await searchMsg.edit({ components: [container(txt('## ⏰ Délai expiré'), sep(), txt('La sélection a expiré.'))], flags: FLAGS }).catch(() => {});
            });

        } catch (error) {
            console.error('[SEARCH] Erreur:', error);
            return message.reply({ content: '<a:_:1483497365863399536> Une erreur est survenue lors de la recherche.', allowedMentions: { repliedUser: false } });
        }
    }
};
