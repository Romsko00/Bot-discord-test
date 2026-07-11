/**
 * DÉFINITION DES FILTRES AUDIO
 * Arguments FFmpeg pour différents effets sonores
 */

module.exports = {
    // Filtres de base
    bassboost: 'bass=g=20,dynaudnorm=f=200',
    '8d': 'apulsator=hz=0.08',
    vaporwave: 'aresample=48000,asetrate=48000*0.8',
    nightcore: 'aresample=48000,asetrate=48000*1.25',
    phaser: 'aphaser=in_gain=0.4',
    tremolo: 'tremolo',
    vibrato: 'vibrato=f=6.5',
    reverse: 'areverse',
    treble: 'treble=g=5',
    normalizer: 'dynaudnorm=f=200',
    surround: 'surround',
    pulsator: 'apulsator=hz=1',
    subboost: 'asubboost',
    karaoke: 'stereotools=mlev=0.015625',
    flanger: 'flanger',
    gate: 'agate',
    haas: 'haas',
    mcompand: 'mcompand',
    mono: 'pan=mono|c0=.5*c0+.5*c1',
    mstlr: 'stereotools=mode=ms>lr',
    mstrr: 'stereotools=mode=ms>rr',
    compressor: 'compand=points=-80/-105|-62/-80|-15.4/-15.4|0/-12|20/-7.6',
    expander: 'compand=attacks=0:points=-80/-169|-54/-80|-49.5/-64.6|-41.1/-41.1|-25.8/-15|-10.8/-4.5|0/0|20/8.3',
    softlimiter: 'compand=attacks=0:points=-80/-80|-12.4/-12.4|-6/-8|0/-6.8|20/-2.8',
    chorus: 'chorus=0.5:0.9:50:0.4:0.25:2',
    chorus2d: 'chorus=0.5:0.9:50:0.4:0.25:2',
    chorus3d: 'chorus=0.5:0.9:50:0.4:0.25:2',
    fadein: 'afade=t=in:ss=0:d=10',
    dim: 'apulsator=hz=0.08',
    earrape: 'channelsplit,sidechaincompress=threshold=0.005:ratio=20:makeup=2,amerge',

    // Alias
    bass: 'bass=g=20,dynaudnorm=f=200',
    slowed: 'aresample=48000,asetrate=48000*0.8',
    speed: 'aresample=48000,asetrate=48000*1.25',
    daycore: 'aresample=48000,asetrate=48000*0.8', // Similaire à vaporwave
};
