const { container, txt, sep, reply } = require('../../utils/v2');

const jokes = [
  { q: "Que dit une imprimante à une autre ?", a: "J'ai l'impression qu'on nous observe." },
  { q: "Quel est le comble pour un électricien ?", a: "De ne pas être au courant." },
  { q: "Pourquoi les plongeurs plongent-ils toujours en arrière ?", a: "Parce que sinon ils tombent dans le bateau." },
  { q: "Que fait une fraise sur un cheval ?", a: "Tagada tagada !" },
  { q: "Quel est le sport le plus silencieux ?", a: "Le para-chuuuut." },
  { q: "Pourquoi les bières sont-elles toujours stressées ?", a: "Parce qu'elles ont la pression." },
  { q: "Que fait un geek quand il a peur ?", a: "Il URL." }
];

module.exports = {
  name: 'joke',
  aliases: ['blague'],
  description: 'Raconte une blague aléatoire.',
  category: 'fun',
  run: async (client, message, args) => {
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    return reply(message, container(
      txt('## 🤣 Blague'),
      sep(),
      txt(`**${joke.q}**`),
      sep(),
      txt(`||${joke.a}||`)
    ));
  }
};
