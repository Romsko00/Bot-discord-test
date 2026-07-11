const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');
const Events = require('../../utils/events');

module.exports = {
  name: 'cevent',
  aliases: ['event', 'evenement'],
  description: 'Affiche ou lance un événement mondial casino',
  usage: '+cevent | +cevent start <nom>',
  category: 'casino',
  run: async (client, message, args) => {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'start') {
      const name = args[1];
      if (!name) return reply(message, errorContainer('Nom d\'événement requis.'));
      Events.startEvent({ name, start: Date.now(), effect: 'x2 XP, jackpot collaboratif, boss casino...' });
      return reply(message, container(txt('## 🎉 Événement Lancé !'), sep(), txt(`Événement **${name}** démarré !`)));
    }
    const event = Events.getCurrentEvent();
    if (!event) return reply(message, container(txt('## 🎉 Événement Mondial Casino'), sep(), txt('Aucun événement en cours.')));
    return reply(message, container(
      txt('## 🎉 Événement Mondial Casino'),
      sep(),
      txt([`**Nom :** ${event.name}`, `**Début :** <t:${Math.floor(event.start / 1000)}:R>`, `**Effet :** ${event.effect}`, '', '*Participe pour des récompenses spéciales !*'].join('\n'))
    ));
  }
};
