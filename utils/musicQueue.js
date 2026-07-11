const { joinVoiceChannel, createAudioPlayer, NoSubscriberBehavior, createAudioResource, AudioPlayerStatus, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const playdl = require('play-dl');
const logger = require('./logger');
const filters = require('./audioFilters');
const { StreamType } = require('@discordjs/voice');
const prism = require('prism-media');

const queues = new Map();

function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      textChannel: null,
      voiceChannel: null,
      connection: null,
      player: createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
      }),
      songs: [],
      playing: false,
      lastMessage: null,
      volume: 1.0,
      currentResource: null,
      current: null,
      cleanupInterval: null,
      loop: false,        // Loop current song
      loopQueue: false,   // Loop entire queue
      filters: []         // Active filters
    });
  }
  return queues.get(guildId);
}

async function connectToChannel(queue, guildId, channel, guild) {
  if (queue.connection && queue.connection.state.status !== VoiceConnectionStatus.Destroyed) return queue.connection;
  try {
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guildId,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true
    });
    queue.connection = connection;

    connection.on('stateChange', async (oldState, newState) => {
      try {
        if (newState.status === VoiceConnectionStatus.Disconnected) {
          logger.warn(`[VOICE] Disconnected in guild ${guildId}. Attempting to reconnect...`);
          try {
            await Promise.race([
              entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
              entersState(connection, VoiceConnectionStatus.Connecting, 5_000)]
            );
          } catch (_) {
            try { connection.destroy(); } catch { }
            queue.connection = null;
            logger.error(`[VOICE] Reconnect failed, destroyed connection for guild ${guildId}`);
          }
        } else if (newState.status === VoiceConnectionStatus.Destroyed) {
          logger.warn(`[VOICE] Connection destroyed for guild ${guildId}`);
          queue.connection = null;
        }
      } catch (e) {
        logger.error('[VOICE] stateChange handler error', e);
      }
    });

    // Handle networking/UDP errors natively to prevent silent crashes
    connection.on('error', (error) => {
        logger.error(`[VOICE] Connection error in guild ${guildId}:`, error);
        if (queue.connection) {
            try { queue.connection.destroy(); } catch {}
            queue.connection = null;
        }
    });


    try {
      if (!queue.cleanupInterval) {
        queue.cleanupInterval = setInterval(() => {
          try {
            const vc = queue.voiceChannel;
            if (!vc) return;
            const nonBots = vc.members.filter((m) => !m.user.bot).size;
            if (nonBots === 0) {
              logger.info(`[VOICE] Channel empty in guild ${guildId}, stopping player and leaving.`);
              stop(queue);
              if (queue.textChannel) {
                queue.textChannel.send('👋 Salon vide, je quitte et j\'arrête la musique.').catch(() => { });
              }
            }
          } catch (_) { }
        }, 20000);
        if (queue.cleanupInterval.unref) queue.cleanupInterval.unref();
      }
    } catch (_) { }

    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    connection.subscribe(queue.player);
    logger.info(`[VOICE] Connected to ${channel.name} (${channel.id}) in guild ${guildId}`);
    return connection;
  } catch (err) {
    logger.error('[VOICE] Failed to connect to channel', err);
    if (queue.connection) {
      try { queue.connection.destroy(); } catch { }
      queue.connection = null;
    }
    throw err;
  }
}

async function playNext(queue, onFinish) {
  if (!queue.songs.length) {
    queue.playing = false;

    if (queue.player) {
      try { queue.player.stop(true); } catch { }
    }
    if (queue.connection) {
      try { queue.connection.destroy(); } catch { }
      queue.connection = null;
    }
    return;
  }
  queue.playing = true;
  const song = queue.songs[0];

  try {
    // Remove discordPlayerCompatibility - it breaks native @discordjs/voice streams
    const streamOptions = { quality: 1 };

    // Si des filtres sont actifs, on doit ajuster la qualité ou le format si nécessaire
    // play-dl retourne généralement du webm/opus ou arbitraire

    const source = await playdl.stream(song.url, streamOptions);

    let resource;

    // Si des filtres sont actifs, utiliser FFmpeg pour transcoder
    if (queue.filters && queue.filters.length > 0) {
      const ffmpegArgs = [
        '-analyzeduration', '0',
        '-loglevel', '0',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2'
      ];

      // Construire la chaîne de filtres
      const filterArgs = queue.filters.map(f => filters[f]).filter(Boolean);
      if (filterArgs.length > 0) {
        ffmpegArgs.push('-af', filterArgs.join(','));
      }

      // Créer un transcodeur FFmpeg
      const transcoder = new prism.FFmpeg({
        args: ffmpegArgs
      });

      // Piper le flux source dans le transcodeur
      const outputStream = source.stream.pipe(transcoder);

      // Créer la ressource audio à partir du flux transcodé (PCM s16le)
      resource = createAudioResource(outputStream, {
        inputType: StreamType.Raw,
        inlineVolume: true
      });
    } else {
      // Pas de filtres, utiliser le flux direct (plus performant)
      resource = createAudioResource(source.stream, {
        inputType: source.type || StreamType.Arbitrary, // Fallback to Arbitrary to let discord probe the stream
        inlineVolume: true
      });
    }

    try {
      if (resource.volume && typeof queue.volume === 'number') {
        resource.volume.setVolume(Math.max(0, Math.min(queue.volume, 2)));
      }
    } catch (_) { }

    queue.currentResource = resource;
    queue.current = {
      song,
      startedAt: Date.now(),
      duration: song.duration || null
    };

    queue.player.play(resource);

    const onIdle = () => {
      queue.player.removeListener(AudioPlayerStatus.Idle, onIdle);

      // Gérer les modes de loop
      if (queue.loop) {
        // Loop single song - ne pas retirer de la file
        if (typeof onFinish === 'function') onFinish(song);
        playNext(queue, onFinish);
      } else if (queue.loopQueue) {
        // Loop queue - déplacer la chanson à la fin
        const finishedSong = queue.songs.shift();
        queue.songs.push(finishedSong);
        if (typeof onFinish === 'function') onFinish(song);
        playNext(queue, onFinish);
      } else {
        // Mode normal - retirer la chanson
        queue.songs.shift();
        if (typeof onFinish === 'function') onFinish(song);
        playNext(queue, onFinish);
      }
    };
    
    // Safety handle if player crashes mid-song
    const onError = (err) => {
        logger.error(`[MUSIC] Player Error on ${song.title}:`, err);
        queue.player.removeListener(AudioPlayerStatus.Idle, onIdle);
        queue.player.removeListener('error', onError);
        queue.songs.shift();
        if (typeof onFinish === 'function') onFinish(song, err);
        playNext(queue, onFinish);
    };

    queue.player.once(AudioPlayerStatus.Idle, onIdle);
    // Only bind once to avoid memory leaks
    if (queue.player.listenerCount('error') === 0) {
        queue.player.on('error', onError);
    }
    
  } catch (err) {
    logger.error('[MUSIC] Play error:', err);
    queue.songs.shift();
    if (typeof onFinish === 'function') onFinish(song, err);
    return playNext(queue, onFinish);
  }
}

function addSong(queue, song) {
  queue.songs.push(song);
}

function skip(queue) {
  if (!queue.player) return false;
  try { queue.player.stop(true); return true; } catch { return false; }
}

function pause(queue) {
  if (!queue.player) return false;
  try { return queue.player.pause(); } catch { return false; }
}

function resume(queue) {
  if (!queue.player) return false;
  try { return queue.player.unpause(); } catch { return false; }
}

function stop(queue) {
  queue.songs = [];
  if (queue.player) {
    try { queue.player.stop(true); } catch { }
  }
  if (queue.connection) {
    try { queue.connection.destroy(); } catch { }
    queue.connection = null;
  }
  queue.playing = false;
  queue.currentResource = null;
  queue.current = null;
  queue.loop = false;
  queue.loopQueue = false;
  queue.filters = [];
  if (queue.cleanupInterval) {
    try { clearInterval(queue.cleanupInterval); } catch { }
    queue.cleanupInterval = null;
  }
}

function setVolume(queue, vol) {
  const v = Math.max(0, Math.min(Number(vol) || 0, 2));
  queue.volume = v;
  try {
    if (queue.currentResource && queue.currentResource.volume) {
      queue.currentResource.volume.setVolume(v);
      return true;
    }
  } catch (_) { }
  return false;
}

function setFilter(queue, filterNames) {
  queue.filters = filterNames || [];
  // Redémarrer la musique actuelle pour appliquer le filtre
  if (queue.playing && queue.current) {
    // On doit arrêter le player, mais playNext va être appelé par l'event Idle
    // Cependant, playNext va passer à la suivante si on ne fait rien
    // Astuce: on remet la chanson au début de la file si on veut la rejouer
    // Mais playNext gère déjà le loop.

    // Le plus simple est de forcer la relecture de la chanson actuelle
    // On doit empêcher playNext de passer à la suivante lors du stop

    // Hack: on utilise une propriété temporaire ou on appelle playNext directement
    // Mais playNext est async et récursif.

    // Solution propre:
    // On arrête le player, l'event Idle se déclenche.
    // Dans l'event Idle, on a la logique de loop.
    // Si on veut rejouer la MÊME chanson, on peut activer le loop temporairement ?
    // Non, car ça affecterait l'état.

    // On va simplement relancer playNext manuellement avec la chanson actuelle
    // en s'assurant qu'elle est toujours en tête de liste (elle l'est tant qu'elle n'est pas shiftée)
    // Mais playNext shift la chanson à la fin de la lecture (dans onIdle).

    // Si on stop le player, onIdle est appelé.
    // On veut que onIdle relance la même chanson.

    // On va modifier playNext pour qu'il ne shift pas si on est en train d'appliquer un filtre ?
    // Trop complexe.

    // Approche simple: on modifie le temps de démarrage pour reprendre là où on était ?
    // Difficile avec le streaming. On recommence du début.

    // On va simplement appeler playNext sans rien changer, car la chanson est toujours en index 0
    // tant que onIdle n'a pas fini.
    // Mais onIdle VA shifter.

    // On va tricher: on ajoute la chanson courante au début de la file (doublon)
    // puis on skip.
    // Comme ça la "nouvelle" chanson (la même) sera jouée.

    const currentSong = queue.songs[0];
    queue.songs.unshift(currentSong); // Ajouter en double au début
    queue.player.stop(true); // Déclenche Idle -> shift le 1er (le doublon) -> joue le 2eme (l'original) ?
    // Non:
    // File: [A, B, C]
    // Unshift: [A, A, B, C]
    // Stop -> Idle -> Shift [A] -> Reste [A, B, C] -> playNext([A])

    // Ça marche !
  }
}

function getNowPlaying(queue) {
  if (!queue || !queue.current) return null;
  const { song, startedAt, duration } = queue.current;
  const position = Math.max(0, Math.min(Math.floor((Date.now() - startedAt) / 1000), duration || Infinity));
  return { song, position, duration: duration || null };
}

module.exports = {
  getQueue,
  connectToChannel,
  playNext,
  addSong,
  skip,
  pause,
  resume,
  stop,
  setVolume,
  setFilter,
  getNowPlaying,
  queues
};
