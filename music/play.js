const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const yts = require('yt-search');
const playdl = require('play-dl');
const { getQueue, connectToChannel, playNext, addSong, pause, resume, skip, stop } = require('../../utils/musicQueue');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

const cooldown = new Map();
const COOLDOWN_MS = 5000;

module.exports = {
    name: 'play',
    aliases: ['p'],
    description: 'Joue une musique depuis YouTube (+play <titre ou lien>)',
    usage: '+play <titre ou lien YouTube>',
    category: 'music',
    run: async (client, message, args) => {
        try {
            const voiceChannel = message.member?.voice?.channel;
            if (!voiceChannel) return message.reply({ content: '<a:_:1483497365863399536> Vous devez être dans un salon vocal.', allowedMentions: { repliedUser: false } });

            const me = message.guild.members.me;
            const perms = voiceChannel.permissionsFor(me);
            if (!me || !perms || !perms.has(PermissionFlagsBits.Connect) || !perms.has(PermissionFlagsBits.Speak)) {
                return message.reply({ content: '<a:_:1483497365863399536> Je n\'ai pas la permission de me connecter/parler dans ce salon vocal.', allowedMentions: { repliedUser: false } });
            }
            if (voiceChannel.userLimit && voiceChannel.userLimit > 0 && voiceChannel.members?.size >= voiceChannel.userLimit) {
                return message.reply({ content: '<a:_:1483497365863399536> Le salon vocal est plein.', allowedMentions: { repliedUser: false } });
            }

            const query = args.join(' ').trim();
            if (!query) return message.reply({ content: '<a:_:1483497365863399536> Merci d\'indiquer un titre ou un lien YouTube.', allowedMentions: { repliedUser: false } });

            const now = Date.now();
            const last = cooldown.get(message.author.id) || 0;
            if (now - last < COOLDOWN_MS) {
                const remain = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
                return message.reply({ content: `<:time:1450884222368612510> Patientez ${remain}s avant de relancer +play.`, allowedMentions: { repliedUser: false } });
            }
            cooldown.set(message.author.id, now);

            let url = null, title = null, durationSec = null;
            try {
                const valid = playdl.yt_validate(query);
                if (valid === 'video') {
                    url = query;
                    const info = await playdl.video_info(url).catch(() => null);
                    title = info?.video_details?.title || url;
                    durationSec = Number(info?.video_details?.durationInSec) || null;
                } else {
                    const res = await yts(query);
                    const video = res?.videos?.[0];
                    if (!video) return message.reply({ content: '<a:_:1483497365863399536> Aucun résultat trouvé.', allowedMentions: { repliedUser: false } });
                    url = video.url;
                    title = video.title;
                    durationSec = Number(video?.duration?.seconds) || null;
                }
            } catch (e) {
                console.error('play: search error', e);
                return message.reply({ content: '<a:_:1483497365863399536> Erreur lors de la recherche.', allowedMentions: { repliedUser: false } });
            }

            const guildId = message.guild.id;
            const queue = getQueue(guildId);
            queue.textChannel = message.channel;
            queue.voiceChannel = voiceChannel;
            addSong(queue, { title, url, duration: durationSec, requestedBy: message.author });

            const controls = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('music_pause').setLabel('Pause').setStyle(ButtonStyle.Secondary).setEmoji('⏸️'),
                new ButtonBuilder().setCustomId('music_resume').setLabel('Resume').setStyle(ButtonStyle.Secondary).setEmoji('<:_:1483497470754426942>'),
                new ButtonBuilder().setCustomId('music_skip').setLabel('Skip').setStyle(ButtonStyle.Primary).setEmoji('⏭️'),
                new ButtonBuilder().setCustomId('music_stop').setLabel('Stop').setStyle(ButtonStyle.Danger).setEmoji('⏹️')
            );

            const buildNowPlaying = (t, u, requestedBy) => container(
                txt('## 🎵 Lecture en cours'),
                sep(),
                txt(`**[${t}](${u})**\n*Demandé par ${requestedBy?.tag || 'inconnu'}*`)
            );

            if (!queue.playing) {
                try {
                    await connectToChannel(queue, guildId, voiceChannel, message.guild);
                } catch (e) {
                    try { queue.songs.shift(); } catch {}
                    console.error('Failed to join voice channel:', e);
                    return message.reply({ content: '<a:_:1483497365863399536> Impossible de rejoindre le salon vocal. Vérifiez mes permissions et réessayez.', allowedMentions: { repliedUser: false } });
                }

                const sent = await message.channel.send({
                    components: [buildNowPlaying(title, url, message.author), controls],
                    flags: FLAGS
                });
                queue.lastMessage = sent;

                await playNext(queue, async (finishedSong, err) => {
                    if (err) {
                        await message.channel.send({ content: `<:_:1483497503713394719> Erreur sur '${finishedSong?.title || 'inconnu'}', on passe au suivant.` }).catch(() => {});
                    }
                    if (!queue.songs.length) {
                        try { await sent.edit({ components: [] }).catch(() => {}); } catch {}
                    } else {
                        const next = queue.songs[0];
                        try { await sent.edit({ components: [buildNowPlaying(next.title, next.url, next.requestedBy), controls], flags: FLAGS }).catch(() => {}); } catch {}
                    }
                });

                const collector = sent.createMessageComponentCollector({ time: 2 * 60 * 60 * 1000 });
                collector.on('collect', async (i) => {
                    try {
                        if (!i.isButton()) return;
                        const member = i.guild.members.cache.get(i.user.id);
                        const inSameVC = member?.voice?.channelId && member.voice.channelId === voiceChannel.id;
                        if (!inSameVC) return i.reply({ content: '<a:_:1483497365863399536> Vous devez être dans le même vocal que le bot.', ephemeral: true });
                        if (i.customId === 'music_pause') { const ok = pause(queue); return i.reply({ content: ok ? '⏸️ Pause.' : '<:_:1483497503713394719> Rien à mettre en pause.', ephemeral: true }); }
                        if (i.customId === 'music_resume') { const ok = resume(queue); return i.reply({ content: ok ? '<:_:1483497470754426942> Lecture reprise.' : '<:_:1483497503713394719> Rien à reprendre.', ephemeral: true }); }
                        if (i.customId === 'music_skip') { const ok = skip(queue); return i.reply({ content: ok ? '⏭️ Musique suivante.' : '<:_:1483497503713394719> Rien à passer.', ephemeral: true }); }
                        if (i.customId === 'music_stop') { stop(queue); try { await sent.edit({ components: [] }).catch(() => {}); } catch {} return i.reply({ content: '⏹️ Lecture arrêtée et file vidée.', ephemeral: true }); }
                    } catch (e) {
                        console.error('music button error:', e);
                        if (!i.replied && !i.deferred) await i.reply({ content: '<a:_:1483497365863399536> Erreur.', ephemeral: true }).catch(() => {});
                    }
                });
                collector.on('end', async () => { try { await sent.edit({ components: [] }).catch(() => {}); } catch {} });

            } else {
                await message.channel.send({
                    components: [container(txt('## ➕ Ajouté à la file'), sep(), txt(`**[${title}](${url})**`))],
                    flags: FLAGS
                });
            }

        } catch (e) {
            console.error('play command error:', e);
            return message.reply({ content: '<a:_:1483497365863399536> Une erreur est survenue.', allowedMentions: { repliedUser: false } });
        }
    }
};
