const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const LiveEvents = require('../../utils/liveEvents');

module.exports = {
  name: 'clive',
  aliases: ['live', 'eventlive'],
  description: 'Affiche ou lance un événement live casino',
  usage: '+clive | +clive start <nom>',
  category: 'casino',
  run: async (client, message, args) => {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'start') {
      const name = args[1];
      if (!name) return reply(message, errorContainer('Nom d\'événement requis.'));
      LiveEvents.startLiveEvent({ name, start: Date.now(), effect: 'Double jackpot pendant 15 minutes !' });
      return reply(message, container(txt('## ⏰ Événement Live Lancé !'), sep(), txt(`**${name}** est maintenant en cours !`)));
    }
    const event = LiveEvents.getLiveEvent();
    if (!event) return reply(message, container(txt('## ⏰ Événement Live Casino'), sep(), txt('Aucun événement live en cours.')));
    return reply(message, container(
      txt('## ⏰ Événement Live Casino'),
      sep(),
      txt([`**Nom :** ${event.name}`, `**Début :** <t:${Math.floor(event.start / 1000)}:R>`, `**Effet :** ${event.effect}`].join('\n'))
    ));
  }
};
