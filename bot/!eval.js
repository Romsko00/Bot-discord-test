const { inspect } = require('util');
const { container, txt, sep, reply, errorContainer } = require('../../utils/v2');

module.exports = {
  name: 'eval',
  aliases: ['ev'],
  description: 'Exécute du code JavaScript (SuperAdmin uniquement)',
  usage: '<code>',
  category: 'bot',
  level: 9,
  run: async (client, message, args) => {
    if (!client.config.superadmin || !client.config.superadmin.includes(message.author.id)) {
      return reply(message, errorContainer('**Permission insuffisante** — SuperAdmin uniquement.'));
    }

    const code = args.join(' ');
    if (!code) {
      return reply(message, errorContainer('**Usage :** `!eval <code JavaScript>`'));
    }

    const start = Date.now();
    let output, type, isError = false;

    try {
      let result = eval(code);
      if (result instanceof Promise) result = await result;
      type = typeof result;
      output = type !== 'string' ? inspect(result, { depth: 1 }) : result;
    } catch (err) {
      output = err.toString();
      type = 'error';
      isError = true;
    }

    const elapsed = Date.now() - start;
    const codeBlock = (str, lang = '') => `\`\`\`${lang}\n${str.replace(/`/g, '`\u200B').slice(0, 1800)}\n\`\`\``;

    return reply(message, container(
      txt(isError ? '## ❌ Erreur d\'Évaluation JS' : '## 💻 Évaluation JS'),
      sep(),
      txt(`**Input :**\n${codeBlock(code, 'js')}`),
      sep(),
      txt(`**Output :**\n${codeBlock(output)}`),
      sep(),
      txt(`**Type :** \`${type}\` • **Durée :** ${elapsed}ms`)
    ));
  }
};
